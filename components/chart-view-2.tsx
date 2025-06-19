"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DownloadIcon, MixerHorizontalIcon, Cross2Icon, EnterFullScreenIcon, ExitFullScreenIcon, InfoCircledIcon, PlusIcon, BarChartIcon } from "@radix-ui/react-icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Define dimension types
type TimeDimension = 'date_start' | 'date_end';
type LocationDimension = 'route' | 'city' | 'county' | 'district' | 'region' | 'subdistrict' | 'unit';
type CategoryDimension = 'event_type' | 'priority_level' | 'event_status' | 'travel_direction';
type ChartType = 'Line' | 'Bar' | 'Pie' | 'Donut' | 'Area' | 'Scatter' | 'Stacked Bar' | 'Grouped Bar' | 'Heatmap' | 'Treemap' | 'Sunburst' | 'Boxplot' | 'Multi-Axis';
type TimeGranularity = 'hour' | 'day' | 'month' | 'year';

// Interface for date range from timeline selector
interface DateRange {
  start: Date;
  end: Date;
}

// Map of dimension display names
const dimensionDisplayNames: Record<string, string> = {
  'date_start': 'Date Start',
  'date_end': 'Date End',
  'route': 'Route',
  'city': 'City',
  'county': 'County',
  'district': 'District',
  'region': 'Region',
  'subdistrict': 'Subdistrict',
  'unit': 'Unit',
  'event_type': 'Event Type',
  'priority_level': 'Priority Level',
  'event_status': 'Event Status',
  'travel_direction': 'Travel Direction'
};

// Define types for traffic events
type TrafficEvent = {
  [key: string]: string | number | undefined;
  event_type?: string;
  priority_level?: string;
  event_status?: string;
  date_start?: string;
  date_end?: string;
  route?: string;
  city?: string;
  county?: string;
  district?: string;
  region?: string;
  subdistrict?: string;
  unit?: string;
  start_mile_marker?: string;
  travel_direction?: string;
};

// API response interface
interface ApiResponse {
  results: {
    traffic_events: TrafficEvent[];
  }[];
}

