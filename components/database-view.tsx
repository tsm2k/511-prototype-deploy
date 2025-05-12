"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download, Copy, Check, ChevronDown, ChevronRight, Filter, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'null';
  /**
   * Optional width for the column
   */
  width?: string;
  /**
   * Optional formatter function to customize cell rendering
   */
  formatter?: (value: any, row: any) => React.ReactNode;
  /**
   * Whether this column should be sortable
   */
  sortable?: boolean;
  /**
   * Whether this column should be visible by default
   */
  visible?: boolean;
  /**
   * Priority for display (lower numbers are higher priority)
   */
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
  title = 'Database Explorer',
  description,
  initialDataset,
  customColumns,
  dataTransformer
}: DatabaseViewProps) {
  const [activeTab, setActiveTab] = useState<string>('table');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState<boolean>(false);
  
  // Extract available datasets from the data using custom extractor if provided
  const extractedData = useMemo(() => {
    if (!data) return {};
    
    // If a custom data extractor is provided, use it
    if (dataExtractor) {
      return dataExtractor(data);
    }
    
    // Default extraction logic - handles various common API response formats
    const extractedDatasets: Record<string, any[]> = {};
    
    // Handle standard REST API response with results array
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result: any) => {
        Object.entries(result).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            if (!extractedDatasets[key]) {
              extractedDatasets[key] = [];
            }
            extractedDatasets[key] = [...extractedDatasets[key], ...value];
          }
        });
      });
    }
    // Handle response with data directly in the root
    else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        // If it's an array, treat it as a dataset
        if (Array.isArray(value)) {
          extractedDatasets[key] = value;
        }
        // If it's an object with a 'data' or 'items' property that's an array
        else if (typeof value === 'object' && value !== null) {
          if (Array.isArray((value as any).data)) {
            extractedDatasets[key] = (value as any).data;
          } else if (Array.isArray((value as any).items)) {
            extractedDatasets[key] = (value as any).items;
          }
        }
      });
    }
    
    return extractedDatasets;
  }, [data, dataExtractor]);
  
  // Get dataset names from extracted data
  const datasets = useMemo(() => {
    return Object.keys(extractedData);
  }, [extractedData]);
  
  // Set the initial dataset when datasets change
  useEffect(() => {
    if (datasets.length > 0 && !selectedDataset) {
      // Use the provided initial dataset if it exists in the available datasets
      if (initialDataset && datasets.includes(initialDataset)) {
        setSelectedDataset(initialDataset);
      } else {
        setSelectedDataset(datasets[0]);
      }
    }
  }, [datasets, selectedDataset, initialDataset]);
  
  // Get table data for the selected dataset
  const tableData = useMemo(() => {
    if (!extractedData || !selectedDataset) return [];
    
    const items = extractedData[selectedDataset] || [];
    
    // Apply data transformer if provided
    if (dataTransformer && items.length > 0) {
      return dataTransformer(items, selectedDataset);
    }
    
    return items;
  }, [extractedData, selectedDataset, dataTransformer]);
  
  // Determine columns based on the dataset
  const columns = useMemo<TableColumn[]>(() => {
    // If custom columns are provided for this dataset, use them
    if (customColumns && customColumns[selectedDataset]) {
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
      
      // Higher priority for common important fields
      if (['id', 'name', 'title', 'type', 'status', 'date', 'time', 'category'].includes(key.toLowerCase())) {
        priority = 1;
      }
      // Medium priority for descriptive fields
      else if (key.toLowerCase().includes('description') || key.toLowerCase().includes('summary')) {
        priority = 3;
      }
      // Lower priority for technical or internal fields
      else if (key.startsWith('_') || key.includes('metadata') || key.includes('raw')) {
        priority = 10;
      }
      
      return {
        key,
        label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        type,
        sortable: true,
        visible: priority < 8, // Hide very low priority columns by default
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
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);
  
  // Calculate total pages
  const totalPages = Math.ceil(sortedData.length / pageSize);
  
  // Handle sort
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
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  // Copy to clipboard
  const copyToClipboard = (item: any) => {
    const id = item.id || Math.random().toString();
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopiedItem(id.toString());
    setTimeout(() => setCopiedItem(null), 2000);
  };
  
  // Export data as CSV
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
  
  // Toggle row expansion
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
  
  // Toggle column visibility
  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };
  
  // Format cell value for display
  const formatCellValue = (value: any, type: TableColumn['type'], column: any, row: any) => {
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
        return <span className="text-blue-600">{type === 'object' ? '{...}' : '[...]'}</span>;
      case 'boolean':
        return <span className="text-purple-600">{value.toString()}</span>;
      case 'number':
        return <span className="text-blue-600">{value}</span>;
      default:
        return value;
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
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <span>{String(value)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Get filtered columns based on visibility
  const filteredColumns = useMemo(() => {
    return columns.filter(col => visibleColumns.includes(col.key)) as TableColumn[];
  }, [columns, visibleColumns]);
  
  // Render JSON view
  const renderJsonView = () => {
    return (
      <div className="bg-gray-50 rounded-lg p-4 overflow-auto h-full">
        <pre className="text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  };
  
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
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-gray-500 text-sm">{description}</p>}
          {!description && <p className="text-gray-500 text-sm">View and explore data from the API</p>}
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={selectedDataset} onValueChange={setSelectedDataset}>
            <SelectTrigger className="w-[200px]">
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={sortedData.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 w-[200px]"
              />
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select columns to display</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
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
        
        <TabsContent value="table" className="flex-1 overflow-hidden flex flex-col">
          {tableData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                <p className="text-gray-500">This dataset contains no records.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-auto flex-1 border rounded-md">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="w-10 p-2"></th>
                      {filteredColumns.map(column => {
                        // Safely handle column properties
                        const columnStyle: Record<string, string> = {};
                        if ('width' in column && column.width) {
                          columnStyle['width'] = column.width;
                        }
                        
                        return (
                          <th
                            key={column.key}
                            className={`p-2 text-left text-sm font-medium text-gray-600 ${
                              column.sortable !== false ? 'cursor-pointer' : ''
                            }`}
                            onClick={() => column.sortable !== false && handleSort(column.key)}
                            style={columnStyle}
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
                      );
                      })}
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
              
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Showing {paginatedData.length} of {sortedData.length} items
                </div>
                
                <div className="flex items-center space-x-2">
                  <Select
                    value={pageSize.toString()}
                    onValueChange={value => setPageSize(parseInt(value))}
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
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
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
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>
        
        <TabsContent value="json" className="flex-1 overflow-hidden">
          {renderJsonView()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
