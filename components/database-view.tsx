"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download, Copy, Check, ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null';
  width?: string;
  formatter?: (value: any, row: any) => React.ReactNode;
  sortable?: boolean;
  visible?: boolean;
  priority?: number;
}

interface DatabaseViewProps {
  data?: any;
  dataExtractor?: (data: any) => Record<string, any[]>;
  title?: string;
  description?: string;
  initialDataset?: string;
  customColumns?: Record<string, TableColumn[]>;
  dataTransformer?: (data: any[], datasetName: string) => any[];
}

export function DatabaseView({ 
  data, 
  dataExtractor, 
  title = 'Search Results',
  description = 'View and explore data from the API',
  initialDataset,
  customColumns,
  dataTransformer
}: DatabaseViewProps) {
  // Basic UI state
  const [activeTab, setActiveTab] = useState<string>('table');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState<boolean>(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  
  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Extract datasets from the data
  const extractedData = useMemo(() => {
    setIsLoading(true);
    
    try {
      if (!data) {
        setIsLoading(false);
        return {};
      }
      
      // Use custom extractor if provided
      if (dataExtractor) {
        const result = dataExtractor(data);
        setIsLoading(false);
        return result;
      }
      
      // Default extraction for 511 API format
      const datasets: Record<string, any[]> = {};
      
      if (data.results && Array.isArray(data.results)) {
        // Process each result object
        data.results.forEach((result: any) => {
          if (typeof result !== 'object' || result === null) return;
          
          // Extract datasets from each result object
          Object.entries(result).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              if (!datasets[key]) {
                datasets[key] = [];
              }
              datasets[key] = [...datasets[key], ...value];
            }
          });
        });
      }
      
      // Log extracted datasets
      console.log('Extracted datasets:', Object.keys(datasets));
      Object.entries(datasets).forEach(([key, value]) => {
        console.log(`Dataset ${key} has ${value.length} items`);
      });
      
      setIsLoading(false);
      return datasets;
    } catch (error) {
      console.error('Error extracting data:', error);
      setIsLoading(false);
      return {};
    }
  }, [data, dataExtractor]);
  
  // Get available dataset names
  const datasets = useMemo(() => {
    return Object.keys(extractedData);
  }, [extractedData]);
  
  // Initialize selected dataset
  useEffect(() => {
    if (datasets.length > 0 && (!selectedDataset || !datasets.includes(selectedDataset))) {
      if (initialDataset && datasets.includes(initialDataset)) {
        setSelectedDataset(initialDataset);
      } else {
        setSelectedDataset(datasets[0]);
      }
      setCurrentPage(1);
    }
  }, [datasets, selectedDataset, initialDataset]);
  
  // Get the data for the selected dataset
  const tableData = useMemo(() => {
    if (!selectedDataset || !extractedData[selectedDataset]) {
      return [];
    }
    
    const items = extractedData[selectedDataset];
    console.log(`Table data for ${selectedDataset}: ${items.length} items`);
    
    // Apply data transformer if provided
    if (dataTransformer && items.length > 0) {
      return dataTransformer(items, selectedDataset);
    }
    
    return items;
  }, [extractedData, selectedDataset, dataTransformer]);
  
  // Determine columns based on the dataset
  const columns = useMemo<TableColumn[]>(() => {
    // Use custom columns if provided
    if (customColumns && selectedDataset && customColumns[selectedDataset]) {
      return customColumns[selectedDataset];
    }
    
    if (tableData.length === 0) return [];
    
    // Auto-detect columns from the first item
    const firstItem = tableData[0];
    const detectedColumns: TableColumn[] = Object.keys(firstItem).map(key => {
      const value = firstItem[key];
      let type: TableColumn['type'] = 'string';
      
      if (value === null) type = 'null';
      else if (typeof value === 'number') type = 'number';
      else if (typeof value === 'boolean') type = 'boolean';
      else if (typeof value === 'object') {
        type = Array.isArray(value) ? 'array' : 'object';
      }
      else if (typeof value === 'string') {
        // Check for ISO date format
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
          type = 'date';
        }
        // Check for other common date formats
        else if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
          type = 'date';
        }
      }
      
      // Determine column priority based on key name
      let priority = 5; // Default priority
      let visible = true; // Default visibility
      
      // Check if column should be hidden by default
      const keyLower = key.toLowerCase();
      
      // Hide ID columns by default
      if (keyLower === 'id' || keyLower.endsWith('_id') || keyLower.includes('uuid')) {
        visible = false;
      }
      // Hide coordinate columns by default
      else if (keyLower.includes('coord') || keyLower.includes('latitude') || 
               keyLower.includes('longitude') || keyLower.includes('lat') || 
               keyLower.includes('lng') || keyLower.includes('lon')) {
        visible = false;
      }
      else if (keyLower.includes('additional') || keyLower.includes('retrieval')) {
        visible = false;
      }
      
      // Higher priority for common important fields
      if (['name', 'title', 'type', 'status', 'date', 'time', 'category'].includes(keyLower)) {
        priority = 1;
      }
      // Medium priority for descriptive fields
      else if (keyLower.includes('county') || keyLower.includes('city')) {
        priority = 6;
      }
      else if (keyLower.includes('location_category')){
        priority = 5;
      }
      else if (keyLower.includes('region')){
        priority = 5.5;
      }
      else if (keyLower.includes('subdistrict') || keyLower.includes('unit')) {
        priority = 7;
      }
      else if (keyLower.includes('district')) {
        priority = 6.5;
      }
      // Lower priority for technical or internal fields
      else if (key.startsWith('_') || keyLower.includes('metadata') || keyLower.includes('raw')) {
        priority = 10;
        visible = false;
      }
      
      return {
        key,
        label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        type,
        sortable: true,
        visible: visible && priority <= 8, // Apply both visibility rules
        priority,
        width: undefined
      };
    });
    
    // Sort columns by priority
    return detectedColumns.sort((a, b) => (a.priority || 5) - (b.priority || 5));
  }, [tableData, customColumns, selectedDataset]);
  
  // Initialize visible columns when columns change
  useEffect(() => {
    if (columns.length > 0) {
      setVisibleColumns(columns.filter(col => col.visible !== false).map(col => col.key));
    }
  }, [columns]);
  
  // Get filtered columns based on visibility
  const filteredColumns = useMemo(() => {
    return columns.filter(col => visibleColumns.includes(col.key));
  }, [columns, visibleColumns]);
  
  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return tableData;
    
    const term = searchTerm.toLowerCase();
    return tableData.filter(item => {
      return Object.values(item).some(value => {
        if (value === null) return false;
        return String(value).toLowerCase().includes(term);
      });
    });
  }, [tableData, searchTerm]);
  
  // Sort data based on sort config
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      // Handle null values
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bValue === null) return sortConfig.direction === 'asc' ? 1 : -1;
      
      // Compare based on type
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Default comparison
      return sortConfig.direction === 'asc'
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });
  }, [filteredData, sortConfig]);
  
  // Paginate data
  const paginatedData = useMemo(() => {
    console.log(`Pagination: page ${currentPage}, size ${pageSize}, total items ${sortedData.length}`);
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);
  
  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  
  // Event handlers
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc'
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };
  
  const handlePageChange = (page: number) => {
    console.log(`Changing to page ${page}`);
    setCurrentPage(page);
  };
  
  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };
  
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const copyToClipboard = (item: any) => {
    const id = item.id || Math.random().toString();
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopiedItem(id.toString());
    setTimeout(() => setCopiedItem(null), 2000);
  };
  
  const exportCSV = () => {
    if (sortedData.length === 0) return;
    
    // Only include visible columns
    const visibleColumnObjects = columns.filter(col => visibleColumns.includes(col.key));
    
    const headers = visibleColumnObjects.map(col => col.label).join(',');
    const rows = sortedData.map(item => {
      return visibleColumnObjects.map(col => {
        const value = item[col.key];
        if (value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      }).join(',');
    }).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDataset}_data.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  // Format cell value for display
  const formatCellValue = (value: any, type: TableColumn['type'], column: TableColumn, row: any) => {
    // Use custom formatter if provided
    if (column.formatter) {
      return column.formatter(value, row);
    }
    
    if (value === null) return <span className="text-gray-400 italic">null</span>;
    
    switch (type) {
      case 'date':
        try {
          const date = new Date(value);
          return date.toLocaleString();
        } catch (e) {
          return value;
        }
      case 'object':
      case 'array':
        return <span className="text-gray-800">{type === 'object' ? '{...}' : '[...]'}</span>;
      case 'boolean':
        return <span className="text-gray-800">{value.toString()}</span>;
      case 'number':
        return <span className="text-gray-800">{value}</span>;
      default:
        return <span className="text-gray-800">{value}</span>;
    }
  };
  
  // Render expanded row details
  const renderExpandedRow = (item: any) => {
    return (
      <div className="bg-gray-50 p-4 rounded-md">
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(item).map(([key, value]) => {
            const column = columns.find(col => col.key === key);
            return (
              <div key={key} className="border-b border-gray-200 pb-2">
                <div className="font-medium text-gray-700">{column?.label || key}</div>
                <div className="mt-1">
                  {value === null ? (
                    <span className="text-gray-400 italic">null</span>
                  ) : typeof value === 'object' ? (
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40 text-gray-800">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-gray-800">{String(value)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading data...</p>
        </div>
      </div>
    );
  }
  
  // No data state
  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-2">No Data Available</h3>
          <p className="text-gray-500">Please select a dataset or run a query to view data.</p>
        </div>
      </div>
    );
  }
  
  // No datasets found
  if (datasets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8 bg-gray-50 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-2">No Datasets Found</h3>
          <p className="text-gray-500">The API response doesn't contain any recognizable datasets.</p>
          <pre className="mt-4 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40 text-left text-gray-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      {/* Title at the top */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      
      {/* Controls in one row below the title */}
      <div className="flex items-center space-x-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-9 w-full"
          />
        </div>
        
        {/* Select columns button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                className="h-9 whitespace-nowrap"
              >
                <Filter className="h-4 w-4 mr-1" />
                Select columns
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Select columns to display</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Dataset selector */}
        <Select value={selectedDataset} onValueChange={(value) => {
          setSelectedDataset(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Select dataset" />
          </SelectTrigger>
          <SelectContent>
            {datasets.map(dataset => (
              <SelectItem key={dataset} value={dataset}>
                {dataset.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Export CSV button */}
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={sortedData.length === 0}
          className="h-9 whitespace-nowrap"
        >
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col">
        
        {/* Column selector */}
        {isColumnSelectorOpen && (
          <div className="mb-4 p-4 border rounded-md bg-gray-50">
            <h3 className="font-medium mb-2">Select Columns</h3>
            <div className="grid grid-cols-3 gap-2">
              {columns.map(column => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`column-${column.key}`}
                    checked={visibleColumns.includes(column.key)}
                    onCheckedChange={() => toggleColumnVisibility(column.key)}
                  />
                  <label
                    htmlFor={`column-${column.key}`}
                    className="text-sm cursor-pointer"
                  >
                    {column.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Table View */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          {tableData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                <p className="text-gray-500">This dataset contains no records.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-auto flex-1 border rounded-md" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 p-2"></th>
                      {filteredColumns.map(column => (
                        <th
                          key={column.key}
                          className={`p-2 text-left text-sm font-bold text-gray-700 ${
                            column.sortable !== false ? 'cursor-pointer' : ''
                          }`}
                          onClick={() => column.sortable !== false && handleSort(column.key)}
                          style={column.width ? { width: column.width } : undefined}
                        >
                          <div className="flex items-center">
                            <span>{column.label}</span>
                            {sortConfig?.key === column.key && (
                              <span className="ml-1">
                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="w-10 p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item, index) => {
                      const id = item.id || `row-${index}`;
                      const isExpanded = expandedRows.has(id.toString());
                      
                      return (
                        <React.Fragment key={id}>
                          <tr className={`border-t ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => toggleRowExpansion(id.toString())}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                            {filteredColumns.map(column => (
                              <td key={column.key} className="p-2 text-sm">
                                {formatCellValue(item[column.key], column.type, column, item)}
                              </td>
                            ))}
                            <td className="p-2 text-center">
                              <button
                                onClick={() => copyToClipboard(item)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {copiedItem === id.toString() ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={filteredColumns.length + 2} className="p-0">
                                <div className="p-4 bg-gray-50 border-t border-b">
                                  {renderExpandedRow(item)}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {paginatedData.length} of {sortedData.length} items
                </div>
                
                <div className="flex items-center space-x-2">
                  <Select
                    value={pageSize.toString()}
                    onValueChange={value => {
                      const newSize = parseInt(value);
                      setPageSize(newSize);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="Page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1 || sortedData.length === 0}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || sortedData.length === 0}
                    >
                      Prev
                    </Button>
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || sortedData.length === 0}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages || sortedData.length === 0}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