// Helper function to format date
const formatDate = (dateString: string | number | undefined, granularity: TimeGranularity = 'day'): string | null => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    switch (granularity) {
      case 'hour':
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${date.getHours()}:00`;
      case 'day':
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      case 'month':
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
      case 'year':
        return `${date.getFullYear()}`;
      default:
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    }
  } catch (error) {
    console.warn('Invalid date format:', dateString);
    return null;
  }
};

// Helper function to group data by a dimension
const groupDataByDimension = (data: TrafficEvent[], dimension: string): Record<string, TrafficEvent[]> => {
  const groups: Record<string, TrafficEvent[]> = {};
  
  data.forEach(event => {
    if (dimension in event) {
      const value = event[dimension];
      if (value === undefined || value === null) return;
      
      const key = String(value);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    }
  });
  
  return groups;
};

// Validate dimension selection and return suggested chart types based on the dimension combinations
const isValidSelection = (dimensions: string[]): { valid: boolean; suggestedCharts: string[] } => {
  const hasTime = dimensions.includes("T");
  const hasLocation = dimensions.includes("L");
  const hasCategory = dimensions.includes("C");
  
  // T only - Invalid
  if (hasTime && !hasLocation && !hasCategory) {
    return { valid: false, suggestedCharts: [] };
  }
  
  // L only - Invalid
  if (!hasTime && hasLocation && !hasCategory) {
    return { valid: false, suggestedCharts: [] };
  }
  
  // C only - Valid: Bar, Pie, Treemap, Sunburst
  if (!hasTime && !hasLocation && hasCategory) {
    return { valid: true, suggestedCharts: ['Bar', 'Pie', 'Treemap', 'Sunburst'] };
  }
  
  // T + C - Valid: Line, Grouped Bar, Heatmap, Multi-Axis
  if (hasTime && !hasLocation && hasCategory) {
    return { valid: true, suggestedCharts: ['Line', 'Grouped Bar', 'Heatmap', 'Multi-Axis'] };
  }
  
  // L + C - Valid: Grouped Bar, Stacked Bar, Pie
  if (!hasTime && hasLocation && hasCategory) {
    return { valid: true, suggestedCharts: ['Grouped Bar', 'Stacked Bar', 'Pie'] };
  }
  
  // T + L - Valid: Line, Heatmap
  if (hasTime && hasLocation && !hasCategory) {
    return { valid: true, suggestedCharts: ['Line', 'Heatmap'] };
  }
  
  // T + L + C - Valid: Stacked Bar, Grouped Bar, Line, Heatmap, Boxplot, Multi-Axis
  if (hasTime && hasLocation && hasCategory) {
    return { valid: true, suggestedCharts: ['Stacked Bar', 'Grouped Bar', 'Line', 'Heatmap', 'Boxplot', 'Multi-Axis'] };
  }
  
  return { valid: false, suggestedCharts: [] }; // fallback for any other combination
};

// Generate a dynamic chart title based on selected dimensions and chart type
const generateChartTitle = (timeDim: TimeDimension | null, locationDim: LocationDimension | null, categoryDims: CategoryDimension[], chartType: string): string => {
  const dimensionParts: string[] = [];
  
  if (timeDim) {
    dimensionParts.push(dimensionDisplayNames[timeDim as string] || 'Time');
  }
  
  if (locationDim) {
    dimensionParts.push(dimensionDisplayNames[locationDim as string] || 'Location');
  }
  
  if (categoryDims.length > 0) {
    const categoryNames = categoryDims.map(dim => dimensionDisplayNames[dim as string] || dim);
    dimensionParts.push(categoryNames.join(' and '));
  }
  
  if (dimensionParts.length === 0) {
    return `Traffic Events ${chartType} Chart`;
  }
  
  return `${chartType} Chart of Traffic Events by ${dimensionParts.join(', ')}`;
};

// Generate a multi-axis chart with different series types and multiple Y-axes
const generateMultiAxisChart = (data: TrafficEvent[], timeDimension: TimeDimension | null, categoryDimensions: CategoryDimension[], dateRange: DateRange | null = null, timeGranularity: TimeGranularity = 'day'): echarts.EChartsOption => {
  if (!timeDimension || categoryDimensions.length < 2 || data.length === 0) {
    return { 
      title: { text: 'Insufficient data for multi-axis chart' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: []
    };
  }
  
  // Filter data by date range if available
  const filteredData = dateRange ? data.filter(event => {
    const eventDate = event[timeDimension as string];
    if (typeof eventDate !== 'string') return false;
    
    const date = new Date(eventDate);
    return date >= dateRange.start && date <= dateRange.end;
  }) : data;
  
  console.log(`Filtering multi-axis data by date range: ${dateRange ? `${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}` : 'No date range'}`);
  console.log(`Multi-axis data count before filtering: ${data.length}, after: ${filteredData.length}`);

  // Extract time values for X-axis
  const timeValues = new Set<string>();
  data.forEach(event => {
    const dateValue = event[timeDimension as string];
    if (typeof dateValue === 'string') {
      const date = formatDate(dateValue);
      if (date) timeValues.add(date);
    }
  });
  
  const dates = Array.from(timeValues).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  const categoryData: Record<string, Record<string, number>> = {};
  const categoryTypes: Record<string, Set<string>> = {};
  const seriesData: Record<string, Record<string, number>> = {};
  
  // Initialize category data structure
  categoryDimensions.forEach(catDim => {
    categoryData[catDim] = {};
    categoryTypes[catDim] = new Set<string>();
    seriesData[catDim] = {};
  });
  
  // Process data to group by time and categories
  filteredData.forEach(event => {
    const dateValue = event[timeDimension as string];
    if (typeof dateValue !== 'string') return;
    
    const date = formatDate(dateValue, timeGranularity);
    if (!date) return;
    
    categoryDimensions.forEach(catDim => {
      const catValue = event[catDim];
      if (typeof catValue !== 'string') return;
      
      categoryTypes[catDim].add(catValue);
      
      const key = `${date}-${catValue}`;
      seriesData[catDim][key] = (seriesData[catDim][key] || 0) + 1;
    });
  });
  
  // Create series for each category
  const series: any[] = [];
  const yAxis: any[] = [];
  
  // Color schemes for different series types
  const colors = {
    line: '#EE6666',   // Red for line charts (temperature)
    bar1: '#5470C6',   // Blue for first bar series (evaporation)
    bar2: '#91CC75'    // Green for second bar series (precipitation)
  };
  
  // Assign different chart types and axes to each category dimension
  categoryDimensions.forEach((catDim, index) => {
    const categories = Array.from(categoryTypes[catDim]);
    
    // For the first category, create a line chart (like temperature)
    if (index === 0) {
      categories.forEach(category => {
        series.push({
          name: `${dimensionDisplayNames[catDim] || catDim}: ${category}`,
          type: 'line',
          yAxisIndex: 0,
          data: dates.map((date: string) => seriesData[catDim][`${date}-${category}`] || 0),
          itemStyle: { color: colors.line },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 8
        });
      });
      
      yAxis.push({
        type: 'value',
        name: dimensionDisplayNames[catDim] || catDim,
        position: 'right',
        axisLine: { lineStyle: { color: colors.bar1 } },
        axisLabel: { formatter: '{value}' }
      });
    }
    // For the third category, create another bar chart with a different axis (like precipitation)
    else if (index === 2) {
      categories.forEach(category => {
        series.push({
          name: `${dimensionDisplayNames[catDim] || catDim}: ${category}`,
          type: 'bar',
          yAxisIndex: 2,
          data: dates.map((date: string) => seriesData[catDim][`${date}-${category}`] || 0),
          itemStyle: { color: colors.bar2 }
        });
      });
      
      yAxis.push({
        type: 'value',
        name: dimensionDisplayNames[catDim] || catDim,
        position: 'right',
        offset: 80,
        axisLine: { lineStyle: { color: colors.bar2 } },
        axisLabel: { formatter: '{value}' }
      });
    }
  });
  
  return {
    title: { text: 'Multi-Axis Chart of Traffic Events', left: 'center' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: '#999' } } },
    legend: { data: series.map(s => s.name), bottom: 10, type: 'scroll', orient: 'horizontal' },
    grid: { left: '3%', right: '10%', bottom: '15%', containLabel: true },
    xAxis: [
      { 
        type: 'category', 
        data: dates, 
        axisPointer: { type: 'shadow' },
        axisLabel: { rotate: 45, fontSize: 10 }
      }
    ],
    yAxis,
    series
  };
};

// Generate chart based on selected dimensions
const generateChartOption = (data: TrafficEvent[], timeDimension: TimeDimension | null, locationDimension: LocationDimension | null, categoryDimensions: CategoryDimension[], chartType: ChartType | null, dateRange: DateRange | null = null, timeGranularity: TimeGranularity = 'day'): echarts.EChartsOption => {
  // Type-safe options will be used throughout the function
  console.log('Generating chart with:', {
    dataLength: data.length,
    timeDimension,
    locationDimension,
    categoryDimensions,
    chartType
  });
  
  // Log a sample of the data to debug
  if (data.length > 0) {
    console.log('Sample data item:', JSON.stringify(data[0], null, 2));
  }
  
  if (!chartType || data.length === 0) {
    return { 
      title: { text: 'No data available' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: []
    };
  }
  
  // Special case for Multi-Axis chart
  if (chartType === 'Multi-Axis') {
    return generateMultiAxisChart(data, timeDimension, categoryDimensions, dateRange, timeGranularity);
  }
  
  // Default empty chart configuration
  const chartOption: echarts.EChartsOption = {
    title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
    tooltip: { trigger: 'axis' },
    legend: { 
      data: [],
      type: 'scroll',
      orient: 'horizontal',
      bottom: 0
    },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    toolbox: {
      feature: {
        saveAsImage: {}
      }
    },
    xAxis: { type: 'category', data: [] },
    yAxis: { type: 'value' },
    series: []
  };
  
  try {
    // Time-based charts (Line, Area, Bar)
    if (timeDimension && categoryDimensions.length > 0) {
      // Group by date and category
      const categoryValues = new Set<string>();
      const dateGroups: Record<string, Record<string, number>> = {};
      
      // Filter data by date range if available
      const filteredData = dateRange ? data.filter(event => {
        const eventDate = event[timeDimension as string];
        if (typeof eventDate !== 'string') return false;
        
        const date = new Date(eventDate);
        return date >= dateRange.start && date <= dateRange.end;
      }) : data;
      
      console.log(`Filtering data by date range: ${dateRange ? `${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}` : 'No date range'}`); 
      console.log(`Data count before filtering: ${data.length}, after: ${filteredData.length}`);
      
      filteredData.forEach(event => {
        const dateValue = event[timeDimension as string];
        if (typeof dateValue !== 'string') return;
        
        const date = formatDate(dateValue, timeGranularity);
        if (!date) return;
        
        categoryDimensions.forEach(catDim => {
          const category = event[catDim];
          if (typeof category !== 'string') return;
          
          if (!dateGroups[date]) {
            dateGroups[date] = {};
          }
          
          dateGroups[date][category] = (dateGroups[date][category] || 0) + 1;
          categoryValues.add(category);
        });
      });
      
      const dates = Object.keys(dateGroups).sort();
      const categories = Array.from(categoryValues).map(cat => cat.toString());
      
      // For Multi-Axis chart, use the dedicated generator function
      if (chartType === 'Multi-Axis' as ChartType) {
        return generateMultiAxisChart(data, timeDimension, categoryDimensions, dateRange, timeGranularity);
      }
      
      // Boxplot chart
      if (chartType === 'Boxplot') {
        // Process data for boxplot - we need to calculate statistics for each category
        const boxplotData: Array<[string, number[]]> = [];
        const boxplotSeries: any[] = [];
        
        // Group data by category and collect all values
        categories.forEach(category => {
          const values: number[] = [];
          dates.forEach(date => {
            const count = dateGroups[date][category] || 0;
            if (count > 0) values.push(count);
          });
          
          if (values.length > 0) {
            boxplotData.push([category, values]);
          }
        });
        
        // Create boxplot series
        boxplotSeries.push({
          name: 'Event Distribution',
          type: 'boxplot',
          data: boxplotData.map(item => {
            const data = item[1];
            // Calculate boxplot stats: min, Q1, median, Q3, max
            data.sort((a, b) => a - b);
            const min = data[0];
            const max = data[data.length - 1];
            const q1 = data[Math.floor(data.length * 0.25)];
            const median = data[Math.floor(data.length * 0.5)];
            const q3 = data[Math.floor(data.length * 0.75)];
            
            return {
              name: item[0],
              value: [min, q1, median, q3, max]
            };
          })
        });
        
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: {
            trigger: 'item',
            formatter: function (params: any) {
              const data = params.data;
              return `${params.name}<br/>
                Maximum: ${data.value[4]}<br/>
                Upper Quartile: ${data.value[3]}<br/>
                Median: ${data.value[2]}<br/>
                Lower Quartile: ${data.value[1]}<br/>
                Minimum: ${data.value[0]}`;
            }
          },
          grid: { left: '10%', right: '10%', bottom: '15%' },
          xAxis: { type: 'category', data: boxplotData.map(item => item[0]) },
          yAxis: { type: 'value', name: 'Event Count' },
          series: boxplotSeries
        };
      }
      
      // Create series based on chart type for Line, Area, Bar, etc.
      if (chartType === 'Line' || chartType === 'Area' || chartType === 'Bar' || chartType === 'Stacked Bar' || chartType === 'Grouped Bar') {
        let seriesType: 'line' | 'bar';
        if (chartType === 'Line' || chartType === 'Area') {
          seriesType = 'line';
        } else {
          seriesType = 'bar';
        }
        
        const series = categories.map(category => ({
          name: category,
          type: seriesType,
          stack: chartType === 'Stacked Bar' ? 'total' : undefined,
          areaStyle: chartType === 'Area' ? {} : undefined,
          data: dates.map(date => dateGroups[date][category] || 0)
        }));
        
        // Create a new chart option to avoid type errors
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: { trigger: 'axis' },
          legend: { data: categories, type: 'scroll', orient: 'horizontal', bottom: 0 },
          grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value' },
          series: series
        };
      }
      
      // Heatmap chart
      else if (chartType === 'Heatmap' && locationDimension) {
        const timeValues = new Set<string>();
        const locationValues = new Set<string>();
        const heatmapData: [string, string, number][] = [];
        
        // Extract unique time and location values
        data.forEach(event => {
          const timeValue = event[timeDimension as string];
          const locationValue = event[locationDimension as string];
          
          if (typeof timeValue === 'string' && typeof locationValue === 'string') {
            const formattedTime = formatDate(timeValue, timeGranularity);
            if (!formattedTime) return;
            
            timeValues.add(formattedTime);
            locationValues.add(locationValue);
          }
        });
        
        // Count events for each time-location pair
        const timeLocCount: Record<string, Record<string, number>> = {};
        
        data.forEach(event => {
          const timeValue = event[timeDimension as string];
          const locationValue = event[locationDimension as string];
          
          if (typeof timeValue === 'string' && typeof locationValue === 'string') {
            const formattedTime = formatDate(timeValue, timeGranularity);
            if (!formattedTime) return;
            
            if (!timeLocCount[formattedTime]) {
              timeLocCount[formattedTime] = {};
            }
            
            timeLocCount[formattedTime][locationValue] = (timeLocCount[formattedTime][locationValue] || 0) + 1;
          }
        });
        
        // Convert to heatmap data format [row, column, value]
        const times = Array.from(timeValues).sort();
        const locations = Array.from(locationValues).sort();
        
        times.forEach((time, timeIndex) => {
          locations.forEach((location, locIndex) => {
            const value = timeLocCount[time]?.[location] || 0;
            heatmapData.push([time, location, value]);
          });
        });
        
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: {
            position: 'top',
            formatter: (params: any) => {
              return `${params.data[0]}, ${params.data[1]}: ${params.data[2]}`;
            }
          },
          visualMap: {
            min: 0,
            max: Math.max(...heatmapData.map(item => item[2]), 1),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '5%'
          },
          grid: { 
            height: '50%',
            top: '10%',
            left: '3%', 
            right: '4%', 
            bottom: '15%', 
            containLabel: true 
          },
          xAxis: {
            type: 'category',
            data: times,
            splitArea: { show: true },
            axisLabel: { rotate: 45 }
          },
          yAxis: {
            type: 'category',
            data: locations,
            splitArea: { show: true }
          },
          series: [{
            name: 'Events',
            type: 'heatmap',
            data: heatmapData,
            label: { show: false },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
            }
          }]
        };
      }
    }
        // Simple time-based charts (Line, Area, Bar) without categories
    if (timeDimension) {
      // Group by date
      const dateGroups: Record<string, number> = {};
      
      data.forEach(event => {
        const dateValue = event[timeDimension as string];
        if (typeof dateValue !== 'string') return;
        
        const date = formatDate(dateValue, timeGranularity);
        if (!date) return;
        
        dateGroups[date] = (dateGroups[date] || 0) + 1;
      });
      
      const dates = Object.keys(dateGroups).sort();
      const counts = dates.map(date => dateGroups[date]);
      
      console.log('Generated time-based data:', { dates, counts });
      
      return {
        title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates },
        yAxis: { type: 'value', name: 'Event Count' },
        series: [{
          name: 'Events',
          type: chartType === 'Area' ? 'line' as const : chartType.toLowerCase() as any,
          areaStyle: chartType === 'Area' ? {} : undefined,
          data: counts
        }]
      };
    }
    
    // Location-based charts (Bar, Pie, Treemap, Sunburst)
    if (locationDimension && categoryDimensions.length === 0) {
      // Check if data has the location dimension
      if (data.length > 0 && !data[0][locationDimension as string]) {
        console.warn(`Location dimension ${locationDimension} not found in data:`, data[0]);
        return {
          title: { text: 'Missing location dimension data' },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: [] },
          yAxis: { type: 'value' },
          series: []
        };
      }
      
      // Filter data by date range if available
      const filteredData = dateRange ? data.filter(event => {
        // For location-based charts without time dimension, we still filter by date_start
        const eventDate = event['date_start'];
        if (typeof eventDate !== 'string') return false;
        
        const date = new Date(eventDate);
        return date >= dateRange.start && date <= dateRange.end;
      }) : data;
      
      console.log(`Filtering location data by date range: ${dateRange ? `${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}` : 'No date range'}`);
      console.log(`Location data count before filtering: ${data.length}, after: ${filteredData.length}`);
      
      const locationGroups = groupDataByDimension(filteredData, locationDimension as string);
      // Filter out null/undefined locations and ensure all values are strings
      const locations = Object.keys(locationGroups)
        .filter(loc => loc && loc !== 'undefined' && loc !== 'null')
        .map(loc => loc.toString());
      const counts = locations.map(loc => locationGroups[loc].length);
      
      console.log('Generated location-based data:', { locations, counts });
      
      if (chartType === 'Pie' || chartType === 'Donut') {
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          legend: { 
            data: locations,
            type: 'scroll',
            orient: 'horizontal',
            bottom: 0
          },
          series: [{
            name: 'Events by Location',
            type: 'pie',
            radius: chartType === 'Donut' ? ['40%', '70%'] : '70%',
            center: ['50%', '45%'],
            data: locations.map((loc, i) => ({
              name: loc,
              value: counts[i]
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }]
        };
      } else if (chartType === 'Treemap') {
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: { formatter: '{b}: {c}' },
          series: [{
            name: 'Events by Location',
            type: 'treemap',
            data: locations.map((loc, i) => ({
              name: loc,
              value: counts[i]
            })),
            label: {
              show: true,
              formatter: '{b}\n{c}'
            },
            breadcrumb: { show: false },
            itemStyle: {
              borderColor: '#fff'
            }
          }]
        };
      } else if (chartType === 'Sunburst') {
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: { formatter: '{b}: {c}' },
          series: [{
            name: 'Events by Location',
            type: 'sunburst',
            data: [{
              name: 'Locations',
              children: locations.map((loc, i) => ({
                name: loc,
                value: counts[i]
              }))
            }],
            radius: ['15%', '80%'],
            label: {
              rotate: 'radial'
            }
          }]
        };
      } else {
        // Bar chart for locations
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: locations },
          yAxis: { type: 'value', name: 'Event Count' },
          series: [{
            name: 'Events',
            type: 'bar',
            data: counts
          }]
        };
      }
    }
        // Location and category combined charts
    if (locationDimension && categoryDimensions.length > 0) {
      const categoryDim = categoryDimensions[0];
      const categoryValues = new Set<string>();
      const locationCategoryGroups: Record<string, Record<string, number>> = {};
      
      data.forEach(event => {
        if (!locationDimension || !categoryDim) return;
        
        const locationValue = event[locationDimension];
        const categoryValue = event[categoryDim];
        
        if (typeof locationValue !== 'string' || typeof categoryValue !== 'string') return;
        
        const location = locationValue;
        const category = categoryValue;
        
        if (!location || !category) return;
        
        if (!locationCategoryGroups[location]) {
          locationCategoryGroups[location] = {};
        }
        
        locationCategoryGroups[location][category] = (locationCategoryGroups[location][category] || 0) + 1;
        categoryValues.add(category);
      });
      
      const locations = Object.keys(locationCategoryGroups).filter(loc => loc && loc !== 'undefined' && loc !== 'null');
      const categories = Array.from(categoryValues);
      
      console.log('Generated location-category data:', { locations, categories });
      
      // Boxplot chart - process data differently for this chart type
      if (chartType === 'Boxplot') {
        // For boxplot, we need to collect all values for each category across locations
        const categoryData: Record<string, number[]> = {};
        
        categories.forEach(category => {
          categoryData[category] = [];
          locations.forEach(location => {
            const value = locationCategoryGroups[location][category] || 0;
            if (value > 0) {
              categoryData[category].push(value);
            }
          });
        });
        
        // Filter out categories with insufficient data points
        const validCategories = Object.keys(categoryData).filter(cat => categoryData[cat].length >= 5);
        
        if (validCategories.length === 0) {
          return {
            title: { text: 'Insufficient data for boxplot (need at least 5 data points per category)' },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: [] },
            yAxis: { type: 'value' },
            series: []
          };
        }
        
        // Create boxplot series
        const boxplotSeries = [{
          name: 'Event Distribution',
          type: 'boxplot' as const,
          data: validCategories.map(category => {
            const values = categoryData[category];
            values.sort((a, b) => a - b);
            
            // Calculate boxplot stats: min, Q1, median, Q3, max
            const min = values[0];
            const max = values[values.length - 1];
            const q1 = values[Math.floor(values.length * 0.25)];
            const median = values[Math.floor(values.length * 0.5)];
            const q3 = values[Math.floor(values.length * 0.75)];
            
            return {
              name: category,
              value: [min, q1, median, q3, max]
            };
          })
        }];
        
        return {
          title: { text: generateChartTitle(timeDimension, locationDimension, categoryDimensions, chartType) },
          tooltip: {
            trigger: 'item',
            formatter: function (params: any) {
              const data = params.data;
              return `${params.name}<br/>
                Maximum: ${data.value[4]}<br/>
                Upper Quartile: ${data.value[3]}<br/>
                Median: ${data.value[2]}<br/>
                Lower Quartile: ${data.value[1]}<br/>
                Minimum: ${data.value[0]}`;
            }
          },
          grid: { left: '10%', right: '10%', bottom: '15%' },
          xAxis: { type: 'category', data: validCategories },
          yAxis: { type: 'value', name: 'Event Count' },
          series: boxplotSeries
        };
      }
      
      if (chartType === 'Stacked Bar') {
        const series = categories.map(category => ({
          name: category,
          type: 'bar' as const,
          stack: 'total',
          emphasis: { focus: 'series' as const },
          data: locations.map(location => locationCategoryGroups[location][category] || 0)
        }));
        
        return {
          title: { text: `Events by ${locationDimension} and ${categoryDim}` },
          tooltip: { trigger: 'axis' },
          legend: { 
            data: categories.filter(Boolean) as string[], 
            type: 'scroll', 
            bottom: 0 
          },
          grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
          xAxis: { 
            type: 'category', 
            data: locations.filter(Boolean) as string[] 
          },
          yAxis: { type: 'value' },
          series: series
        };
      }
    }
    
    // Category dimensions only (no time or location)
    if (categoryDimensions.length > 0 && !timeDimension && !locationDimension) {
      // Filter data by date range if available
      const filteredData = dateRange ? data.filter(event => {
        // For category-only charts without time dimension, we still filter by date_start
        const eventDate = event['date_start'];
        if (typeof eventDate !== 'string') return false;
        
        const date = new Date(eventDate);
        return date >= dateRange.start && date <= dateRange.end;
      }) : data;
      
      console.log(`Filtering category data by date range: ${dateRange ? `${dateRange.start.toISOString()} to ${dateRange.end.toISOString()}` : 'No date range'}`);
      console.log(`Category data count before filtering: ${data.length}, after: ${filteredData.length}`);
      
      // Count events by category
      const categoryCounts: Record<string, Record<string, number>> = {};
      
      categoryDimensions.forEach(catDim => {
        categoryCounts[catDim] = {};
        
        filteredData.forEach(event => {
          const categoryValue = event[catDim];
          if (typeof categoryValue !== 'string' || !categoryValue) return;
          
          categoryCounts[catDim][categoryValue] = (categoryCounts[catDim][categoryValue] || 0) + 1;
        });
      });
      
      // If we have only one category dimension, show a simple pie/bar chart
      if (categoryDimensions.length === 1) {
        const catDim = categoryDimensions[0];
        const categories = Object.keys(categoryCounts[catDim]).filter(c => c && c !== 'undefined' && c !== 'null');
        const values = categories.map(c => categoryCounts[catDim][c]);
        
        // Sort by count descending
        const sortedData = categories.map((cat, i) => ({ name: cat, value: values[i] }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 20); // Limit to top 20 for readability
        
        if (chartType === 'Pie' || chartType === 'Donut') {
          return {
            title: { text: `Distribution of Events by ${dimensionDisplayNames[catDim] || catDim}` },
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { 
              type: 'scroll',
              orient: 'horizontal',
              bottom: 10,
              data: sortedData.map(item => item.name)
            },
            series: [{
              name: dimensionDisplayNames[catDim] || catDim,
              type: 'pie',
              radius: chartType === 'Donut' ? ['40%', '70%'] : '70%',
              center: ['50%', '50%'],
              data: sortedData,
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              }
            }]
          };
        } else {
          // Default to bar chart
          return {
            title: { text: `Distribution of Events by ${dimensionDisplayNames[catDim] || catDim}` },
            tooltip: { trigger: 'axis' },
            xAxis: {
              type: 'category',
              data: sortedData.map(item => item.name),
              axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: { type: 'value' },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            series: [{
              name: dimensionDisplayNames[catDim] || catDim,
              type: 'bar' as const,
              data: sortedData.map(item => item.value)
            }]
          };
        }
      }
      
      // If we have multiple category dimensions, show a comparison chart
      else if (categoryDimensions.length > 1) {
        const primaryDim = categoryDimensions[0];
        const secondaryDim = categoryDimensions[1];
        
        // Create a matrix of primary x secondary dimension counts
        const comparisonData: Record<string, Record<string, number>> = {};
        const primaryCategories = new Set<string>();
        const secondaryCategories = new Set<string>();
        
        data.forEach(event => {
          const primaryValue = event[primaryDim];
          const secondaryValue = event[secondaryDim];
          
          if (typeof primaryValue !== 'string' || !primaryValue || 
              typeof secondaryValue !== 'string' || !secondaryValue) return;
          
          if (!comparisonData[primaryValue]) {
            comparisonData[primaryValue] = {};
          }
          
          comparisonData[primaryValue][secondaryValue] = 
            (comparisonData[primaryValue][secondaryValue] || 0) + 1;
          
          primaryCategories.add(primaryValue);
          secondaryCategories.add(secondaryValue);
        });
        
        const primaryCats = Array.from(primaryCategories).filter(c => c && c !== 'undefined' && c !== 'null');
        const secondaryCats = Array.from(secondaryCategories).filter(c => c && c !== 'undefined' && c !== 'null');
        
        // Limit categories if there are too many
        const limitedPrimaryCats = primaryCats.length > 10 ? primaryCats.slice(0, 10) : primaryCats;
        const limitedSecondaryCats = secondaryCats.length > 8 ? secondaryCats.slice(0, 8) : secondaryCats;
        
        // Create series for each secondary category
        const series = limitedSecondaryCats.map(secondaryCat => ({
          name: secondaryCat,
          type: 'bar' as const,
          stack: 'total',
          emphasis: { focus: 'series' as const },
          data: limitedPrimaryCats.map(primaryCat => 
            comparisonData[primaryCat]?.[secondaryCat] || 0
          )
        }));
        
        return {
          title: { 
            text: `Comparison of ${dimensionDisplayNames[primaryDim] || primaryDim} by ${dimensionDisplayNames[secondaryDim] || secondaryDim}`,
            left: 'center'
          },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          legend: {
            type: 'scroll',
            orient: 'horizontal',
            bottom: 10,
            data: limitedSecondaryCats
          },
          grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
          xAxis: {
            type: 'category',
            data: limitedPrimaryCats,
            axisLabel: { rotate: 45, fontSize: 10 }
          },
          yAxis: { type: 'value' },
          series: series
        };
      }
    }
    
    console.warn('No matching chart configuration found for the selected dimensions');
    return {
      title: { text: 'No matching chart configuration' },
      graphic: {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: 'Please select dimensions to visualize data',
          fontSize: 14,
          fill: '#999'
        }
      }
    };
  } catch (error) {
    console.error('Error generating chart:', error);
    return { 
      title: { text: 'Error generating chart' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: [] },
      yAxis: { type: 'value' },
      series: []
    };
  }
};

// Generate example chart 1: Event Frequency Over Time by Type
const generateExampleChart1 = (data: TrafficEvent[]): echarts.EChartsOption => {
  if (data.length === 0) {
    return { title: { text: 'No data available' } };
  }
  
  try {
    // Group data by event type and date
    const eventTypes = Array.from(new Set(data
      .map(event => event.event_type)
      .filter((type): type is string => typeof type === 'string')));
    
    // Take only the top 5 most common event types for clearer visualization
    const eventTypeCounts: Record<string, number> = {};
    data.forEach(event => {
      if (typeof event.event_type === 'string') {
        eventTypeCounts[event.event_type] = (eventTypeCounts[event.event_type] || 0) + 1;
      }
    });
    
    // Sort event types by frequency and take top 5
    const topEventTypes = Object.entries(eventTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    const dateMap: Record<string, Record<string, number>> = {};
    
    data.forEach(event => {
      if (!event.date_start || !event.event_type || !topEventTypes.includes(event.event_type)) return;
      
      const date = formatDate(event.date_start);
      if (!date) return;
      
      const eventType = event.event_type;
      if (typeof eventType !== 'string') return;
      
      if (!dateMap[date]) {
        dateMap[date] = {};
      }
      
      dateMap[date][eventType] = (dateMap[date][eventType] || 0) + 1;
    });
    
    // Sort dates and limit to last 10 dates for clearer visualization
    const dates = Object.keys(dateMap).sort();
    const recentDates = dates.length > 10 ? dates.slice(-10) : dates;
    
    // Create series for each top event type
    const series = topEventTypes.map(eventType => ({
      name: eventType,
      type: 'line' as const,
      smooth: true,
      lineStyle: { width: 3 },
      symbol: 'circle',
      symbolSize: 8,
      data: recentDates.map(date => dateMap[date][eventType] || 0)
    }));
    
    return {
      // title: { text: 'Recent Event Trends by Type', left: 'center', top: 0, textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { 
        data: topEventTypes.filter(type => !!type) as string[], 
        type: 'scroll', 
        bottom: 0,
        textStyle: { fontSize: 11 }
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: { 
        type: 'category', 
        data: recentDates.filter(date => !!date) as string[],
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: { type: 'value', name: 'Event Count', nameTextStyle: { fontSize: 11 } },
      series
    };
  } catch (error) {
    console.error('Error generating example chart 1:', error);
    return { title: { text: 'Error generating chart' } };
  }
};

// Generate example chart 2: Event Distribution by Location
const generateExampleChart2 = (data: TrafficEvent[]): echarts.EChartsOption => {
  if (data.length === 0) {
    return { title: { text: 'No data available' } };
  }
  
  try {
    // Count events by county for a pie chart
    const countyData: Record<string, number> = {};
    
    data.forEach(event => {
      if (typeof event.county === 'string' && event.county) {
        countyData[event.county] = (countyData[event.county] || 0) + 1;
      } else if (typeof event.location === 'string' && event.location) {
        // Try to extract county from location if available
        const county = event.location.split(',').pop()?.trim();
        if (county) {
          countyData[county] = (countyData[county] || 0) + 1;
        }
      }
    });
    
    // Sort counties by event count and take top 8
    const topCounties = Object.entries(countyData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    
    // Calculate total events for percentage
    const totalEvents = topCounties.reduce((sum, [_, count]) => sum + count, 0);
    
    // Create pie chart data
    const pieData = topCounties.map(([county, count]) => ({
      name: county,
      value: count,
      // Add percentage to tooltip
      percent: Math.round((count / totalEvents) * 100)
    }));
    
    // Create color palette
    const colors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666',
      '#73c0de', '#3ba272', '#fc8452', '#9a60b4'
    ];
    
    return {
      title: { 
        text: 'Event Distribution by Location',
        left: 'center',
        top: 0,
        textStyle: { fontSize: 14 }
      },
      tooltip: { 
        trigger: 'item',
        formatter: '{b}: {c} events ({d}%)'
      },
      legend: { 
        type: 'scroll',
        orient: 'horizontal',
        bottom: 0,
        data: pieData.map(item => item.name),
        textStyle: { fontSize: 11 }
      },
      series: [{
        name: 'Location Distribution',
        type: 'pie',
        radius: ['30%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 12,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: pieData,
        color: colors
      }]
    };
  } catch (error) {
    console.error('Error generating example chart 2:', error);
    return { title: { text: 'Error generating chart' } };
  }
};

// Main component
export default function ChartView2() {
  // State for selected dimensions
  const [timeDimension, setTimeDimension] = useState<TimeDimension | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('day');
  const [locationDimension, setLocationDimension] = useState<LocationDimension | null>(null);
  const [categoryDimensions, setCategoryDimensions] = useState<CategoryDimension[]>([]);
  
  // State for date range from timeline selector
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [data, setData] = useState<TrafficEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<ChartType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTrafficEventsData, setIsTrafficEventsData] = useState<boolean | null>(null);
  const [chartRefs, setChartRefs] = useState<{
    mainChart: echarts.EChartsType | null;
    exampleChart1: echarts.EChartsType | null;
    exampleChart2: echarts.EChartsType | null;
  }>({ mainChart: null, exampleChart1: null, exampleChart2: null });
  
  // State for managing multiple charts with tab system
  const [userCharts, setUserCharts] = useState<{
    id: string;
    title: string;
    type: ChartType | null;
    timeDimension: TimeDimension | null;
    locationDimension: LocationDimension | null;
    categoryDimensions: CategoryDimension[];
    timeGranularity: TimeGranularity;
  }[]>([{
    id: 'chart-1',
    title: 'Chart 1',
    type: 'Line',
    timeDimension: 'date_start',
    locationDimension: null,
    categoryDimensions: ['event_type'],
    timeGranularity: 'day'
  }]);
  
  // Active chart tab
  const [activeChartId, setActiveChartId] = useState<string>('chart-1');
  
  // State for chart tab editing
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [editingChartTitle, setEditingChartTitle] = useState<string>('');
  
  // State for delete chart confirmation
  const [chartToDelete, setChartToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  
  // Functions to manage charts
  const addNewChart = () => {
    const newChartId = `chart-${userCharts.length + 1}`;
    const newChart = {
      id: newChartId,
      title: `Chart ${userCharts.length + 1}`,
      type: null,
      timeDimension: timeDimension,
      locationDimension: locationDimension,
      categoryDimensions: [...categoryDimensions],
      timeGranularity: timeGranularity
    };
    setUserCharts([...userCharts, newChart]);
    setActiveChartId(newChartId);
  };
  
  // Start editing chart title
  const startEditingChartTitle = (chartId: string) => {
    const chart = userCharts.find(c => c.id === chartId);
    if (chart) {
      setEditingChartId(chartId);
      setEditingChartTitle(chart.title);
    }
  };
  
  // Save edited chart title
  const saveChartTitle = () => {
    if (editingChartId) {
      setUserCharts(userCharts.map(chart => 
        chart.id === editingChartId ? {
          ...chart,
          title: editingChartTitle.trim() || `Chart ${editingChartId.split('-')[1]}`
        } : chart
      ));
      setEditingChartId(null);
    }
  };
  
  // Handle key press in title edit input
  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveChartTitle();
    } else if (e.key === 'Escape') {
      setEditingChartId(null);
    }
  };
  
  // Confirm delete chart
  const confirmDeleteChart = (chartId: string) => {
    setChartToDelete(chartId);
    setShowDeleteConfirm(true);
  };
  
  // Delete chart after confirmation
  const deleteChart = () => {
    if (chartToDelete) {
      // Don't allow deleting the last chart
      if (userCharts.length <= 1) {
        setShowDeleteConfirm(false);
        setChartToDelete(null);
        return;
      }
      
      const newCharts = userCharts.filter(chart => chart.id !== chartToDelete);
      setUserCharts(newCharts);
      
      // If the active chart is being deleted, switch to the first available chart
      if (activeChartId === chartToDelete) {
        setActiveChartId(newCharts[0].id);
      }
      
      setShowDeleteConfirm(false);
      setChartToDelete(null);
    }
  };
  
  const updateActiveChart = () => {
    setUserCharts(userCharts.map(chart => 
      chart.id === activeChartId ? {
        ...chart,
        type: selectedChartType,
        timeDimension: timeDimension,
        locationDimension: locationDimension,
        categoryDimensions: [...categoryDimensions],
        timeGranularity: timeGranularity
      } : chart
    ));
  };
  
  // Sync the left panel with the active chart settings
  useEffect(() => {
    const activeChart = userCharts.find(chart => chart.id === activeChartId);
    if (activeChart) {
      setTimeDimension(activeChart.timeDimension);
      setLocationDimension(activeChart.locationDimension);
      setCategoryDimensions([...activeChart.categoryDimensions]);
      setTimeGranularity(activeChart.timeGranularity);
      setSelectedChartType(activeChart.type);
    }
  }, [activeChartId]);
  
  // Update the active chart when configuration changes
  useEffect(() => {
    if (timeDimension !== null || locationDimension !== null || categoryDimensions.length > 0) {
      updateActiveChart();
    }
  }, [timeDimension, locationDimension, categoryDimensions, timeGranularity, selectedChartType]);
  
  // State for expanded charts and chart controls
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [showChartControls, setShowChartControls] = useState<{
    mainChart: boolean;
    exampleChart1: boolean;
    exampleChart2: boolean;
  }>({ mainChart: false, exampleChart1: false, exampleChart2: false });
  
  // Chart customization options
  const [chartCustomization, setChartCustomization] = useState<{
    xAxis: string | null;
    yAxis: string | null;
    groupBy: string | null;
    aggregation: 'count' | 'sum' | 'average' | null;
    colorScheme: string;
  }>({
    xAxis: null, 
    yAxis: null, 
    groupBy: null, 
    aggregation: 'count',
    colorScheme: 'default'
  });
  
  // Determine suggested chart types based on selected dimensions
  const suggestedCharts = useMemo(() => {
    const dimensions: string[] = [];
    if (timeDimension) dimensions.push('T');
    if (locationDimension) dimensions.push('L');
    if (categoryDimensions.length > 0) dimensions.push('C');
    
    const { valid, suggestedCharts } = isValidSelection(dimensions);
    return valid ? suggestedCharts : [];
  }, [timeDimension, locationDimension, categoryDimensions]);
  
  // Listen for map data updates from the SelectorPanel instead of fetching directly
  useEffect(() => {
    const handleMapDataUpdated = (event: CustomEvent) => {
      setLoading(true);
      setError(null);
      
      try {
        const mapData = event.detail;
        console.log('Received map data:', mapData);
        
        // For debugging - log the structure of the received data
        console.log('Map data structure:', JSON.stringify(mapData, null, 2).substring(0, 500) + '...');
        
        // Extract date range from the query parameters if available
        if (mapData && mapData.request && mapData.request.parameters && 
            mapData.request.parameters.temporal_join_conditions) {
          const temporalConditions = mapData.request.parameters.temporal_join_conditions;
          
          // Look for date_start conditions to extract start and end dates
          const dateExpressions = temporalConditions.find((condition: any) => 
            condition.expressions && Array.isArray(condition.expressions))?.expressions;
          
          if (dateExpressions && dateExpressions.length >= 2) {
            // Find start date (>= condition)
            const startDateExpr = dateExpressions.find((expr: any) => 
              expr.column === 'date_start' && expr.operator === '>=');
              
            // Find end date (<= condition)
            const endDateExpr = dateExpressions.find((expr: any) => 
              expr.column === 'date_start' && expr.operator === '<=');
            
            if (startDateExpr && endDateExpr) {
              setDateRange({
                start: new Date(startDateExpr.value),
                end: new Date(endDateExpr.value)
              });
              console.log('Extracted date range:', {
                start: startDateExpr.value,
                end: endDateExpr.value
              });
            }
          }
        }
        
        // Check for traffic_events in the results object structure
        if (mapData && mapData.results) {
          // Handle both array and object formats of results
          if (Array.isArray(mapData.results)) {
            // Format: results is an array of objects
            for (const resultItem of mapData.results) {
              if (resultItem && resultItem.traffic_events && Array.isArray(resultItem.traffic_events)) {
                console.log('Found traffic events in array format:', resultItem.traffic_events.length);
                console.log('First event sample:', JSON.stringify(resultItem.traffic_events[0], null, 2));
                
                // Set initial dimension values based on the first event
                // Don't automatically set dimensions - let the user select them
                
                setData(resultItem.traffic_events);
                setIsTrafficEventsData(true);
                setLoading(false);
                return;
              }
            }
          } else if (typeof mapData.results === 'object') {
            // Format: results is an object with dataset names as keys
            for (const [tableName, datasetResults] of Object.entries(mapData.results)) {
              if (tableName === 'traffic_events' && Array.isArray(datasetResults)) {
                console.log('Found traffic events in object format:', datasetResults.length);
                console.log('First event sample:', JSON.stringify(datasetResults[0], null, 2));
                
                // Set initial dimension values based on the first event
                // Don't automatically set dimensions - let the user select them
                
                setData(datasetResults);
                setIsTrafficEventsData(true);
                setLoading(false);
                return;
              } else if (tableName !== 'traffic_events') {
                // Data is not traffic events
                setIsTrafficEventsData(false);
                setData([]);
                setLoading(false);
                return;
              }
            }
          }
          
          // Direct format - results is the array of traffic events
          if (Array.isArray(mapData.results) && mapData.results.length > 0 && 
              mapData.results[0].hasOwnProperty('event_type') && 
              mapData.results[0].hasOwnProperty('date_start')) {
            console.log('Found direct traffic events array:', mapData.results.length);
            console.log('First event sample:', JSON.stringify(mapData.results[0], null, 2));
            
            // Don't automatically set dimensions - let the user select them
            // Only set data and loading state
            // This ensures checkboxes aren't automatically checked
            
            setData(mapData.results);
            setIsTrafficEventsData(true);
            setLoading(false);
            return;
          } else {
            // Data is not in traffic events format
            setIsTrafficEventsData(false);
            setData([]);
            setLoading(false);
            return;
          }
          
          // If we get here, we didn't find traffic_events in the expected format
          // setError('No traffic events data found in the response');
          // console.error('Could not find traffic events in the expected format:', mapData);
        } else {
          setError('Invalid response format from API');
          console.error('Invalid response format:', mapData);
        }
      } catch (err) {
        setError('Failed to process traffic events data');
        console.error('Error processing map data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    // Listen for the custom event from SelectorPanel
    window.addEventListener('map-data-updated', handleMapDataUpdated as EventListener);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('map-data-updated', handleMapDataUpdated as EventListener);
    };
  }, [timeDimension]);
  
  // Handle category dimension selection
  const handleCategoryChange = (dimension: CategoryDimension, isChecked: boolean) => {
    if (isChecked) {
      setCategoryDimensions(prev => [...prev, dimension]);
    } else {
      setCategoryDimensions(prev => prev.filter(dim => dim !== dimension));
    }
    // Reset chart type when dimensions change
    setSelectedChartType(null);
  };
  
  // Export chart as image
  const exportChart = (chartId: 'mainChart' | 'exampleChart1' | 'exampleChart2') => {
    try {
      // Get chart instance
      const chartInstance = chartRefs[chartId];
      if (!chartInstance) {
        console.error(`Chart reference not found for ${chartId}`);
        setError('Failed to export chart: Chart reference not found');
        return;
      }
      
      // Get chart as base64 image
      const dataUrl = chartInstance.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${chartId}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting chart:', error);
      setError('Failed to export chart');
    }
  };
  
  // Toggle expanded chart dialog
  const toggleExpandChart = (chartType: string | null) => {
    setExpandedChart(chartType);
  };
  
  // Toggle chart controls
  const toggleChartControls = (chartType: 'mainChart' | 'exampleChart1' | 'exampleChart2') => {
    setShowChartControls((prev: { mainChart: boolean; exampleChart1: boolean; exampleChart2: boolean }) => ({
      ...prev,
      [chartType]: !prev[chartType]
    }));
  };
  
  // Apply chart customization
  const applyChartCustomization = (chartType: 'mainChart' | 'exampleChart1' | 'exampleChart2') => {
    // Re-render the chart with new customization options
    if (chartRefs[chartType]) {
      chartRefs[chartType]?.setOption({
        // Apply customization options
        color: getColorScheme(chartCustomization?.colorScheme || 'default'),
        // Other options would be applied here based on customization
      });
    }
  };
  
  // Get color scheme based on selection
  const getColorScheme = (scheme: string) => {
    const schemes: Record<string, string[]> = {
      'default': ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
      'warm': ['#d94e2a', '#e27644', '#e99158', '#efac6f', '#f4c588', '#f8dea2', '#fcf7bd'],
      'cool': ['#2c728e', '#3a8fb7', '#5aa7ce', '#7bbce1', '#9cd0f0', '#c0e4fa', '#e4f7ff'],
      'traffic': ['#4caf50', '#ffeb3b', '#ff9800', '#f44336', '#9c27b0']
    };
    
    return schemes[scheme] || schemes['default'];
  };
  
  return (
    <div className="w-full h-full flex flex-col">

      
      {/* Expanded Chart Dialog */}
      <Dialog open={expandedChart !== null} onOpenChange={(open) => !open && setExpandedChart(null)}>
        <DialogContent className="max-w-[90vw] w-[1200px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              {expandedChart === 'mainChart' ? 'Traffic Events Chart' : 
               expandedChart === 'exampleChart1' ? 'Event Frequency Over Time by Type' : 
               'Event Severity Trends by Route'}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleExpandChart(null)}
              >
                <ExitFullScreenIcon className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-[600px] mt-4">
            {expandedChart === 'mainChart' && (
              <ReactECharts 
                ref={(e) => { if (e) chartRefs.mainChart = e.getEchartsInstance(); }}
                option={generateChartOption(data, timeDimension, locationDimension, categoryDimensions, selectedChartType, dateRange, timeGranularity)}
                style={{ height: '100%', minHeight: '400px' }}
                opts={{ renderer: 'canvas' }}
              />
            )}
            {expandedChart === 'exampleChart1' && (
              <ReactECharts 
                option={generateExampleChart1(data)}
                style={{ height: '100%', minHeight: '600px' }}
                opts={{ renderer: 'canvas' }}
              />
            )}
            {expandedChart === 'exampleChart2' && (
              <ReactECharts 
                option={generateExampleChart2(data)}
                style={{ height: '100%', minHeight: '600px' }}
                opts={{ renderer: 'canvas' }}
              />
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <Button 
              onClick={() => exportChart(expandedChart as 'mainChart' | 'exampleChart1' | 'exampleChart2')}
              className="flex items-center gap-2"
            >
              <DownloadIcon className="h-4 w-4" /> Export as PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-col md:flex-row gap-3 h-full">
        {/* Control Panel */}
        <div className="mt-2 w-full md:w-1/4 bg-card rounded-lg p-3 border overflow-auto max-h-[calc(100vh-120px)]">
          
                    {/* Request Summary - Always visible */}
                    <div className="mb-3 bg-muted/40 rounded-md p-2 border border-dashed text-sm">
            <Accordion type="single" collapsible defaultValue="request-summary" className="w-full">
              <AccordionItem value="request-summary" className="border-none">
                <AccordionTrigger className="py-1 px-0 hover:no-underline text-lg font-medium">
                  <span className="flex items-center gap-1">
                    <InfoCircledIcon className="h-3 w-3" />
                    <span>Requested data</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-md pt-1 pb-0 px-0">
                  <p>
                    Traffic events from <span className="font-medium">{dateRange ? dateRange.start.toLocaleDateString() : 'Jun 3, 2025'}</span> to <span className="font-medium">{dateRange ? dateRange.end.toLocaleDateString() : 'Jun 10, 2025'}</span>
                    {locationDimension ? (
                      <> on <span className="font-medium">{locationDimension}</span></>
                    ) : (
                      <> in all locations</>
                    )}
                    {/* {categoryDimensions.length > 0 && (
                      <> filtered by {categoryDimensions.join(', ')}</>
                    )} */}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          
          <h3 className="text-md font-semibold mb-1">Configure Chart</h3>
{/*           
          <p className="text-xs text-muted-foreground mb-2">
            Select dimensions to visualize
          </p> */}
          
          {/* Time Dimension */}
          <div className="mb-4 mt-2">
            <Label className="block mb-2">Time Dimension</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={timeGranularity === 'hour' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => {
                    setTimeDimension('date_start');
                    setTimeGranularity('hour');
                  }}
                  className="text-xs h-7"
                >
                  Hour
                </Button>
                <Button 
                  variant={timeGranularity === 'day' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => {
                    setTimeDimension('date_start');
                    setTimeGranularity('day');
                  }}
                  className="text-xs h-7"
                >
                  Day
                </Button>
                <Button 
                  variant={timeGranularity === 'month' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => {
                    setTimeDimension('date_start');
                    setTimeGranularity('month');
                  }}
                  className="text-xs h-7"
                >
                  Month
                </Button>
                <Button 
                  variant={timeGranularity === 'year' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => {
                    setTimeDimension('date_start');
                    setTimeGranularity('year');
                  }}
                  className="text-xs h-7"
                >
                  Year
                </Button>
              </div>
              {dateRange && timeDimension && (
                <div className="text-xs text-muted-foreground pt-1">
                  Using date range: {dateRange.start.toLocaleDateString()} to {dateRange.end.toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          
          {/* Location Dimension */}
          <div className="mb-4">
            <Label className="block mb-2">Location Dimension (Select 1)</Label>
            <div className="space-y-2">
              {(['route', 'city', 'county', 'district', 'region', 'subdistrict', 'unit'] as const).map(dim => (
                <div key={dim} className="flex items-center">
                  <Checkbox 
                    id={`location-${dim}`} 
                    checked={locationDimension === dim}
                    onCheckedChange={(checked) => {
                      if (checked) setLocationDimension(dim);
                      else setLocationDimension(null);
                    }}
                  />
                  <Label htmlFor={`location-${dim}`} className="ml-2">{dimensionDisplayNames[dim]}</Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Category Dimensions */}
          <div className="mb-4">
            <Label className="block mb-2">Category Dimensions (Select 1 or more)</Label>
            <div className="space-y-2">
              {(['event_type', 'priority_level', 'event_status', 'travel_direction'] as const).map(dim => (
                <div key={dim} className="flex items-center">
                  <Checkbox 
                    id={dim} 
                    checked={categoryDimensions.includes(dim)}
                    onCheckedChange={(checked) => handleCategoryChange(dim, checked === true)}
                  />
                  <Label htmlFor={dim} className="ml-2">{dimensionDisplayNames[dim]}</Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Chart Type Selector */}
          {suggestedCharts.length > 0 && (
            <div className="mb-4">
              <Label htmlFor="chart-type" className="block mb-2">Select Chart Type</Label>
              <Select
                value={selectedChartType || ""}
                onValueChange={(value) => setSelectedChartType(value as ChartType)}
              >
                <SelectTrigger id="chart-type">
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  {suggestedCharts.map((chartType) => (
                    <SelectItem key={chartType} value={chartType}>{chartType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Generate Chart Button
          <Button 
            className="w-full mt-4" 
            disabled={!selectedChartType || loading || !timeDimension || !locationDimension || categoryDimensions.length === 0 || data.length === 0}
            onClick={() => {
              // Force re-render of the chart by creating a new chart option
              const chartOption = generateChartOption(data, timeDimension, locationDimension, categoryDimensions, selectedChartType, dateRange, timeGranularity);
              if (chartRefs.mainChart) {
                chartRefs.mainChart.setOption(chartOption, true);
              }
              
              // Scroll to main chart area
              const chartElement = document.getElementById('main-chart-area');
              if (chartElement) {
                chartElement.scrollIntoView({ behavior: 'smooth' });
              }
              
              console.log('Generated chart with options:', chartOption);
            }}
          >
            Generate Chart
          </Button> */}
          
          {/* Export Button */}
          <Button 
            className="w-full mt-2" 
            variant="outline"
            disabled={!selectedChartType || loading || !data.length}
            onClick={() => exportChart('mainChart')}
          >
            <DownloadIcon className="mr-2 h-4 w-4" /> Export Chart
          </Button>
        </div>
        
        {/* Chart Display Area */}
        <div className="w-full md:w-2/3 bg-card rounded-lg p-4 border flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <p>Loading data...</p>
              </div>
            ) : error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : isTrafficEventsData === false || (isTrafficEventsData === null && data.length === 0) ? (
              <div className="h-full flex items-center justify-center flex-col gap-6">
                <div className="text-center max-w-md">
                  <h3 className="text-lg font-medium mb-2">Chart View Not Available</h3>
                  <p className="text-muted-foreground text-sm">
                    Chart visualization is currently only implemented for Traffic Events data. Please select Traffic Events dataset from the filters panel.
                  </p>
                </div>
              </div>
            ) : data.length === 0 && isTrafficEventsData === true ? (
              <div className="h-full flex items-center justify-center flex-col gap-6">
                <div className="text-center max-w-md">
                  <h3 className="text-lg font-medium mb-2">No data available</h3>
                  <p className="text-muted-foreground text-sm">
                    Please use the filters panel on the left and click "Apply Filters" to load data.
                  </p>
                </div>
                
                {/* Chart tabs placeholder */}
                <div className="w-full max-w-3xl border rounded-lg p-6 bg-card">
                  {/* Mock tab navigation */}
                  <div className="flex items-center mb-4 border-b pb-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="mr-1 whitespace-nowrap"
                    >
                      Chart 1
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 ml-auto"
                      disabled
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      <span>Add Chart</span>
                    </Button>
                  </div>
                  
                  {/* Empty chart placeholder */}
                  <div className="h-[350px] flex items-center justify-center flex-col gap-3 border-2 border-dashed rounded-md bg-muted/20">
                    <div className="w-16 h-16 rounded-full bg-muted/40 flex items-center justify-center">
                      <BarChartIcon className="h-8 w-8 text-muted-foreground/60" />
                    </div>
                    <p className="text-muted-foreground text-center max-w-xs">
                      Your visualization will appear here after applying filters
                    </p>
                  </div>
                  
                  {/* Instructions */}
                  <div className="mt-4 bg-muted/20 p-3 rounded-md border border-dashed">
                    <h4 className="text-sm font-medium mb-1">Getting Started</h4>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Select a time dimension and date range</li>
                      <li>Choose location and category filters (optional)</li>
                      <li>Select a chart type from the dropdown</li>
                      <li>Click "Apply Filters" to load your data</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full space-y-6">
                
                {/* Chart Tabs Navigation */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center overflow-x-auto pb-1 scrollbar-hide" style={{ maxWidth: 'calc(100% - 100px)' }}>
                    {userCharts.map((chart) => (
                      <div key={chart.id} className="relative group mr-1">
                        {editingChartId === chart.id ? (
                          <div className="flex items-center">
                            <input
                              type="text"
                              value={editingChartTitle}
                              onChange={(e) => setEditingChartTitle(e.target.value)}
                              onBlur={saveChartTitle}
                              onKeyDown={handleTitleKeyPress}
                              autoFocus
                              className="h-8 px-3 py-1 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary w-32"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Button
                              variant={activeChartId === chart.id ? 'default' : 'outline'}
                              size="sm"
                              className={`whitespace-nowrap ${activeChartId === chart.id ? '' : 'text-muted-foreground'}`}
                              onClick={() => setActiveChartId(chart.id)}
                            >
                              {chart.title}
                            </Button>
                            {activeChartId === chart.id && (
                              <div className="flex items-center ml-1">
                                <div 
                                  className="h-5 w-5 p-0 flex items-center justify-center cursor-pointer hover:bg-muted rounded-sm"
                                  onClick={() => startEditingChartTitle(chart.id)}
                                  title="Edit chart name"
                                >
                                  <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground">
                                    <path d="M11.8536 1.14645C11.6583 0.951184 11.3417 0.951184 11.1465 1.14645L3.71455 8.57836C3.62459 8.66832 3.55263 8.77461 3.50251 8.89155L2.04044 12.303C1.9599 12.491 2.00189 12.709 2.14646 12.8536C2.29103 12.9981 2.50905 13.0401 2.69697 12.9596L6.10847 11.4975C6.2254 11.4474 6.3317 11.3754 6.42166 11.2855L13.8536 3.85355C14.0488 3.65829 14.0488 3.34171 13.8536 3.14645L11.8536 1.14645ZM4.42166 9.28547L11.5 2.20711L12.7929 3.5L5.71455 10.5784L4.21924 11.2192L3.78081 10.7808L4.42166 9.28547Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                                  </svg>
                                </div>
                                <div 
                                  className="h-5 w-5 p-0 flex items-center justify-center cursor-pointer hover:bg-destructive/10 hover:text-destructive rounded-sm"
                                  onClick={() => confirmDeleteChart(chart.id)}
                                  title="Delete chart"
                                >
                                  <Cross2Icon className="h-3 w-3" />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                    onClick={addNewChart}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    <span>Add Chart</span>
                  </Button>
                </div>
                
                {/* Delete Chart Confirmation Dialog */}
                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Delete Chart</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete this chart? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-end space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                      <Button variant="destructive" onClick={deleteChart}>Delete</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Active Chart Area */}
                <Card id="active-chart-area" className="mb-4">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-2">
                    <div className="text-sm font-medium">
                      {/* Chart controls label */}
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => toggleChartControls('mainChart')}
                      >
                        <MixerHorizontalIcon className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => toggleExpandChart('mainChart')}
                      >
                        <EnterFullScreenIcon className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0"
                        onClick={() => exportChart('mainChart')}
                      >
                        <DownloadIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  
                  {showChartControls.mainChart && (
                    <div className="px-3 py-1 bg-muted/50 border-t border-b">
                      <div className="flex flex-wrap gap-2 items-center">
                        <div>
                          <Label className="text-xs">Color Scheme</Label>
                          <Select
                            value={chartCustomization.colorScheme}
                            onValueChange={(value: string) => {
                              setChartCustomization(prev => ({ ...prev, colorScheme: value }));
                              setTimeout(() => applyChartCustomization('mainChart'), 0);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="warm">Warm</SelectItem>
                              <SelectItem value="cool">Cool</SelectItem>
                              <SelectItem value="traffic">Traffic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-xs">Aggregation</Label>
                          <Select
                            value={chartCustomization.aggregation || 'count'}
                            onValueChange={(value: 'count' | 'sum' | 'average') => {
                              setChartCustomization(prev => ({ ...prev, aggregation: value }));
                              setTimeout(() => applyChartCustomization('mainChart'), 0);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="count">Count</SelectItem>
                              <SelectItem value="sum">Sum</SelectItem>
                              <SelectItem value="average">Average</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <CardContent className="p-0 min-h-[350px]">
                    {/* Chart rendering based on active chart */}
                    {(() => {
                      const activeChart = userCharts.find(chart => chart.id === activeChartId);
                      if (activeChart?.type) {
                        return (
                          <ReactECharts 
                            option={generateChartOption(
                              data, 
                              activeChart.timeDimension, 
                              activeChart.locationDimension, 
                              activeChart.categoryDimensions, 
                              activeChart.type, 
                              dateRange, 
                              activeChart.timeGranularity
                            )}
                            style={{ height: '100%', minHeight: '350px' }}
                            opts={{ renderer: 'canvas' }}
                            onChartReady={(chart) => {
                              setChartRefs(prev => ({ ...prev, mainChart: chart }));
                            }}
                          />
                        );
                      } else {
                        return (
                          <div className="h-[400px] flex items-center justify-center">
                            <p className="text-muted-foreground">Select dimensions and chart type to generate a chart</p>
                          </div>
                        );
                      }
                    })()
                    }
                  </CardContent>
                </Card>
                {/* Chart instructions */}
                <div className="pt-2">
                  <div className="bg-muted/40 rounded-md p-3 border border-dashed">
                    <h3 className="text-sm font-semibold mb-1">Working with Charts</h3>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      <li>Use the tabs above to switch between your saved charts</li>
                      <li>Click <span className="font-medium">Add Chart</span> to create a new chart with current settings</li>
                      <li>Each chart maintains its own configuration settings</li>
                      <li>Use the <MixerHorizontalIcon className="h-3 w-3 inline"/> button to customize chart appearance</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
