// "use client"

// import { useEffect, useRef, useState, useMemo } from 'react';
// import * as d3 from 'd3';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";
// import { Input } from "@/components/ui/input";
// import { Slider } from "@/components/ui/slider";

// // Types for chart configuration
// interface ChartViewProps {
//   data?: any;
// }

// interface DataField {
//   name: string;
//   label: string;
//   type: 'string' | 'number' | 'date' | 'boolean' | 'object';
// }

// interface ChartConfig {
//   chartType: 'bar' | 'pie' | 'line' | 'scatter' | 'heatmap';
//   xAxis?: string;
//   yAxis?: string;
//   groupBy?: string;
//   aggregation: 'count' | 'sum' | 'average' | 'min' | 'max';
//   sortBy?: string;
//   sortDirection?: 'asc' | 'desc';
//   limit?: number;
//   colors?: string[];
// }

// interface ProcessedData {
//   key: string;
//   value: number;
//   count: number;
//   items: any[];
//   [key: string]: any;
// }

// export function ChartView({ data }: ChartViewProps) {
//   // State for tracking available datasets
//   const [datasetTypes, setDatasetTypes] = useState<string[]>([]);
//   const [selectedDataset, setSelectedDataset] = useState<string>("");
//   const [hasData, setHasData] = useState<boolean>(false);
  
//   // Chart configuration state
//   const [availableFields, setAvailableFields] = useState<DataField[]>([]);
//   const [chartConfig, setChartConfig] = useState<ChartConfig>({
//     chartType: 'bar',
//     xAxis: undefined,
//     yAxis: undefined,
//     groupBy: undefined,
//     aggregation: 'count',
//     sortDirection: 'desc',
//     limit: 10,
//     colors: ['#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab']
//   });
  
//   // Processed data state
//   const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  
//   // Chart refs
//   const chartRef = useRef<SVGSVGElement | null>(null);

//   // Field type detection helper
//   const detectFieldType = (value: any): DataField['type'] => {
//     if (value === null || value === undefined) return 'string';
//     if (typeof value === 'number') return 'number';
//     if (typeof value === 'boolean') return 'boolean';
//     if (typeof value === 'object') {
//       if (value instanceof Date) return 'date';
//       return 'object';
//     }
    
//     // Check if string is a date
//     if (typeof value === 'string') {
//       const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
//       if (datePattern.test(value)) return 'date';
//     }
    
//     return 'string';
//   };
  
//   // Field label formatter
//   const formatFieldLabel = (fieldName: string): string => {
//     return fieldName
//       .replace(/_/g, ' ')
//       .replace(/([A-Z])/g, ' $1')
//       .replace(/^./, (str) => str.toUpperCase())
//       .trim();
//   };
  
//   // Dataset field mapping
//   const datasetFieldMapping: Record<string, { label: string; description: string }> = {
//     traffic_events: { label: 'Traffic Events', description: 'Traffic incidents and events' },
//     lane_blockage_info: { label: 'Lane Blockages', description: 'Road lane blockage information' },
//     dynamic_message_sign_info: { label: 'Dynamic Message Signs', description: 'Electronic road signs' },
//     rest_area_info: { label: 'Rest Areas', description: 'Highway rest area information' },
//     weather_info: { label: 'Weather Information', description: 'Road weather conditions' },
//     social_events: { label: 'Social Events', description: 'Community events affecting traffic' },
//     variable_speed_limit_sign_info: { label: 'Variable Speed Limits', description: 'Dynamic speed limit signs' },
//     travel_time_system_info: { label: 'Travel Times', description: 'Route travel time information' },
//     traffic_parking_info: { label: 'Truck Parking', description: 'Commercial vehicle parking availability' }
//   };
  
//   // Chart type options
//   const chartTypeOptions = [
//     { value: 'bar', label: 'Bar Chart' },
//     { value: 'pie', label: 'Pie Chart' },
//     { value: 'line', label: 'Line Chart' },
//     { value: 'scatter', label: 'Scatter Plot' },
//     { value: 'heatmap', label: 'Heat Map' }
//   ];
  
