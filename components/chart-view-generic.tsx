"use client"

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface ChartViewProps {
  data?: any;
}

interface DatasetItem {
  id: number;
  route?: string;
  [key: string]: any; // Allow any additional fields
}

interface ChartData {
  name: string;
  value: number;
}

export function ChartView({ data }: ChartViewProps) {
  // State for tracking available datasets
  const [datasetTypes, setDatasetTypes] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [hasData, setHasData] = useState<boolean>(false);
  
  // Generic data states
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState<ChartData[]>([]);
  const [itemsByStatus, setItemsByStatus] = useState<ChartData[]>([]);
  const [itemsByRoute, setItemsByRoute] = useState<ChartData[]>([]);
  const [itemsByDay, setItemsByDay] = useState<{date: string; count: number}[]>([]);
  
  // Chart refs
  const pieChartRef = useRef<SVGSVGElement | null>(null);
  const barChartRef = useRef<SVGSVGElement | null>(null);
  const routeChartRef = useRef<SVGSVGElement | null>(null);
  const timelineRef = useRef<SVGSVGElement | null>(null);
  
  // Dataset-specific configuration
  const datasetConfig: Record<string, {
    categoryField: string;
    statusField?: string;
    dateField: string;
    title: string;
    categoryTitle: string;
    statusTitle?: string;
  }> = {
    traffic_events: {
      categoryField: 'event_type',
      statusField: 'event_status',
      dateField: 'date_start',
      title: 'Traffic Event Analysis',
      categoryTitle: 'Events by Type',
      statusTitle: 'Events by Status'
    },
    rest_area_info: {
      categoryField: 'site_area_status',
      dateField: 'data_retrieval_timestamp',
      title: 'Rest Area Analysis',
      categoryTitle: 'Rest Areas by Status'
    },
    dynamic_message_sign_info: {
      categoryField: 'priority',
      dateField: 'date_start',
      title: 'Dynamic Message Sign Analysis',
      categoryTitle: 'Signs by Priority'
    },
    lane_blockage_info: {
      categoryField: 'blockage_type',
      statusField: 'blockage_status',
      dateField: 'date_start',
      title: 'Lane Blockage Analysis',
      categoryTitle: 'Blockages by Type',
      statusTitle: 'Blockages by Status'
    },
    weather_info: {
      categoryField: 'approach_road_condition',
      dateField: 'data_retrieval_timestamp',
      title: 'Weather Information Analysis',
      categoryTitle: 'Weather by Road Condition'
    },
    social_events: {
      categoryField: 'event_category',
      statusField: 'event_status',
      dateField: 'date_start',
      title: 'Social Event Analysis',
      categoryTitle: 'Events by Category',
      statusTitle: 'Events by Status'
    },
    variable_speed_limit_sign_info: {
      categoryField: 'speed_limit_value',
      dateField: 'data_retrieval_timestamp',
      title: 'Variable Speed Limit Analysis',
      categoryTitle: 'Signs by Speed Limit'
    },
    travel_time_system_info: {
      categoryField: 'route',
      dateField: 'date_start',
      title: 'Travel Time Analysis',
      categoryTitle: 'Travel Times by Route'
    },
    traffic_parking_info: {
      categoryField: 'site_area_status',
      dateField: 'data_retrieval_timestamp',
      title: 'Truck Parking Analysis',
      categoryTitle: 'Parking Areas by Status'
    }
  };

  // Process data when it changes
  useEffect(() => {
    if (data && data.results) {
      // Find all available dataset types in the response
      const availableDatasets: string[] = [];
      data.results.forEach((result: any) => {
        Object.keys(result).forEach(key => {
          if (Array.isArray(result[key]) && result[key].length > 0 && !availableDatasets.includes(key)) {
            availableDatasets.push(key);
          }
        });
      });
      
      setDatasetTypes(availableDatasets);
      
      // If we have available datasets, select the first one by default
      if (availableDatasets.length > 0) {
        setSelectedDataset(availableDatasets[0]);
      } else {
        setHasData(false);
      }
    } else {
      setHasData(false);
    }
  }, [data]);

  // Process selected dataset
  useEffect(() => {
    if (!selectedDataset || !data || !data.results) {
      setHasData(false);
      return;
    }
    
    // Extract items from the selected dataset
    let allItems: DatasetItem[] = [];
    
    data.results.forEach((result: any) => {
      if (result[selectedDataset] && Array.isArray(result[selectedDataset])) {
        allItems = [...allItems, ...result[selectedDataset]];
      }
    });
    
    if (allItems.length > 0) {
      setHasData(true);
      setItems(allItems);
      
      // Process data for charts based on the dataset configuration
      processItemData(allItems, selectedDataset);
    } else {
      setHasData(false);
    }
  }, [selectedDataset, data]);

  // Process item data for different charts
  const processItemData = (items: DatasetItem[], datasetType: string) => {
    const config = datasetConfig[datasetType] || {
      categoryField: 'id',
      dateField: 'data_retrieval_timestamp',
      title: 'Data Analysis',
      categoryTitle: 'Items by Category'
    };
    
    // Count items by category
    const categoryCount = items.reduce((acc: {[key: string]: number}, item) => {
      const category = item[config.categoryField]?.toString() || 'Unknown';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    // Count items by status if applicable
    let statusCount: {[key: string]: number} = {};
    if (config.statusField) {
      statusCount = items.reduce((acc: {[key: string]: number}, item) => {
        const status = item[config.statusField as string]?.toString() || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
    }
    
    // Count items by route
    const routeCount = items.reduce((acc: {[key: string]: number}, item) => {
      const route = item.route?.toString() || 'Unknown';
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {});
    
    // Count items by day
    const dayCount = items.reduce((acc: {[key: string]: number}, item) => {
      if (item[config.dateField]) {
        const date = item[config.dateField].split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {});
    
    // Convert to array format for D3
    const categoryData = Object.entries(categoryCount).map(([name, value]) => ({ name, value }));
    const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));
    
    // Sort route data by count and take top 10
    const routeData = Object.entries(routeCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
      
    // Sort day data chronologically
    const dayData = Object.entries(dayCount)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setItemsByCategory(categoryData);
    setItemsByStatus(statusData);
    setItemsByRoute(routeData);
    setItemsByDay(dayData);
  };

  // Render pie chart for item categories
  useEffect(() => {
    if (itemsByCategory.length > 0 && pieChartRef.current && selectedDataset) {
      const config = datasetConfig[selectedDataset] || {
        categoryTitle: 'Items by Category'
      };
      
      const svg = d3.select(pieChartRef.current);
      svg.selectAll('*').remove(); // Clear previous chart
      
      const width = 300;
      const height = 300;
      const radius = Math.min(width, height) / 2;
      
      const color = d3.scaleOrdinal(d3.schemeCategory10);
      
      const pie = d3.pie<ChartData>()
        .value(d => d.value)
        .sort(null);
      
      const arc = d3.arc<d3.PieArcDatum<ChartData>>()
        .innerRadius(0)
        .outerRadius(radius - 10);
      
      const labelArc = d3.arc<d3.PieArcDatum<ChartData>>()
        .innerRadius(radius - 80)
        .outerRadius(radius - 80);
      
      const g = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);
      
      const arcs = g.selectAll('.arc')
        .data(pie(itemsByCategory))
        .enter()
        .append('g')
        .attr('class', 'arc');
      
      arcs.append('path')
        .attr('d', arc)
        .attr('fill', (d, i) => color(i.toString()))
        .attr('stroke', 'white')
        .style('stroke-width', '2px');
      
      // Add labels
      arcs.append('text')
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('dy', '.35em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#fff')
        .text(d => d.data.value > 5 ? d.data.name : '');
      
      // Add legend
      const legend = svg.append('g')
        .attr('transform', `translate(${width + 20}, 20)`)
        .selectAll('.legend')
        .data(itemsByCategory)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`);
      
      legend.append('rect')
        .attr('width', 18)
        .attr('height', 18)
        .style('fill', (d, i) => color(i.toString()));
      
      legend.append('text')
        .attr('x', 24)
        .attr('y', 9)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .text(d => `${d.name} (${d.value})`);
    }
  }, [itemsByCategory, selectedDataset]);

  // Render bar chart for item status
  useEffect(() => {
    if (itemsByStatus.length > 0 && barChartRef.current && selectedDataset) {
      const config = datasetConfig[selectedDataset] || {
        statusTitle: 'Items by Status'
      };
      
      const svg = d3.select(barChartRef.current);
      svg.selectAll('*').remove(); // Clear previous chart
      
      const margin = { top: 20, right: 30, bottom: 40, left: 60 };
      const width = 400 - margin.left - margin.right;
      const height = 300 - margin.top - margin.bottom;
      
      const x = d3.scaleBand()
        .domain(itemsByStatus.map(d => d.name))
        .range([0, width])
        .padding(0.1);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(itemsByStatus, d => d.value) || 0])
        .nice()
        .range([height, 0]);
      
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Add x axis
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
      
      // Add y axis
      g.append('g')
        .call(d3.axisLeft(y));
      
      // Add bars
      g.selectAll('.bar')
        .data(itemsByStatus)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.name) || 0)
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.value))
        .attr('fill', '#4299e1'); // Blue color
      
      // Add labels above bars
      g.selectAll('.label')
        .data(itemsByStatus)
        .enter().append('text')
        .attr('class', 'label')
        .attr('x', d => (x(d.name) || 0) + x.bandwidth() / 2)
        .attr('y', d => y(d.value) - 5)
        .attr('text-anchor', 'middle')
        .text(d => d.value);
    }
  }, [itemsByStatus, selectedDataset]);

  // Render horizontal bar chart for routes
  useEffect(() => {
    if (itemsByRoute.length > 0 && routeChartRef.current) {
      const svg = d3.select(routeChartRef.current);
      svg.selectAll('*').remove(); // Clear previous chart
      
      const margin = { top: 20, right: 30, bottom: 40, left: 100 };
      const width = 400 - margin.left - margin.right;
      const height = 300 - margin.top - margin.bottom;
      
      const y = d3.scaleBand()
        .domain(itemsByRoute.map(d => d.name))
        .range([0, height])
        .padding(0.1);
      
      const x = d3.scaleLinear()
        .domain([0, d3.max(itemsByRoute, d => d.value) || 0])
        .nice()
        .range([0, width]);
      
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Add y axis
      g.append('g')
        .call(d3.axisLeft(y));
      
      // Add x axis
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));
      
      // Add bars
      g.selectAll('.bar')
        .data(itemsByRoute)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('y', d => y(d.name) || 0)
        .attr('x', 0)
        .attr('height', y.bandwidth())
        .attr('width', d => x(d.value))
        .attr('fill', '#48bb78'); // Green color
      
      // Add labels
      g.selectAll('.label')
        .data(itemsByRoute)
        .enter().append('text')
        .attr('class', 'label')
        .attr('y', d => (y(d.name) || 0) + y.bandwidth() / 2)
        .attr('x', d => x(d.value) + 5)
        .attr('dy', '.35em')
        .text(d => d.value);
    }
  }, [itemsByRoute]);

  // Render timeline chart
  useEffect(() => {
    if (itemsByDay.length > 0 && timelineRef.current) {
      const svg = d3.select(timelineRef.current);
      svg.selectAll('*').remove(); // Clear previous chart
      
      const margin = { top: 20, right: 30, bottom: 50, left: 60 };
      const width = 800 - margin.left - margin.right;
      const height = 300 - margin.top - margin.bottom;
      
      const x = d3.scaleBand()
        .domain(itemsByDay.map(d => d.date))
        .range([0, width])
        .padding(0.1);
      
      const y = d3.scaleLinear()
        .domain([0, d3.max(itemsByDay, d => d.count) || 0])
        .nice()
        .range([height, 0]);
      
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      // Add x axis
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
      
      // Add y axis
      g.append('g')
        .call(d3.axisLeft(y));
      
      // Add area
      const area = d3.area<{date: string; count: number}>()
        .x(d => (x(d.date) || 0) + x.bandwidth() / 2)
        .y0(height)
        .y1(d => y(d.count));
      
      g.append('path')
        .datum(itemsByDay)
        .attr('fill', 'rgba(66, 153, 225, 0.5)')
        .attr('stroke', '#4299e1')
        .attr('stroke-width', 1.5)
        .attr('d', area);
      
      // Add line
      const line = d3.line<{date: string; count: number}>()
        .x(d => (x(d.date) || 0) + x.bandwidth() / 2)
        .y(d => y(d.count));
      
      g.append('path')
        .datum(itemsByDay)
        .attr('fill', 'none')
        .attr('stroke', '#2b6cb0')
        .attr('stroke-width', 2)
        .attr('d', line);
      
      // Add dots
      g.selectAll('.dot')
        .data(itemsByDay)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('cx', d => (x(d.date) || 0) + x.bandwidth() / 2)
        .attr('cy', d => y(d.count))
        .attr('r', 4)
        .attr('fill', '#2b6cb0');
    }
  }, [itemsByDay]);

  // Format dataset name for display
  const formatDatasetName = (name: string) => {
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="h-full w-full flex flex-col p-6 bg-white overflow-y-auto">
      {datasetTypes.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Dataset:
          </label>
          <select 
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
          >
            {datasetTypes.map(type => (
              <option key={type} value={type}>
                {formatDatasetName(type)}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <h2 className="text-2xl font-bold mb-6">
        {selectedDataset && datasetConfig[selectedDataset]
          ? datasetConfig[selectedDataset].title
          : 'Data Analysis'}
      </h2>
      
      {!hasData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 bg-gray-50 rounded-lg shadow-sm">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h3>
            <p className="text-gray-500">Select filters from the left panel to load data.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Item count summary */}
            <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Summary</h3>
              <p className="text-3xl font-bold text-blue-700">{items.length}</p>
              <p className="text-sm text-gray-600">
                Total {formatDatasetName(selectedDataset)}
              </p>
            </div>
            
            {/* Status breakdown if applicable */}
            {selectedDataset && datasetConfig[selectedDataset]?.statusField && itemsByStatus.length > 0 && (
              <div className="bg-green-50 p-4 rounded-lg shadow-sm">
                <h3 className="text-lg font-semibold mb-2">Status Breakdown</h3>
                <div className="flex flex-wrap gap-4">
                  {itemsByStatus.slice(0, 3).map(status => (
                    <div key={status.name}>
                      <p className="text-2xl font-bold text-green-700">
                        {status.value}
                      </p>
                      <p className="text-sm text-gray-600">{status.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Category Pie Chart */}
            {itemsByCategory.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-lg font-semibold mb-4">
                  {selectedDataset && datasetConfig[selectedDataset]
                    ? datasetConfig[selectedDataset].categoryTitle
                    : 'Items by Category'}
                </h3>
                <div className="flex justify-center">
                  <svg ref={pieChartRef} width="400" height="300"></svg>
                </div>
              </div>
            )}
            
            {/* Status Bar Chart */}
            {itemsByStatus.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-lg font-semibold mb-4">
                  {selectedDataset && datasetConfig[selectedDataset]?.statusTitle
                    ? datasetConfig[selectedDataset].statusTitle
                    : 'Items by Status'}
                </h3>
                <div className="flex justify-center">
                  <svg ref={barChartRef} width="400" height="300"></svg>
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Top Routes */}
            {itemsByRoute.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-lg font-semibold mb-4">Top Routes</h3>
                <div className="flex justify-center">
                  <svg ref={routeChartRef} width="400" height="300"></svg>
                </div>
              </div>
            )}
            
            {/* Timeline */}
            {itemsByDay.length > 0 && (
              <div className="bg-white p-4 rounded-lg shadow border col-span-1 lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Timeline</h3>
                <div className="flex justify-center overflow-x-auto">
                  <svg ref={timelineRef} width="800" height="300"></svg>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
