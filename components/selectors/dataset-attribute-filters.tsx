"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, X, Check, ChevronsUpDown } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AttributeFilter } from "@/components/selectors/attribute-filter"
import { AttributeRangeFilter } from "@/components/selectors/attribute-range-filter"
import { DateAwareAttributeFilter } from "@/components/selectors/date-aware-attribute-filter"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  fetchDatasetAttributesMetadata, 
  fetchDataSourcesMetadata,
  fetchAttributeFilterValues,
  type DatasetAttributeMetadata, 
  type DataSourceMetadata 
} from "@/services/api"
import { TimeframeSelection } from "./timeline-selector"

interface DatasetAttributeFiltersProps {
  selectedDatasets: string[];
  onFilterChange: (datasetId: string, attributeName: string, values: string[]) => void;
  selectedFilters: Record<string, Record<string, string[]>>;
  onSelectedDatasetsChange?: (datasets: string[]) => void;
  timeframeSelections?: TimeframeSelection[];
}

// Extended attribute interface to include datasource information
interface AttributeWithDataSource extends DatasetAttributeMetadata {
  datasource_name: string;
  datasource_tablename: string;
  attribute_ui_priority: number;
}

// Interface for the IntegerDropdownMultiselect component
interface IntegerDropdownMultiselectProps {
  attributeName?: string;
  attributeColumnName: string;
  tableName: string;
  onFilterChange: (columnName: string, values: string[]) => void;
  selectedValues?: string[];
}