//   // Aggregation options
//   const aggregationOptions = [
//     { value: 'count', label: 'Count' },
//     { value: 'sum', label: 'Sum' },
//     { value: 'average', label: 'Average' },
//     { value: 'min', label: 'Minimum' },
//     { value: 'max', label: 'Maximum' }
//   ];

//   // Process data when it changes
//   useEffect(() => {
//     if (data && data.results) {
//       // Find all available dataset types in the response
//       const availableDatasets: string[] = [];
//       data.results.forEach((result: any) => {
//         Object.keys(result).forEach(key => {
//           if (Array.isArray(result[key]) && result[key].length > 0 && !availableDatasets.includes(key)) {
//             availableDatasets.push(key);
//           }
//         });
//       });
      
//       setDatasetTypes(availableDatasets);
      
//       // If we have available datasets, select the first one by default
//       if (availableDatasets.length > 0) {
//         setSelectedDataset(availableDatasets[0]);
//       } else {
//         setHasData(false);
//       }
//     } else {
//       setHasData(false);
//     }
//   }, [data]);

//   // Process selected dataset
//   useEffect(() => {
//     if (!selectedDataset || !data || !data.results) {
//       setHasData(false);
//       return;
//     }
    
//     // Extract items from the selected dataset
//     let allItems: any[] = [];
    
//     data.results.forEach((result: any) => {
//       if (result[selectedDataset] && Array.isArray(result[selectedDataset])) {
//         allItems = [...allItems, ...result[selectedDataset]];
//       }
//     });
    
//     if (allItems.length > 0) {
//       setHasData(true);
      
//       // Detect available fields and their types
//       const sampleItem = allItems[0];
//       const fields: DataField[] = [];
      
//       // Process all fields from the first item
//       Object.keys(sampleItem).forEach(key => {
//         // Skip internal fields or complex objects that aren't useful for visualization
//         if (
//           key !== 'id' && 
//           key !== 'coordinates' && 
//           key !== 'geo_json_coordinates' && 
//           !key.includes('_id') && 
//           typeof sampleItem[key] !== 'object'
//         ) {
//           fields.push({
//             name: key,
//             label: formatFieldLabel(key),
//             type: detectFieldType(sampleItem[key])
//           });
//         }
//       });
      
//       setAvailableFields(fields);
      
//       // Set default chart configuration based on available fields
//       const dateField = fields.find(f => f.type === 'date');
//       const numericField = fields.find(f => f.type === 'number');
//       const categoryField = fields.find(f => f.type === 'string');
      
//       setChartConfig(prev => ({
//         ...prev,
//         xAxis: categoryField?.name || fields[0]?.name,
//         yAxis: numericField?.name || 'count'
//       }));
      
//       // Process the data for visualization
//       processData(allItems);
//     } else {
//       setHasData(false);
//     }
//   }, [selectedDataset, data]);

//   // Process data when yAxis or other chart configuration changes
//   useEffect(() => {
//     if (!selectedDataset || !data || !data.results) return;
    
//     let allItems: any[] = [];
//     data.results.forEach((result: any) => {
//       if (result[selectedDataset] && Array.isArray(result[selectedDataset])) {
//         allItems = [...allItems, ...result[selectedDataset]];
//       }
//     });
    
//     if (allItems.length > 0) {
//       processData(allItems);
//     }
//   }, [chartConfig.xAxis, chartConfig.yAxis, chartConfig.aggregation, chartConfig.limit, chartConfig.sortBy, chartConfig.sortDirection, selectedDataset, data]);

//   // Process data based on chart configuration
//   const processData = (items: any[]) => {
//     const { chartType, xAxis, yAxis, groupBy, aggregation, sortBy, sortDirection, limit } = chartConfig;
    
//     if (!xAxis) return;
    
//     // Group data based on the x-axis field
//     const groupedData = items.reduce<Record<string, any[]>>((acc, item) => {
//       const key = item[xAxis]?.toString() || 'Unknown';
//       if (!acc[key]) acc[key] = [];
//       acc[key].push(item);
//       return acc;
//     }, {});
    
