"use client"

import { useState, useMemo, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoCircledIcon, DownloadIcon } from "@radix-ui/react-icons";

// Types for chart configuration
export type ColumnMetadata = {
  name: string;
  type: 'timestamp' | 'number' | 'string';
};

// Define API response structure types
interface ApiResponseItem {
  [tableName: string]: Record<string, any>[];
}

interface ApiResponse {
  results: ApiResponseItem[];
}

export type ChartViewProps = {
  data: Record<string, any>[] | ApiResponse | ApiResponse[];
  columnMeta?: ColumnMetadata[];
};

type ChartType = 'line' | 'bar' | 'stacked-bar' | 'area';
type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

interface ChartConfig {
  xAxis: string | null;
  yAxis: string[];
  groupBy: string | null;
  chartType: ChartType;
  aggregation: AggregationType;
}

interface ProcessedData {
  groupKey: string;
  values: Record<string, number>;
}

/**
 * ChartView component for visualizing tabular data with configurable options
 */
export function ChartView({ data, columnMeta }: ChartViewProps) {
  const chartRef = useRef<ReactECharts>(null);
  const [activeTab, setActiveTab] = useState<string>("chart");
  
  // Chart configuration state
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    xAxis: null,
    yAxis: [],
    groupBy: null,
    chartType: 'bar',
    aggregation: 'count'
  });

  // Extract actual data from API response structure
  const extractedData = useMemo(() => {
    if (!data) return [];
    
    // Handle the case where data is already in the expected format (array of records)
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && !('results' in data[0])) {
      return data as Record<string, any>[];
    }
    
    // Handle the API response structure: { results: [{ table_name: [...items] }] }
    const extractedItems: Record<string, any>[] = [];
    
    // Check if data has the expected API response structure
    if (Array.isArray(data)) {
      // Check if any item has a results property (array of API responses)
      data.forEach(dataItem => {
        if (dataItem && typeof dataItem === 'object' && 'results' in dataItem) {
          const apiItem = dataItem as ApiResponse;
          if (Array.isArray(apiItem.results)) {
            processResultsArray(apiItem.results, extractedItems);
          }
        }
      });
    } else if (data && typeof data === 'object' && 'results' in data) {
      // Data is in the format { results: [...] }
      const apiResponse = data as ApiResponse;
      if (Array.isArray(apiResponse.results)) {
        processResultsArray(apiResponse.results, extractedItems);
      }
    }
    
    return extractedItems;
  }, [data]);
  
  // Helper function to process results array
  function processResultsArray(results: ApiResponseItem[], targetArray: Record<string, any>[]) {
    results.forEach(result => {
      // Each result can contain multiple datasets
      Object.entries(result).forEach(([tableName, items]) => {
        if (Array.isArray(items) && items.length > 0) {
          // Add each item from this dataset
          items.forEach((item: Record<string, any>) => {
            // Add table name as a field to help with filtering/grouping
            targetArray.push({
              ...item,
              _datasetType: tableName
            });
          });
        }
      });
    });
  }

  // Infer column metadata if not provided
  const inferredColumnMeta = useMemo(() => {
    if (columnMeta) return columnMeta;
    
    if (extractedData.length === 0) return [];
    
    // Get the first non-null item to infer types
    const sampleItem = extractedData[0];
    if (!sampleItem) return [];
    
    return Object.entries(sampleItem).map(([key, value]) => {
      // Infer column type
      let type: 'timestamp' | 'number' | 'string' = 'string';
      
      if (typeof value === 'number') {
        type = 'number';
      } else if (value instanceof Date) {
        type = 'timestamp';
      } else if (typeof value === 'string') {
        // Check if string is a timestamp
        const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
        if (datePattern.test(value) && !isNaN(new Date(value).getTime())) {
          type = 'timestamp';
        }
      }
      
      return { name: key, type };
    });
  }, [data, columnMeta]);

  // Filter columns by type for UI selectors
  const stringColumns = useMemo(() => {
    return inferredColumnMeta.filter(col => col.type === 'string').map(col => col.name);
  }, [inferredColumnMeta]);

  const numericColumns = useMemo(() => {
    return inferredColumnMeta.filter(col => col.type === 'number').map(col => col.name);
  }, [inferredColumnMeta]);

  const timeColumns = useMemo(() => {
    return inferredColumnMeta.filter(col => col.type === 'timestamp').map(col => col.name);
  }, [inferredColumnMeta]);

  // Valid x-axis columns are either string or timestamp
  const validXAxisColumns = useMemo(() => {
    return [...stringColumns, ...timeColumns];
  }, [stringColumns, timeColumns]);

  // Process data based on chart configuration
  const processedData = useMemo(() => {
    if (extractedData.length === 0 || !chartConfig.xAxis) {
      return [];
    }

    // Filter out invalid data points
    const validData = extractedData.filter(item => 
      item && typeof item === 'object' && item[chartConfig.xAxis!] !== undefined
    );

    if (validData.length === 0) return [];

    // Group data by x-axis and optional group-by field
    const groupedData: Record<string, Record<string, any[]>> = {};

    validData.forEach(item => {
      const xValue = item[chartConfig.xAxis!];
      const xKey = xValue instanceof Date ? xValue.toISOString() : String(xValue);
      const groupKey = chartConfig.groupBy ? String(item[chartConfig.groupBy] || 'Unknown') : 'default';
      
      if (!groupedData[xKey]) {
        groupedData[xKey] = {};
      }
      
      if (!groupedData[xKey][groupKey]) {
        groupedData[xKey][groupKey] = [];
      }
      
      groupedData[xKey][groupKey].push(item);
    });

    // Apply aggregation to each group
    const result: ProcessedData[] = [];
    const yAxisFields = chartConfig.yAxis.length > 0 ? chartConfig.yAxis : ['count'];

    Object.entries(groupedData).forEach(([xKey, groups]) => {
      const entry: ProcessedData = { groupKey: xKey, values: {} };
      
      Object.entries(groups).forEach(([groupKey, items]) => {
        yAxisFields.forEach(field => {
          let value: number;
          
          if (field === 'count') {
            value = items.length;
          } else {
            const numValues = items
              .map(item => parseFloat(item[field]))
              .filter(val => !isNaN(val));
              
            if (numValues.length === 0) {
              value = 0;
            } else {
              switch (chartConfig.aggregation) {
                case 'sum':
                  value = numValues.reduce((sum, val) => sum + val, 0);
                  break;
                case 'avg':
                  value = numValues.reduce((sum, val) => sum + val, 0) / numValues.length;
                  break;
                case 'min':
                  value = Math.min(...numValues);
                  break;
                case 'max':
                  value = Math.max(...numValues);
                  break;
                default:
                  value = numValues.length; // Default to count
              }
            }
          }
          
          const valueKey = chartConfig.groupBy 
            ? `${groupKey}_${field}` 
            : field;
            
          entry.values[valueKey] = value;
        });
      });
      
      result.push(entry);
    });

    // Sort by x-axis value (chronologically for timestamps)
    return result.sort((a, b) => {
      const aIsDate = timeColumns.includes(chartConfig.xAxis!);
      const bIsDate = timeColumns.includes(chartConfig.xAxis!);
      
      if (aIsDate && bIsDate) {
        return new Date(a.groupKey).getTime() - new Date(b.groupKey).getTime();
      }
      
      return a.groupKey.localeCompare(b.groupKey);
    });
  }, [data, chartConfig, timeColumns]);

  // Helper function to generate appropriate y-axis label
  const getYAxisLabel = useCallback(() => {
    if (chartConfig.yAxis.length === 0) return 'Count';
    
    if (chartConfig.yAxis.length === 1 && chartConfig.yAxis[0] === 'count') {
      return 'Count';
    }
    
    const fieldNames = chartConfig.yAxis.map(field => field === 'count' ? 'Count' : field);
    
    if (fieldNames.length === 1) {
      return `${chartConfig.aggregation.toUpperCase()} of ${fieldNames[0]}`;
    }
    
    return `${chartConfig.aggregation.toUpperCase()}`;
  }, [chartConfig.yAxis, chartConfig.aggregation]);

  // Generate ECharts options based on processed data and configuration
  const chartOptions = useMemo(() => {
    if (!chartConfig.xAxis || processedData.length === 0) {
      return {};
    }

    // Extract x-axis categories and series data
    const xAxisData = processedData.map(item => {
      // Format date strings for better readability if it's a timestamp
      if (timeColumns.includes(chartConfig.xAxis!)) {
        const date = new Date(item.groupKey);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return item.groupKey;
    });

    // Determine all unique series keys
    const allSeriesKeys = Array.from(
      new Set(
        processedData.flatMap(item => Object.keys(item.values))
      )
    );

    // Create series data for each y-axis field and group combination
    const series = allSeriesKeys.map(key => {
      const seriesData = processedData.map(item => item.values[key] || 0);
      
      // Determine series name (remove the field suffix for grouped data)
      let seriesName = key;
      if (chartConfig.groupBy && key.includes('_')) {
        const parts = key.split('_');
        seriesName = parts.slice(0, -1).join('_'); // Remove the last part (field name)
      }
      
      const baseSeriesConfig = {
        name: seriesName,
        data: seriesData,
        type: chartConfig.chartType === 'stacked-bar' ? 'bar' : chartConfig.chartType,
        stack: chartConfig.chartType === 'stacked-bar' ? 'total' : undefined,
        areaStyle: chartConfig.chartType === 'area' ? {} : undefined
      };
      
      return baseSeriesConfig;
    });

    // Generate complete ECharts options
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: chartConfig.chartType === 'line' || chartConfig.chartType === 'area' ? 'cross' : 'shadow'
        }
      },
      legend: {
        data: allSeriesKeys.map(key => {
          if (chartConfig.groupBy && key.includes('_')) {
            const parts = key.split('_');
            return parts.slice(0, -1).join('_');
          }
          return key;
        }),
        type: allSeriesKeys.length > 10 ? 'scroll' : 'plain'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: {
          rotate: xAxisData.some(label => label.length > 10) ? 45 : 0,
          interval: xAxisData.length > 20 ? 'auto' : 0
        }
      },
      yAxis: {
        type: 'value',
        name: getYAxisLabel()
      },
      series: series,
      toolbox: {
        feature: {
          saveAsImage: {}
        }
      }
    };
  }, [processedData, chartConfig, timeColumns]);



  // Export chart as PNG
  const handleExportImage = useCallback(() => {
    if (chartRef.current) {
      const echartsInstance = chartRef.current.getEchartsInstance();
      const url = echartsInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      });
      
      const link = document.createElement('a');
      link.download = `chart-export-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
    }
  }, []);

  // Export data as CSV
  const handleExportCSV = useCallback(() => {
    if (processedData.length === 0) return;
    
    // Get all column headers
    const headers = ['x_value', ...Object.keys(processedData[0].values)];
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...processedData.map(row => {
        return [
          `"${row.groupKey}"`,
          ...Object.values(row.values).map(v => v.toString())
        ].join(',');
      })
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chart-data-${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  }, [processedData]);

  // Check if we have valid data to display
  const hasData = extractedData.length > 0;
  
  // Check if we have valid fields for charting
  const hasValidFields = numericColumns.length > 0 || validXAxisColumns.length > 0;
  
  // Check if chart configuration is complete
  const isChartConfigComplete = chartConfig.xAxis !== null && 
    (chartConfig.yAxis.length > 0 || chartConfig.aggregation === 'count');

  // Render the UI
  return (
    <div className="flex flex-col gap-6 p-4 h-50 overflow-hidden">
      {/* <Card className="h-full flex flex-col overflow-hidden"> */}
        <CardContent className="flex-1 overflow-auto pb-6">
          {!hasData ? (
            <Alert className="mb-4">
              <InfoCircledIcon className="h-4 w-4" />
              <AlertTitle>No Data Available</AlertTitle>
              <AlertDescription>
                There is no data available to visualize. Please ensure your query returns results.
              </AlertDescription>
            </Alert>
          ) : !hasValidFields ? (
            <Alert className="mb-4">
              <InfoCircledIcon className="h-4 w-4" />
              <AlertTitle>Invalid Data Structure</AlertTitle>
              <AlertDescription>
                The data doesn't contain numeric or categorical fields suitable for visualization.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Configuration Section */}
              <Card className="shadow-sm">
                <CardHeader className="py-2">
                  <CardTitle className="text-base">Chart Configuration</CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="chartType" className="text-xs font-medium">Chart Type</Label>
                      <Select 
                        value={chartConfig.chartType} 
                        onValueChange={(value) => setChartConfig(prev => ({ ...prev, chartType: value as ChartType }))}
                      >
                        <SelectTrigger id="chartType" className="h-8 text-sm">
                          <SelectValue placeholder="Select chart type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bar">Bar Chart</SelectItem>
                          <SelectItem value="stacked-bar">Stacked Bar Chart</SelectItem>
                          <SelectItem value="line">Line Chart</SelectItem>
                          <SelectItem value="area">Area Chart</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="xAxis" className="text-xs font-medium">X-Axis Field</Label>
                      <Select 
                        value={chartConfig.xAxis || ''} 
                        onValueChange={(value) => setChartConfig(prev => ({ ...prev, xAxis: value || null }))}
                      >
                        <SelectTrigger id="xAxis" className="h-8 text-sm">
                          <SelectValue placeholder="Select X-Axis field" />
                        </SelectTrigger>
                        <SelectContent>
                          {validXAxisColumns.map(field => (
                            <SelectItem key={field} value={field}>{field}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="yAxis" className="text-xs font-medium">Y-Axis Field(s)</Label>
                      <Select 
                        value={chartConfig.yAxis.length > 0 ? chartConfig.yAxis[0] : 'count'} 
                        onValueChange={(value) => setChartConfig(prev => ({ ...prev, yAxis: [value] }))}
                      >
                        <SelectTrigger id="yAxis" className="h-8 text-sm">
                          <SelectValue placeholder="Select Y-Axis field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="count">Count</SelectItem>
                          {numericColumns.map(field => (
                            <SelectItem key={field} value={field}>{field}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="aggregation" className="text-xs font-medium">Aggregation Method</Label>
                      <Select 
                        value={chartConfig.aggregation} 
                        onValueChange={(value) => setChartConfig(prev => ({ ...prev, aggregation: value as AggregationType }))}
                        disabled={chartConfig.yAxis.length === 0 || chartConfig.yAxis[0] === 'count'}
                      >
                        <SelectTrigger id="aggregation" className="h-8 text-sm">
                          <SelectValue placeholder="Select aggregation method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="avg">Average</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2 col-span-2 md:col-span-4">
                      <Label htmlFor="groupBy" className="text-xs font-medium">Group By (Optional)</Label>
                      <Select 
                        value={chartConfig.groupBy || 'none'} 
                        onValueChange={(value) => setChartConfig(prev => ({ ...prev, groupBy: value === 'none' ? null : value }))}
                      >
                        <SelectTrigger id="groupBy" className="h-8 text-sm">
                          <SelectValue placeholder="Select grouping field (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {stringColumns.map(field => (
                            <SelectItem key={field} value={field}>{field}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Chart Section */}
              <Card className="shadow-sm flex-1">
                <CardHeader className="py-2 flex flex-row items-center justify-between">
                  {/* <CardTitle className="text-base">Chart</CardTitle> */}
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={handleExportImage} size="sm" className="h-8 text-xs">
                      <DownloadIcon className="mr-1 h-3 w-3" />
                      Export as PNG
                    </Button>
                    {/* <Button variant="outline" onClick={handleExportCSV} size="sm" className="h-8 text-xs">
                      <DownloadIcon className="mr-1 h-3 w-3" />
                      Export as CSV
                    </Button> */}
                  </div>
                </CardHeader>
                <CardContent className="overflow-auto">
                  {!isChartConfigComplete ? (
                    <Alert>
                      <InfoCircledIcon className="h-4 w-4" />
                      <AlertTitle>Incomplete Configuration</AlertTitle>
                      <AlertDescription>
                        Please select all required fields above to render a chart.
                      </AlertDescription>
                    </Alert>
                  ) : processedData.length === 0 ? (
                    <Alert>
                      <InfoCircledIcon className="h-4 w-4" />
                      <AlertTitle>No Data Available</AlertTitle>
                      <AlertDescription>
                        No data available for the selected configuration. Try different fields or filters.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="w-full overflow-x-auto border rounded-md p-2">
                      <ReactECharts 
                        ref={chartRef}
                        option={chartOptions} 
                        style={{ height: '400px', width: '100%' }} 
                        notMerge={true}
                        lazyUpdate={true}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      {/* </Card> */}
    </div>
  );
}