// Dropdown multiselector component for integer attributes with 8 or fewer values
function IntegerDropdownMultiselect({
  attributeName,
  attributeColumnName,
  tableName,
  onFilterChange,
  selectedValues = []
}: IntegerDropdownMultiselectProps) {
  const [availableValues, setAvailableValues] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(selectedValues);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Fetch available values for this attribute
  useEffect(() => {
    const fetchValues = async () => {
      setIsLoading(true);
      try {
        const values = await fetchAttributeFilterValues(tableName, [attributeColumnName]);
        if (values && values[attributeColumnName]) {
          setAvailableValues(values[attributeColumnName]);
          setError(null);
        } else {
          setError("No values found for this attribute");
          setAvailableValues([]);
        }
      } catch (err) {
        setError("Failed to fetch attribute values");
        console.error(err);
        setAvailableValues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchValues();
  }, [tableName, attributeColumnName]);

  // Sync with parent component's selectedValues
  useEffect(() => {
    setSelected(selectedValues);
  }, [selectedValues]);

  // Update parent component when selection changes
  const updateParent = (newSelection: string[]) => {
    setSelected(newSelection);
    onFilterChange(attributeColumnName, newSelection);
  };

  // Handle selection of a value
  const handleSelect = (value: string) => {
    const newSelection = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    updateParent(newSelection);
  };

  // Handle select/deselect all
  const handleSelectAll = () => {
    updateParent(availableValues);
  };

  const handleDeselectAll = () => {
    updateParent([]);
  };

  // Determine if all values are selected
  const allSelected = availableValues.length > 0 && 
    availableValues.every(value => selected.includes(value));

  // Get a summary of selected values for display
  const getSelectionSummary = () => {
    if (selected.length === 0) {
      return "Select values...";
    }
    
    if (selected.length <= 2) {
      return selected.join(", ");
    }
    
    return `${selected.length} selected`;
  };

  return (
    <div className="space-y-2 w-full">
      
      {isLoading ? (
        <div className="p-2 text-center text-muted-foreground bg-gray-50 border rounded-md">
          Loading...
        </div>
      ) : error ? (
        <div className="p-2 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  <span className="truncate">{getSelectionSummary()}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search values..." />
                  <CommandEmpty>No values found.</CommandEmpty>
                  <div className="border-t px-2 py-1.5">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="flex items-center gap-1 text-xs h-8 w-full justify-start"
                      onClick={allSelected ? handleDeselectAll : handleSelectAll}
                    >
                      {allSelected ? (
                        <>
                          <X className="h-3 w-3" /> Deselect All
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3" /> Select All
                        </>
                      )}
                    </Button>
                  </div>
                  <CommandGroup className="max-h-[200px] overflow-auto">
                    {availableValues.map((value) => (
                      <CommandItem
                        key={value}
                        value={value}
                        onSelect={() => handleSelect(value)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border",
                            selected.includes(value) ? "bg-primary border-primary" : "opacity-50"
                          )}>
                            {selected.includes(value) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <span>{value}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selected.map(value => (
                <Badge 
                  key={value}
                  variant="secondary" 
                  className="px-2 py-1 flex items-center gap-1"
                >
                  <span>{value}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => handleSelect(value)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Cache for attribute values to avoid refetching - use sessionStorage for persistence across page refreshes
const attributeValuesCache: Record<string, Record<string, string[]>> = {};
const attributesCache: AttributeWithDataSource[] = [];
const dataSourcesCache: DataSourceMetadata[] = [];
const attributeValueCountsCache: Record<string, Record<string, number>> = {};
const datasetDisplayNamesCache: Record<string, string> = {};
let isDataLoaded = false;

// Initialize caches from sessionStorage if available
try {
  if (typeof window !== 'undefined') {
    const storedAttributes = sessionStorage.getItem('attributesCache');
    const storedDataSources = sessionStorage.getItem('dataSourcesCache');
    const storedValueCounts = sessionStorage.getItem('attributeValueCountsCache');
    const storedDisplayNames = sessionStorage.getItem('datasetDisplayNamesCache');
    
    if (storedAttributes) {
      attributesCache.push(...JSON.parse(storedAttributes));
    }
    
    if (storedDataSources) {
      dataSourcesCache.push(...JSON.parse(storedDataSources));
    }
    
    if (storedValueCounts) {
      Object.assign(attributeValueCountsCache, JSON.parse(storedValueCounts));
    }
    
    if (storedDisplayNames) {
      Object.assign(datasetDisplayNamesCache, JSON.parse(storedDisplayNames));
    }
    
    // Mark as loaded if we have both attributes and data sources
    if (attributesCache.length > 0 && dataSourcesCache.length > 0) {
      isDataLoaded = true;
    }
  }
} catch (e) {
  console.error('Error loading cache from sessionStorage:', e);
}

export function DatasetAttributeFilters({
  selectedDatasets,
  onFilterChange,
  selectedFilters,
  onSelectedDatasetsChange,
  timeframeSelections = []
}: DatasetAttributeFiltersProps) {
  const [attributes, setAttributes] = useState<AttributeWithDataSource[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [attributeValueCounts, setAttributeValueCounts] = useState<Record<string, Record<string, number>>>({});
  const [datasetDisplayNames, setDatasetDisplayNames] = useState<Record<string, string>>({}); // Map dataset IDs to display names
  const [allAttributeValues, setAllAttributeValues] = useState<Record<string, Record<string, string[]>>>({});

  // Process attributes for selected datasets
  const processAttributes = useCallback((attributesWithSource: AttributeWithDataSource[], selectedDatasets: string[]) => {
    // Filter attributes for selected datasets
    const filteredAttributes = attributesWithSource.filter(attr => 
      selectedDatasets.includes(attr.datasource_tablename)
    );
    
    // Create a mapping of dataset IDs to their display names
    const displayNamesMap: Record<string, string> = {};
    filteredAttributes.forEach(attr => {
      displayNamesMap[attr.datasource_tablename] = attr.datasource_name;
    });
    
    setDatasetDisplayNames(displayNamesMap);
    Object.assign(datasetDisplayNamesCache, displayNamesMap);
    
    if (filteredAttributes.length > 0) {
      setAttributes(filteredAttributes);
      // Set the first dataset as active tab if none is selected
      if (!activeTab || !selectedDatasets.includes(activeTab)) {
        setActiveTab(selectedDatasets[0]);
      }
      setError(null);
    } else {
      setAttributes([]);
      setError('No attributes found for selected datasets');
    }
  }, [activeTab, setActiveTab]);

  // Load all data asynchronously when the component mounts
  useEffect(() => {
    const loadAllData = async () => {
      // If data is already loaded, use cached data
      if (isDataLoaded && attributesCache.length > 0) {
        setDataSources(dataSourcesCache);
        processAttributes(attributesCache, selectedDatasets);
        setAttributeValueCounts(attributeValueCountsCache);
        setIsLoading(false);
        return;
      }

      // Set initial loading state
      setIsLoading(true);
      
      try {
        // Step 1: Fetch all data sources - use Promise.race to show UI faster
        const sourcesPromise = fetchDataSourcesMetadata();
        
        // If we have cached data sources, use them immediately while waiting for fresh data
        if (dataSourcesCache.length > 0) {
          setDataSources(dataSourcesCache);
        }
        
        // Wait for data sources
        const sources = await sourcesPromise;
        setDataSources(sources);
        dataSourcesCache.length = 0;
        dataSourcesCache.push(...sources);
        
        // Save to sessionStorage for persistence
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('dataSourcesCache', JSON.stringify(sources));
          } catch (e) {
            console.warn('Failed to save dataSourcesCache to sessionStorage:', e);
          }
        }

        // Step 2: Fetch all attributes metadata - use Promise.race to show UI faster
        const attributesPromise = fetchDatasetAttributesMetadata();
        
        // If we have cached attributes, use them immediately while waiting for fresh data
        if (attributesCache.length > 0) {
          processAttributes(attributesCache, selectedDatasets);
        }
        
        // Wait for attributes
        const allAttributes = await attributesPromise;
        
        // Map attributes to datasources
        const attributesWithSource: AttributeWithDataSource[] = [];
        
        for (const attr of allAttributes) {
          // Extract datasource ID from the URL
          const urlParts = attr.datasource_metadata.split('/');
          const datasourceId = urlParts[urlParts.length - 2]; // Get the ID from the URL
          
          // Find matching datasource
          const datasource = sources.find(ds => {
            const dsUrlParts = ds.url.split('/');
            const dsId = dsUrlParts[dsUrlParts.length - 2];
            return dsId === datasourceId;
          });
          
          if (datasource) {
            attributesWithSource.push({
              ...attr,
              datasource_name: datasource.datasource_name,
              datasource_tablename: datasource.datasource_tablename,
              attribute_ui_priority: attr.attribute_ui_priority || 5 // Default to 5 if not provided
            });
          }
        }

        // Cache all attributes
        attributesCache.length = 0;
        attributesCache.push(...attributesWithSource);
        
        // Save to sessionStorage for persistence
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('attributesCache', JSON.stringify(attributesWithSource));
          } catch (e) {
            console.warn('Failed to save attributesCache to sessionStorage:', e);
          }
        }

        // Process attributes for selected datasets
        processAttributes(attributesWithSource, selectedDatasets);

        // Step 3: Fetch attribute values for selected datasets first
        // Group attributes by dataset for efficient value fetching
        const attrsByDataset: Record<string, string[]> = {};
        
        for (const attr of attributesWithSource) {
          if (!attrsByDataset[attr.datasource_tablename]) {
            attrsByDataset[attr.datasource_tablename] = [];
          }
          attrsByDataset[attr.datasource_tablename].push(attr.attribute_column_name);
        }
        
        // Initialize value counts structure
        const valueCounts: Record<string, Record<string, number>> = {...attributeValueCountsCache};
        
        // Only fetch values for the currently selected datasets to improve initial load time
        const selectedDatasetIds = selectedDatasets.filter(id => attrsByDataset[id]);
        
        // Initialize value counts for all datasets
        for (const datasetId of Object.keys(attrsByDataset)) {
          if (!valueCounts[datasetId]) {
            valueCounts[datasetId] = {};
          }
          
          if (!attributeValuesCache[datasetId]) {
            attributeValuesCache[datasetId] = {};
          }
        }
        
        // Process selected datasets in parallel with a limit of 3 concurrent requests
        const fetchDatasetValues = async (datasetId: string) => {
          try {
            // Filter attributes to only fetch those not already in cache
            const attributesToFetch = attrsByDataset[datasetId].filter(
              attrName => !attributeValuesCache[datasetId]?.[attrName]
            );
            
            // If all attributes are already cached, skip the fetch
            if (attributesToFetch.length === 0) {
              return true;
            }
            
            // Fetch values for attributes not in cache
            const values = await fetchAttributeFilterValues(
              datasetId,
              attributesToFetch
            );
            
            // Process the results
            if (values) {
              for (const attrName of attributesToFetch) {
                if (values[attrName]) {
                  valueCounts[datasetId][attrName] = values[attrName].length;
                  attributeValuesCache[datasetId][attrName] = values[attrName];
                }
              }
            }
            return true;
          } catch (err) {
            console.error(`Error fetching values for dataset ${datasetId}:`, err);
            return false;
          }
        };
        
        // Helper function to process datasets in chunks
        const processBatch = async (datasets: string[], batchSize: number) => {
          for (let i = 0; i < datasets.length; i += batchSize) {
            const batch = datasets.slice(i, i + batchSize);
            await Promise.all(batch.map(datasetId => fetchDatasetValues(datasetId)));
          }
        };
        
        // Process selected datasets first with higher concurrency
        await processBatch(selectedDatasetIds, 3);
        
        // Update state with the values for selected datasets immediately
        setAttributeValueCounts({...valueCounts});
        
        // Save to sessionStorage for persistence
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('attributeValueCountsCache', JSON.stringify(valueCounts));
            sessionStorage.setItem('datasetDisplayNamesCache', JSON.stringify(datasetDisplayNamesCache));
          } catch (e) {
            console.warn('Failed to save caches to sessionStorage:', e);
          }
        }
        
        // Then process remaining datasets in the background after a delay
        setTimeout(() => {
          const remainingDatasets = Object.keys(attrsByDataset)
            .filter(id => !selectedDatasetIds.includes(id));
            
          processBatch(remainingDatasets, 2).then(() => {
            // Update the caches with any new values
            Object.assign(attributeValueCountsCache, valueCounts);
            
            // Save updated cache to sessionStorage
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.setItem('attributeValueCountsCache', JSON.stringify(attributeValueCountsCache));
              } catch (e) {
                console.warn('Failed to save attributeValueCountsCache to sessionStorage:', e);
              }
            }
          });
        }, 2000); // 2 second delay before loading non-selected datasets
          
        // Update caches
        Object.assign(attributeValueCountsCache, valueCounts);
        
        // Mark as loaded
        isDataLoaded = true;
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try again.');
        
        // If we have cached data, use it as fallback
        if (attributesCache.length > 0) {
          setDataSources(dataSourcesCache);
          processAttributes(attributesCache, selectedDatasets);
          setAttributeValueCounts(attributeValueCountsCache);
          setError('Using cached data. Some information may be outdated.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAllData();
  }, [processAttributes, selectedDatasets]);

  // Group attributes by dataset, filtering out attributes with priority 10
  const attributesByDataset = attributes.reduce<Record<string, AttributeWithDataSource[]>>(
    (acc: Record<string, AttributeWithDataSource[]>, attr: AttributeWithDataSource) => {
      // Skip attributes with priority 10 (hidden)
      if (attr.attribute_ui_priority === 10) {
        return acc;
      }
      
      if (!acc[attr.datasource_tablename]) {
        acc[attr.datasource_tablename] = [];
      }
      acc[attr.datasource_tablename].push(attr);
      return acc;
    },
    {}
  );

  // Handle attribute filter change
  const handleFilterChange = (datasetId: string, attributeName: string, values: string[]) => {
    onFilterChange(datasetId, attributeName, values);
  };

  if (selectedDatasets.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
            Loading dataset attributes...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}. Please try refreshing the page or contact support if the issue persists.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs 
            value={activeTab || undefined} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full flex overflow-x-auto mb-4">
              {selectedDatasets.map((datasetId) => (
                <TabsTrigger 
                  key={datasetId} 
                  value={datasetId}
                  className="flex-shrink-0 flex items-center gap-1 relative pr-7"
                >
                  {datasetDisplayNames[datasetId] || datasetId}
                  <div
                    role="button"
                    tabIndex={0}
                    className="absolute right-1 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent tab selection when clicking close
                      // Find the dataset in the selectedDatasets array and remove it
                      const updatedDatasets = selectedDatasets.filter(id => id !== datasetId);
                      
                      // Update active tab if the closed tab was active
                      if (activeTab === datasetId && updatedDatasets.length > 0) {
                        setActiveTab(updatedDatasets[0]);
                      } else if (updatedDatasets.length === 0) {
                        setActiveTab(null);
                      }
                      
                      // Notify parent component about dataset removal
                      if (onSelectedDatasetsChange) {
                        onSelectedDatasetsChange(updatedDatasets);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        // Find the dataset in the selectedDatasets array and remove it
                        const updatedDatasets = selectedDatasets.filter(id => id !== datasetId);
                        
                        // Update active tab if the closed tab was active
                        if (activeTab === datasetId && updatedDatasets.length > 0) {
                          setActiveTab(updatedDatasets[0]);
                        } else if (updatedDatasets.length === 0) {
                          setActiveTab(null);
                        }
                        
                        // Notify parent component about dataset removal
                        if (onSelectedDatasetsChange) {
                          onSelectedDatasetsChange(updatedDatasets);
                        }
                      }
                    }}
                    aria-label={`Remove ${datasetId} dataset`}
                  >
                    <X className="h-3 w-3" />
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {selectedDatasets.map((datasetId) => (
              <TabsContent key={datasetId} value={datasetId} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 w-full">
                  {/* <div className="flex items-center gap-2">
                    <h4 className="text-base font-medium text-gray-800">Filter Options</h4>
                  </div> */}
                  
                  {attributesByDataset[datasetId]?.length > 0 && (
                    <div className="flex items-center gap-2">
                      {/* <Button 
                        variant="outline" 
                        size="sm"
                        className="text-sm"
                        onClick={async () => {
                          // Select all values for all attributes in this dataset
                          for (const attribute of attributesByDataset[datasetId]) {
                            try {
                              // Fetch all available values for this attribute
                              const values = await fetchAttributeFilterValues(
                                attribute.datasource_tablename,
                                [attribute.attribute_column_name]
                              );
                              
                              // If values are available, select them all
                              if (values && values[attribute.attribute_column_name]) {
                                onFilterChange(
                                  datasetId, 
                                  attribute.attribute_column_name, 
                                  values[attribute.attribute_column_name]
                                );
                              }
                            } catch (err) {
                              console.error(`Error selecting all values for ${attribute.attribute_ui_name}:`, err);
                            }
                          }
                        }}
                      >
                        Select All Attributes
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-sm"
                        onClick={() => {
                          // Deselect all values for all attributes in this dataset
                          const updatedFilters = { ...selectedFilters };
                          if (updatedFilters[datasetId]) {
                            attributesByDataset[datasetId].forEach(attribute => {
                              if (updatedFilters[datasetId][attribute.attribute_column_name]) {
                                // Clear the selected values
                                onFilterChange(datasetId, attribute.attribute_column_name, []);
                              }
                            });
                          }
                        }}
                      >
                        Deselect All
                      </Button> */}
                    </div>
                  )}
                </div>

                {attributesByDataset[datasetId]?.length > 0 ? (
                    <div className="space-y-6 w-full mt-2">
                      {/* Primary Filters (Priority 1-4) */}
                      <div className="grid grid-cols-1 gap-6 w-full flex-grow">
                        {attributesByDataset[datasetId]
                          .filter(attribute => 
                            attribute.attribute_ui_priority >= 1 && 
                            attribute.attribute_ui_priority <= 4
                          )
                          .sort((a, b) => a.attribute_ui_priority - b.attribute_ui_priority)
                          .map((attribute) => (
                            <div key={`${attribute.attribute_column_name}-${attribute.attribute_ui_name}`} className="space-y-1 w-full">
                              <div className="flex flex-col w-full">
                                <div className="flex items-center gap-1 mb-1">
                                  <Label className="font-sm">{attribute.attribute_ui_name}</Label>
                                  {attribute.attribute_category_description && (
                                    <InfoTooltip content={
                                      <div className="max-w-[250px]">
                                        <p>{attribute.attribute_category_description}</p>
                                      </div>
                                    } />
                                  )}
                                </div>
                                {/* Handle different attribute types */}
                                {attribute.attribute_logical_datatype_description === "Integer" ? (
                                  attributeValueCounts[datasetId]?.[attribute.attribute_column_name] > 8 ? (
                                    <AttributeRangeFilter
                                      attributeName={attribute.attribute_ui_name}
                                      attributeColumnName={attribute.attribute_column_name}
                                      tableName={attribute.datasource_tablename}
                                      onFilterChange={(columnName, values) => 
                                        handleFilterChange(datasetId, columnName, values)
                                      }
                                      selectedValues={
                                        selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                      }
                                    />
                                  ) : (
                                    /* Dropdown multiselector for integer attributes with 8 or fewer values */
                                    <IntegerDropdownMultiselect
                                      attributeColumnName={attribute.attribute_column_name}
                                      tableName={attribute.datasource_tablename}
                                      onFilterChange={(columnName: string, values: string[]) => 
                                        handleFilterChange(datasetId, columnName, values)
                                      }
                                      selectedValues={
                                        selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                      }
                                    />
                                  )
                                ) : (
                                  /* Use DateAwareAttributeFilter for social_events event_name attribute */
                                  datasetId === "social_events" && attribute.attribute_column_name === "event_name" ? (
                                    <DateAwareAttributeFilter
                                      attributeName={attribute.attribute_ui_name}
                                      attributeColumnName={attribute.attribute_column_name}
                                      tableName={attribute.datasource_tablename}
                                      onFilterChange={(columnName, values) => 
                                        handleFilterChange(datasetId, columnName, values)
                                      }
                                      selectedValues={
                                        selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                      }
                                      timeframeSelections={timeframeSelections}
                                      dateField="date_start"
                                    />
                                  ) : (
                                    <AttributeFilter
                                      attributeColumnName={attribute.attribute_column_name}
                                      tableName={attribute.datasource_tablename}
                                      onFilterChange={(columnName, values) => 
                                        handleFilterChange(datasetId, columnName, values)
                                      }
                                      selectedValues={
                                        selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                      }
                                    />
                                  )
                                )}

                              </div>
                            </div>
                          ))}
                      </div>
                      
                      {/* Additional Filters (Priority 5-8) */}
                      {attributesByDataset[datasetId]?.some(attr => 
                        attr.attribute_ui_priority >= 5 && attr.attribute_ui_priority <= 8
                      ) && (
                        <div className="border rounded-md px-2 py-2 w-full">
                          <details className="cursor-pointer">
                            <summary className="font-medium text-sm mb-3">Additional Filters</summary>
                            <div className="grid grid-cols-1 gap-6 mt-4 w-full flex-grow">
                              {attributesByDataset[datasetId]
                                .filter(attribute => 
                                  attribute.attribute_ui_priority >= 5 && 
                                  attribute.attribute_ui_priority <= 8
                                )
                                .sort((a, b) => a.attribute_ui_priority - b.attribute_ui_priority)
                                .map((attribute) => (
                                  <div key={`${attribute.attribute_column_name}-${attribute.attribute_ui_name}`} className="space-y-1 w-full">
                                    <div className="flex flex-col w-full">
                                      <div className="flex items-center gap-1 mb-1">
                                        <Label className="font-sm">{attribute.attribute_ui_name}</Label>
                                        {attribute.attribute_category_description && (
                                          <InfoTooltip content={
                                            <div className="max-w-[250px]">
                                              <p>{attribute.attribute_category_description}</p>
                                            </div>
                                          } />
                                        )}
                                      </div>
                                      {/* Check if attribute is an integer type with more than 8 values */}
                                      {attribute.attribute_logical_datatype_description === "Integer" && 
                                       attributeValueCounts[datasetId]?.[attribute.attribute_column_name] > 8 ? (
                                        <AttributeRangeFilter
                                          attributeName={attribute.attribute_ui_name}
                                          attributeColumnName={attribute.attribute_column_name}
                                          tableName={attribute.datasource_tablename}
                                          onFilterChange={(columnName, values) => 
                                            handleFilterChange(datasetId, columnName, values)
                                          }
                                          selectedValues={
                                            selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                          }
                                        />
                                      ) : (
                                        /* Use DateAwareAttributeFilter for social_events event_name attribute */
                                        datasetId === "social_events" && attribute.attribute_column_name === "event_name" ? (
                                          <DateAwareAttributeFilter
                                            attributeName={attribute.attribute_ui_name}
                                            attributeColumnName={attribute.attribute_column_name}
                                            tableName={attribute.datasource_tablename}
                                            onFilterChange={(columnName, values) => 
                                              handleFilterChange(datasetId, columnName, values)
                                            }
                                            selectedValues={
                                              selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                            }
                                            timeframeSelections={timeframeSelections}
                                            dateField="date_start"
                                          />
                                        ) : (
                                          <AttributeFilter
                                            attributeColumnName={attribute.attribute_column_name}
                                            tableName={attribute.datasource_tablename}
                                            onFilterChange={(columnName, values) => 
                                              handleFilterChange(datasetId, columnName, values)
                                            }
                                            selectedValues={
                                              selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                            }
                                          />
                                        )
                                      )}

                                    </div>
                                  </div>
                                ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
                    No attributes available for this dataset
                  </div>
                )}
              </TabsContent>
              
            ))}
          </Tabs>
          
        )}
      </CardContent>
      
    </Card>
  );
}