//     // Process data based on aggregation type
//     let processedData: ProcessedData[] = Object.entries(groupedData).map(([key, values]) => {
//       let value = 0;
      
//       if (aggregation === 'count') {
//         value = values.length;
//       } else if (yAxis && yAxis !== 'count') {
//         const numValues = values
//           .map(item => parseFloat(item[yAxis]))
//           .filter(val => !isNaN(val));
          
//         if (numValues.length > 0) {
//           switch (aggregation) {
//             case 'sum':
//               value = numValues.reduce((sum, val) => sum + val, 0);
//               break;
//             case 'average':
//               value = numValues.reduce((sum, val) => sum + val, 0) / numValues.length;
//               break;
//             case 'min':
//               value = Math.min(...numValues);
//               break;
//             case 'max':
//               value = Math.max(...numValues);
//               break;
//           }
//         }
//       }
      
//       return { key, value, count: values.length, items: values };
//     });
    
//     // Sort the data
//     processedData.sort((a, b) => {
//       const sortField = sortBy || 'value';
//       const aValue = a[sortField];
//       const bValue = b[sortField];
      
//       if (sortDirection === 'asc') {
//         return aValue > bValue ? 1 : -1;
//       } else {
//         return aValue < bValue ? 1 : -1;
//       }
//     });
    
//     // Limit the number of items if specified
//     if (limit && limit > 0) {
//       processedData = processedData.slice(0, limit);
//     }
    
//     setProcessedData(processedData);
//   };
  
//   // Track active tab to prevent chart disappearing when switching tabs
//   const [activeTab, setActiveTab] = useState<string>("chart");
  
//   // Chart rendering when data is processed or chart configuration changes
//   useEffect(() => {
//     if (processedData.length === 0 || !chartRef.current) return;
    
//     // Render chart whenever processed data or chart configuration changes
//     if (validateChartConfig()) {
//       // Clear previous chart
//       d3.select(chartRef.current).selectAll('*').remove();
      
//       // Render the appropriate chart type
//       switch (chartConfig.chartType) {
//         case 'bar':
//           renderBarChart();
//           break;
//         case 'pie':
//           renderPieChart();
//           break;
//         case 'line':
//           renderLineChart();
//           break;
//         case 'scatter':
//           renderScatterChart();
//           break;
//         case 'heatmap':
//           renderHeatmapChart();
//           break;
//       }
//     }
//   }, [processedData, chartConfig]); // Trigger on data changes or ANY chart config changes
  
//   // Bar Chart Rendering
//   const renderBarChart = () => {
//     if (!chartRef.current || processedData.length === 0) return;
    
//     const svg = d3.select(chartRef.current);
//     const margin = { top: 30, right: 30, bottom: 70, left: 60 };
//     const width = 800 - margin.left - margin.right;
//     const height = 400 - margin.top - margin.bottom;
    
//     // Create the chart container
//     const chart = svg
//       .attr('width', width + margin.left + margin.right)
//       .attr('height', height + margin.top + margin.bottom)
//       .append('g')
//       .attr('transform', `translate(${margin.left},${margin.top})`);
    
//     // X axis
//     const x = d3.scaleBand()
//       .range([0, width])
//       .domain(processedData.map(d => d.key))
//       .padding(0.2);
    
//     chart.append('g')
//       .attr('transform', `translate(0,${height})`)
//       .call(d3.axisBottom(x))
//       .selectAll('text')
//       .attr('transform', 'translate(-10,0)rotate(-45)')
//       .style('text-anchor', 'end');
    
//     // Y axis
//     const y = d3.scaleLinear()
//       .domain([0, d3.max(processedData, d => d.value) || 0])
//       .range([height, 0]);
    
//     chart.append('g')
//       .call(d3.axisLeft(y));
    
//     // Add bars
//     chart.selectAll('bars')
//       .data(processedData)
//       .enter()
//       .append('rect')
//       .attr('x', d => x(d.key) || 0)
//       .attr('y', d => y(d.value))
//       .attr('width', x.bandwidth())
//       .attr('height', d => height - y(d.value))
//       .attr('fill', (d, i) => chartConfig.colors?.[i % (chartConfig.colors?.length || 1)] || '#4e79a7');
    
//     // Add title
//     svg.append('text')
//       .attr('x', (width + margin.left + margin.right) / 2)
//       .attr('y', margin.top / 2)
//       .attr('text-anchor', 'middle')
//       .style('font-size', '16px')
//       .text(`${formatFieldLabel(chartConfig.xAxis || '')} by ${chartConfig.yAxis === 'count' ? 'Count' : formatFieldLabel(chartConfig.yAxis || '')}`);
//   };
  
//   // Pie Chart Rendering
//   const renderPieChart = () => {
//     if (!chartRef.current || processedData.length === 0) return;
    
//     const svg = d3.select(chartRef.current);
//     const width = 800;
//     const height = 400;
//     const radius = Math.min(width, height) / 2 - 40;
    
//     // Create the chart container
//     svg.attr('width', width)
//       .attr('height', height);
    
//     const chart = svg.append('g')
//       .attr('transform', `translate(${width / 2},${height / 2})`);
    
//     // Create color scale
//     const color = d3.scaleOrdinal()
//       .domain(processedData.map(d => d.key))
//       .range(chartConfig.colors || d3.schemeCategory10);
    
//     // Compute the position of each group on the pie
//     const pie = d3.pie<ProcessedData>()
//       .value(d => d.value);
    
//     const data_ready = pie(processedData);
    
//     // Build the pie chart
//     chart.selectAll('slices')
//       .data(data_ready)
//       .enter()
//       .append('path')
//       .attr('d', d3.arc<d3.PieArcDatum<ProcessedData>>()
//         .innerRadius(0)
//         .outerRadius(radius)
//       )
//       .attr('fill', d => color(d.data.key) as string)
//       .attr('stroke', 'white')
//       .style('stroke-width', '2px');
    
//     // Add labels
//     chart.selectAll('labels')
//       .data(data_ready)
//       .enter()
//       .append('text')
//       .text(d => {
//         const percent = Math.round((d.data.value / d3.sum(processedData, d => d.value)) * 100);
//         return percent >= 5 ? `${d.data.key} (${percent}%)` : '';
//       })
//       .attr('transform', d => {
//         const pos = d3.arc<d3.PieArcDatum<ProcessedData>>()
//           .innerRadius(radius * 0.5)
//           .outerRadius(radius * 0.8)
//           .centroid(d);
//         return `translate(${pos[0]},${pos[1]})`;
//       })
//       .style('text-anchor', 'middle')
//       .style('font-size', '12px');
    
//     // Add title
//     svg.append('text')
//       .attr('x', width / 2)
//       .attr('y', 20)
//       .attr('text-anchor', 'middle')
//       .style('font-size', '16px')
//       .text(`Distribution of ${formatFieldLabel(chartConfig.xAxis || '')}`);
//   };
  
//   // Line Chart Rendering
//   const renderLineChart = () => {
//     if (!chartRef.current || processedData.length === 0) return;
    
//     const svg = d3.select(chartRef.current);
//     const margin = { top: 30, right: 30, bottom: 70, left: 60 };
//     const width = 800 - margin.left - margin.right;
//     const height = 400 - margin.top - margin.bottom;
    
//     // Create the chart container
//     const chart = svg
//       .attr('width', width + margin.left + margin.right)
//       .attr('height', height + margin.top + margin.bottom)
//       .append('g')
//       .attr('transform', `translate(${margin.left},${margin.top})`);
    
//     // Sort data chronologically if x-axis is a date
//     const sortedData = [...processedData].sort((a, b) => {
//       // Try to parse as date first
//       const dateA = new Date(a.key);
//       const dateB = new Date(b.key);
      
//       if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
//         return dateA.getTime() - dateB.getTime();
//       }
      
//       // Fall back to string comparison
//       return a.key.localeCompare(b.key);
//     });
    
//     // X axis
//     const x = d3.scalePoint()
//       .range([0, width])
//       .domain(sortedData.map(d => d.key));
    
//     chart.append('g')
//       .attr('transform', `translate(0,${height})`)
//       .call(d3.axisBottom(x))
//       .selectAll('text')
//       .attr('transform', 'translate(-10,0)rotate(-45)')
//       .style('text-anchor', 'end');
    
//     // Y axis
//     const y = d3.scaleLinear()
//       .domain([0, d3.max(sortedData, d => d.value) || 0])
//       .range([height, 0]);
    
//     chart.append('g')
//       .call(d3.axisLeft(y));
    
//     // Add the line
//     chart.append('path')
//       .datum(sortedData)
//       .attr('fill', 'none')
//       .attr('stroke', chartConfig.colors?.[0] || '#4e79a7')
//       .attr('stroke-width', 2)
//       .attr('d', d3.line<ProcessedData>()
//         .x(d => x(d.key) || 0)
//         .y(d => y(d.value))
//       );
    
//     // Add dots
//     chart.selectAll('dots')
//       .data(sortedData)
//       .enter()
//       .append('circle')
//       .attr('cx', d => x(d.key) || 0)
//       .attr('cy', d => y(d.value))
//       .attr('r', 5)
//       .attr('fill', chartConfig.colors?.[0] || '#4e79a7');
    
//     // Add title
//     svg.append('text')
//       .attr('x', (width + margin.left + margin.right) / 2)
//       .attr('y', margin.top / 2)
//       .attr('text-anchor', 'middle')
//       .style('font-size', '16px')
//       .text(`${formatFieldLabel(chartConfig.xAxis || '')} by ${chartConfig.yAxis === 'count' ? 'Count' : formatFieldLabel(chartConfig.yAxis || '')}`);
//   };
  
//   // Scatter Plot Rendering
//   const renderScatterChart = () => {
//     if (!chartRef.current || processedData.length === 0) return;
    
//     const svg = d3.select(chartRef.current);
//     const margin = { top: 30, right: 30, bottom: 70, left: 60 };
//     const width = 800 - margin.left - margin.right;
//     const height = 400 - margin.top - margin.bottom;
    
//     // Create the chart container
//     const chart = svg
//       .attr('width', width + margin.left + margin.right)
//       .attr('height', height + margin.top + margin.bottom)
//       .append('g')
//       .attr('transform', `translate(${margin.left},${margin.top})`);
    
//     // X axis
//     const x = d3.scaleLinear()
//       .domain([0, d3.max(processedData, d => d.value) || 0])
//       .range([0, width]);
    
//     chart.append('g')
//       .attr('transform', `translate(0,${height})`)
//       .call(d3.axisBottom(x));
    
//     // Y axis
//     const y = d3.scaleLinear()
//       .domain([0, d3.max(processedData, d => d.count) || 0])
//       .range([height, 0]);
    
//     chart.append('g')
//       .call(d3.axisLeft(y));
    
//     // Add dots
//     chart.selectAll('dots')
//       .data(processedData)
//       .enter()
//       .append('circle')
//       .attr('cx', d => x(d.value))
//       .attr('cy', d => y(d.count))
//       .attr('r', 7)
//       .style('fill', (d, i) => chartConfig.colors?.[i % (chartConfig.colors?.length || 1)] || '#4e79a7')
//       .style('opacity', 0.7);
    
//     // Add labels
//     chart.selectAll('labels')
//       .data(processedData)
//       .enter()
//       .append('text')
//       .attr('x', d => x(d.value) + 10)
//       .attr('y', d => y(d.count))
//       .text(d => d.key)
//       .style('font-size', '10px');
    
//     // Add X axis label
//     chart.append('text')
//       .attr('text-anchor', 'middle')
//       .attr('x', width / 2)
//       .attr('y', height + margin.bottom - 10)
//       .text(chartConfig.yAxis === 'count' ? 'Count' : formatFieldLabel(chartConfig.yAxis || ''));
    
//     // Add Y axis label
//     chart.append('text')
//       .attr('text-anchor', 'middle')
//       .attr('transform', 'rotate(-90)')
//       .attr('y', -margin.left + 20)
//       .attr('x', -height / 2)
//       .text('Count');
    
//     // Add title
//     svg.append('text')
//       .attr('x', (width + margin.left + margin.right) / 2)
//       .attr('y', margin.top / 2)
//       .attr('text-anchor', 'middle')
//       .style('font-size', '16px')
//       .text(`Scatter Plot of ${formatFieldLabel(chartConfig.xAxis || '')}`);
//   };
  
//   // Heatmap Chart Rendering
//   const renderHeatmapChart = () => {
//     if (!chartRef.current || processedData.length === 0) return;
    
//     const svg = d3.select(chartRef.current);
//     const margin = { top: 30, right: 30, bottom: 70, left: 100 };
//     const width = 800 - margin.left - margin.right;
//     const height = 400 - margin.top - margin.bottom;
    
//     // Create the chart container
//     const chart = svg
//       .attr('width', width + margin.left + margin.right)
//       .attr('height', height + margin.top + margin.bottom)
//       .append('g')
//       .attr('transform', `translate(${margin.left},${margin.top})`);
    
//     // Labels of row and columns
//     const myGroups = Array.from(new Set(processedData.map(d => d.key)));
//     const myVars = ['Value'];
    
//     // Build X scales and axis
//     const x = d3.scaleBand()
//       .range([0, width])
//       .domain(myGroups)
//       .padding(0.05);
    
//     chart.append('g')
//       .attr('transform', `translate(0,${height})`)
//       .call(d3.axisBottom(x))
//       .selectAll('text')
//       .attr('transform', 'translate(-10,0)rotate(-45)')
//       .style('text-anchor', 'end');
    
//     // Build Y scales and axis
//     const y = d3.scaleBand()
//       .range([height, 0])
//       .domain(myVars)
//       .padding(0.05);
    
//     chart.append('g')
//       .call(d3.axisLeft(y));
    
//     // Build color scale
//     const myColor = d3.scaleSequential()
//       .interpolator(d3.interpolateInferno)
//       .domain([0, d3.max(processedData, d => d.value) || 0]);
    
//     // Add the squares
//     chart.selectAll('rect')
//       .data(processedData)
//       .enter()
//       .append('rect')
//       .attr('x', d => x(d.key) || 0)
//       .attr('y', d => y('Value') || 0)
//       .attr('width', x.bandwidth())
//       .attr('height', y.bandwidth())
//       .style('fill', d => myColor(d.value))
//       .style('stroke-width', 4)
//       .style('stroke', 'none')
//       .style('opacity', 0.8);
    
//     // Add title
//     svg.append('text')
//       .attr('x', (width + margin.left + margin.right) / 2)
//       .attr('y', margin.top / 2)
//       .attr('text-anchor', 'middle')
//       .style('font-size', '16px')
//       .text(`Heatmap of ${formatFieldLabel(chartConfig.xAxis || '')}`);
//   };
  
//   // State for chart validation errors
//   const [chartError, setChartError] = useState<string | null>(null);
  
//   // Validate chart configuration
//   const validateChartConfig = () => {
//     if (!chartConfig.xAxis) {
//       setChartError("Please select an X-Axis field");
//       return false;
//     }
    
//     if (chartConfig.chartType === 'scatter' && (!chartConfig.yAxis || chartConfig.yAxis === 'count')) {
//       setChartError("Scatter plots require a numeric Y-Axis field");
//       return false;
//     }
    
//     if (chartConfig.chartType === 'line' && processedData.length < 2) {
//       setChartError("Line charts require at least two data points");
//       return false;
//     }
    
//     if (chartConfig.chartType === 'pie' && processedData.length > 10) {
//       setChartError("Pie charts work best with 10 or fewer categories");
//       // Still return true as this is just a warning
//     } else {
//       setChartError(null);
//     }
    
//     return true;
//   };
  
//   // Effect to validate chart config when it changes
//   useEffect(() => {
//     if (processedData.length > 0) {
//       validateChartConfig();
//     }
//   }, [chartConfig, processedData]);
  
//   // Render the UI
//   return (
//     <div className="flex flex-col gap-4 p-4">
//       {!hasData ? (
//         <Card>
//           <CardContent className="pt-6 flex items-center justify-center h-64">
//             <p className="text-muted-foreground text-center">
//               {data ? "No data available for visualization." : "Waiting for data to visualize..."}
//             </p>
//           </CardContent>
//         </Card>
//       ) : (
//         <>
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex justify-between items-center">
//                 <span>Data Visualization</span>
//                 <Select 
//                   value={selectedDataset} 
//                   onValueChange={setSelectedDataset}
//                 >
//                   <SelectTrigger className="w-[250px]">
//                     <SelectValue placeholder="Select a dataset" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {datasetTypes.map(dataset => (
//                       <SelectItem key={dataset} value={dataset}>
//                         {datasetFieldMapping[dataset]?.label || formatFieldLabel(dataset)}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               {/* Side-by-side layout for chart and configuration */}
//               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//                 {/* Chart area - takes 2/3 of the space on large screens */}
//                 <div className="lg:col-span-2 space-y-4">
//                   <Card>
//                     <CardHeader className="py-3">
//                       <CardTitle className="text-lg">Chart</CardTitle>
//                     </CardHeader>
//                     <CardContent>
//                       {chartError && (
//                         <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md">
//                           {chartError}
//                         </div>
//                       )}
//                       <div className="w-full overflow-x-auto">
//                         <svg ref={chartRef} className="w-full" style={{ minHeight: '400px' }}></svg>
//                       </div>
//                     </CardContent>
//                   </Card>
                  
//                   {/* Data table */}
//                   {/* <Card>
//                     <CardHeader className="py-3">
//                       <CardTitle className="text-lg">Data</CardTitle>
//                     </CardHeader>
//                     <CardContent>
//                       <div className="overflow-x-auto">
//                         <table className="w-full border-collapse">
//                           <thead>
//                             <tr className="border-b">
//                               <th className="text-left p-2">Key</th>
//                               <th className="text-left p-2">Value</th>
//                               <th className="text-left p-2">Count</th>
//                             </tr>
//                           </thead>
//                           <tbody>
//                             {processedData.slice(0, 10).map((item, index) => (
//                               <tr key={index} className="border-b hover:bg-muted/50">
//                                 <td className="p-2">{item.key}</td>
//                                 <td className="p-2">{item.value.toLocaleString()}</td>
//                                 <td className="p-2">{item.count}</td>
//                               </tr>
//                             ))}
//                             {processedData.length > 10 && (
//                               <tr>
//                                 <td colSpan={3} className="p-2 text-center text-muted-foreground">
//                                   {processedData.length - 10} more rows not shown
//                                 </td>
//                               </tr>
//                             )}
//                           </tbody>
//                         </table>
//                       </div>
//                     </CardContent>
//                   </Card> */}
//                 </div>
                
//                 {/* Configuration area - takes 1/3 of the space on large screens */}
//                 <div className="space-y-4">
//                   <Card>
//                     <CardHeader className="py-3">
//                       <CardTitle className="text-lg">Chart Configuration</CardTitle>
//                     </CardHeader>
//                     <CardContent>
//                       <div className="space-y-4">
//                         <div>
//                           <Label htmlFor="chartType">Chart Type</Label>
//                           <Select 
//                             value={chartConfig.chartType} 
//                             onValueChange={(value) => setChartConfig(prev => ({ ...prev, chartType: value as any }))}
//                           >
//                             <SelectTrigger id="chartType">
//                               <SelectValue placeholder="Select chart type" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               {chartTypeOptions.map(option => (
//                                 <SelectItem key={option.value} value={option.value}>
//                                   {option.label}
//                                 </SelectItem>
//                               ))}
//                             </SelectContent>
//                           </Select>
//                         </div>
                        
//                         <div>
//                           <Label htmlFor="xAxis">X-Axis Field</Label>
//                           <Select 
//                             value={chartConfig.xAxis} 
//                             onValueChange={(value) => setChartConfig(prev => ({ ...prev, xAxis: value }))}
//                           >
//                             <SelectTrigger id="xAxis">
//                               <SelectValue placeholder="Select X-Axis field" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               {availableFields.map(field => (
//                                 <SelectItem key={field.name} value={field.name}>
//                                   {field.label}
//                                 </SelectItem>
//                               ))}
//                             </SelectContent>
//                           </Select>
//                         </div>
                        
//                         <div>
//                           <Label htmlFor="yAxis">Y-Axis Metric</Label>
//                           <Select 
//                             value={chartConfig.yAxis} 
//                             onValueChange={(value) => setChartConfig(prev => ({ ...prev, yAxis: value }))}
//                           >
//                             <SelectTrigger id="yAxis">
//                               <SelectValue placeholder="Select Y-Axis metric" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="count">Count</SelectItem>
//                               {availableFields
//                                 .filter(field => field.type === 'number')
//                                 .map(field => (
//                                   <SelectItem key={field.name} value={field.name}>
//                                     {field.label}
//                                   </SelectItem>
//                                 ))}
//                             </SelectContent>
//                           </Select>
//                         </div>
                        
//                         <div>
//                           <Label htmlFor="aggregation">Aggregation Method</Label>
//                           <Select 
//                             value={chartConfig.aggregation} 
//                             onValueChange={(value) => setChartConfig(prev => ({ ...prev, aggregation: value as any }))}
//                           >
//                             <SelectTrigger id="aggregation">
//                               <SelectValue placeholder="Select aggregation method" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               {aggregationOptions.map(option => (
//                                 <SelectItem key={option.value} value={option.value}>
//                                   {option.label}
//                                 </SelectItem>
//                               ))}
//                             </SelectContent>
//                           </Select>
//                         </div>
                        
//                         <div>
//                           <Label htmlFor="sortDirection">Sort Direction</Label>
//                           <Select 
//                             value={chartConfig.sortDirection || 'desc'} 
//                             onValueChange={(value) => setChartConfig(prev => ({ ...prev, sortDirection: value as 'asc' | 'desc' }))}
//                           >
//                             <SelectTrigger id="sortDirection">
//                               <SelectValue placeholder="Select sort direction" />
//                             </SelectTrigger>
//                             <SelectContent>
//                               <SelectItem value="asc">Ascending</SelectItem>
//                               <SelectItem value="desc">Descending</SelectItem>
//                             </SelectContent>
//                           </Select>
//                         </div>
                        
//                         <div>
//                           <Label htmlFor="limit">Limit Results</Label>
//                           <div className="flex items-center gap-2">
//                             <Slider
//                               id="limit"
//                               min={5}
//                               max={50}
//                               step={5}
//                               value={[chartConfig.limit || 10]}
//                               onValueChange={(value) => setChartConfig(prev => ({ ...prev, limit: value[0] }))}
//                               className="flex-1"
//                             />
//                             <span className="w-12 text-center">{chartConfig.limit || 10}</span>
//                           </div>
//                         </div>
                        
//                         <Button 
//                           className="w-full mt-4" 
//                           onClick={() => {
//                             // First reprocess the data with current config
//                             if (data && selectedDataset) {
//                               let allItems: any[] = [];
//                               data.results.forEach((result: any) => {
//                                 if (result[selectedDataset] && Array.isArray(result[selectedDataset])) {
//                                   allItems = [...allItems, ...result[selectedDataset]];
//                                 }
//                               });
                              
//                               if (allItems.length > 0) {
//                                 // Manually process data
//                                 processData(allItems);
//                                 // The chart will automatically update due to the useEffect dependency on processedData
//                               }
//                             }
//                           }}
//                         >
//                           Update Chart
//                         </Button>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </>
//       )}
//     </div>
//   );
// }
