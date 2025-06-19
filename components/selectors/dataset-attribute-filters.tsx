"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AlertCircle, X, Check, ChevronsUpDown, ChevronUp, ChevronDown, Filter as FilterIcon } from "lucide-react"
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
  activeDataset?: string | null;
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
  timeframeSelections = [],
  activeDataset
}: DatasetAttributeFiltersProps) {
  const [attributes, setAttributes] = useState<AttributeWithDataSource[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(activeDataset || null);
  const [attributeValueCounts, setAttributeValueCounts] = useState<Record<string, Record<string, number>>>({});
  const [datasetDisplayNames, setDatasetDisplayNames] = useState<Record<string, string>>({}); // Map dataset IDs to display names
  const [allAttributeValues, setAllAttributeValues] = useState<Record<string, Record<string, string[]>>>({});
  const [isAttributeFiltersOpen, setIsAttributeFiltersOpen] = useState(true); // Control visibility of attribute filters section
  const [secondaryFiltersOpen, setSecondaryFiltersOpen] = useState<Record<string, boolean>>({}); // Track open/closed state of secondary filters by dataset

  // Process attributes for selected datasets
  const processAttributes = useCallback((attributesWithSource: AttributeWithDataSource[], selectedDatasets: string[]) => {
    // Filter attributes for selected datasets and exclude those with attribute_ui_priority = 11
    const filteredAttributes = attributesWithSource.filter(attr => 
      selectedDatasets.includes(attr.datasource_tablename) && attr.attribute_ui_priority !== 11
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
      setError('No attributes found for selected dataset');
    }
  }, [activeTab, setActiveTab]);
  
  // Update active tab when activeDataset prop changes
  useEffect(() => {
    if (activeDataset && selectedDatasets.includes(activeDataset) && activeTab !== activeDataset) {
      setActiveTab(activeDataset);
    }
  }, [activeDataset, selectedDatasets]);

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

      setIsLoading(true);
      try {
        // Step 1: Fetch all data sources
        const sources = await fetchDataSourcesMetadata();
        setDataSources(sources);
        dataSourcesCache.length = 0;
        dataSourcesCache.push(...sources);

        // Step 2: Fetch all attributes metadata
        const allAttributes = await fetchDatasetAttributesMetadata();
        
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
            // Only add attributes that don't have attribute_ui_priority = 11
            if (attr.attribute_ui_priority !== 11) {
              attributesWithSource.push({
                ...attr,
                datasource_name: datasource.datasource_name,
                datasource_tablename: datasource.datasource_tablename,
                attribute_ui_priority: attr.attribute_ui_priority || 5 // Default to 5 if not provided
              });
            }
          }
        }
        // Cache all attributes
        attributesCache.length = 0;
        attributesCache.push(...attributesWithSource);

        // Process attributes for selected datasets (excluding those with attribute_ui_priority = 11)
        processAttributes(attributesWithSource, selectedDatasets);

        // Step 3: Fetch all attribute values for all datasets
        // Group attributes by dataset for efficient value fetching
        const attrsByDataset: Record<string, string[]> = {};
        
        for (const attr of attributesWithSource) {
          if (!attrsByDataset[attr.datasource_tablename]) {
            attrsByDataset[attr.datasource_tablename] = [];
          }
          attrsByDataset[attr.datasource_tablename].push(attr.attribute_column_name);
        }
        
        // Initialize value counts structure
        const valueCounts: Record<string, Record<string, number>> = {};
        const allValues: Record<string, Record<string, string[]>> = {};
        
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
            // For traffic_speed_info table, only request data_density and origin_datasource_id to avoid 504 errors
            let columnsToFetch = attrsByDataset[datasetId];
            
            if (datasetId === 'traffic_speed_info') {
              // Filter to only include data_density and origin_datasource_id if they exist in the requested columns
              columnsToFetch = columnsToFetch.filter(col => 
                col === 'data_density'
              );
              console.log(`Optimizing traffic_speed_info request to only fetch: ${columnsToFetch.join(', ')}`);
            }
            
            // Fetch values for attributes in this dataset
            const values = await fetchAttributeFilterValues(
              datasetId,
              columnsToFetch
            );
            
            // Process the results
            if (values) {
              for (const attrName of attrsByDataset[datasetId]) {
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
        
        // Then process remaining datasets in the background after a delay
        setTimeout(() => {
          const remainingDatasets = Object.keys(attrsByDataset)
            .filter(id => !selectedDatasetIds.includes(id));
            
          processBatch(remainingDatasets, 2).then(() => {
            // Update the caches with any new values
            Object.assign(attributeValueCountsCache, valueCounts);
          });
        }, 2000); // 2 second delay before loading non-selected datasets
          
        // Store the results in state and cache
        setAttributeValueCounts(valueCounts);
        
        // Update caches
        Object.assign(attributeValueCountsCache, valueCounts);
        Object.assign(attributeValuesCache, allValues);
        
        // Mark as loaded
        isDataLoaded = true;
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try again.');
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

  // Toggle attribute filters
  const toggleAttributeFilters = () => {
    setIsAttributeFiltersOpen(!isAttributeFiltersOpen);
  };

  // Toggle secondary filters for a dataset
  const toggleSecondaryFilters = (datasetId: string) => {
    setSecondaryFiltersOpen(prevState => ({ ...prevState, [datasetId]: !prevState[datasetId] }));
  };

  // Get summary of selected attribute filters
  const getAttributeFilterSummary = () => {
    // Count total number of filters applied
    let totalFiltersApplied = 0;
    let datasetsWithFilters = 0;
    
    Object.keys(selectedFilters).forEach(datasetId => {
      const datasetFilters = selectedFilters[datasetId];
      const filterCount = Object.values(datasetFilters).filter(values => values.length > 0).length;
      
      if (filterCount > 0) {
        totalFiltersApplied += filterCount;
        datasetsWithFilters++;
      }
    });
    
    if (totalFiltersApplied === 0) {
      return "No filters applied";
    }
    
    return `${totalFiltersApplied} filter${totalFiltersApplied !== 1 ? 's' : ''} applied across ${datasetsWithFilters} dataset${datasetsWithFilters !== 1 ? 's' : ''}`;
  };

  if (selectedDatasets.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="p-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
            Loading dataset attributes...
          </div>
        ) : error ? (
          <Alert className="border-yellow-500 bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-700" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="w-full">
            {/* Dataset Content - directly show the active dataset's filters */}
            {activeTab && attributesByDataset[activeTab]?.length > 0 ? (
              <div className="space-y-3 w-full">
                {/* Primary Filters (Priority 1-4) */}
                <div className="grid grid-cols-1 gap-3 w-full flex-grow">
                  {attributesByDataset[activeTab]
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
                            attributeValueCounts[activeTab]?.[attribute.attribute_column_name] > 8 ? (
                              <AttributeRangeFilter
                                attributeName={attribute.attribute_ui_name}
                                attributeColumnName={attribute.attribute_column_name}
                                tableName={attribute.datasource_tablename}
                                onFilterChange={(columnName, values) => 
                                  handleFilterChange(activeTab, columnName, values)
                                }
                                selectedValues={
                                  selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                }
                              />
                            ) : (
                              /* Dropdown multiselector for integer attributes with 8 or fewer values */
                              <IntegerDropdownMultiselect
                                attributeColumnName={attribute.attribute_column_name}
                                tableName={attribute.datasource_tablename}
                                onFilterChange={(columnName: string, values: string[]) => 
                                  handleFilterChange(activeTab, columnName, values)
                                }
                                selectedValues={
                                  selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                }
                              />
                            )
                          ) : (
                            /* Use DateAwareAttributeFilter for social_events event_name attribute */
                            activeTab === "social_events" && attribute.attribute_column_name === "event_name" ? (
                              <DateAwareAttributeFilter
                                attributeName={attribute.attribute_ui_name}
                                attributeColumnName={attribute.attribute_column_name}
                                tableName={attribute.datasource_tablename}
                                onFilterChange={(columnName, values) => 
                                  handleFilterChange(activeTab, columnName, values)
                                }
                                selectedValues={
                                  selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                }
                                timeframeSelections={timeframeSelections}
                                dateField="date_start"
                              />
                            ) : (
                              <AttributeFilter
                                attributeColumnName={attribute.attribute_column_name}
                                tableName={attribute.datasource_tablename}
                                onFilterChange={(columnName, values) => 
                                  handleFilterChange(activeTab, columnName, values)
                                }
                                selectedValues={
                                  selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                }
                              />
                            )
                          )}
                        </div>
                      </div>
                    ))}
                </div>
                
                {/* Secondary Filters (Priority 5+) - Collapsible */}
                {attributesByDataset[activeTab].some(attr => attr.attribute_ui_priority >= 5) && (
                  <div className="mt-6">
                    <div 
                      className="flex items-center justify-between cursor-pointer p-2 border rounded-md bg-gray-50 hover:bg-gray-100"
                      onClick={() => toggleSecondaryFilters(activeTab)}
                    >
                      <span className="font-medium">Additional Filters</span>
                      {secondaryFiltersOpen[activeTab] ? 
                        <ChevronUp className="h-4 w-4" /> : 
                        <ChevronDown className="h-4 w-4" />}
                    </div>
                    
                    {secondaryFiltersOpen[activeTab] && (
                      <div className="mt-4 grid grid-cols-1 gap-6 w-full">
                        {attributesByDataset[activeTab]
                          .filter(attribute => attribute.attribute_ui_priority >= 5 && attribute.attribute_ui_priority !== 11)
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
                                  attributeValueCounts[activeTab]?.[attribute.attribute_column_name] > 8 ? (
                                    <AttributeRangeFilter
                                      attributeName={attribute.attribute_ui_name}
                                      attributeColumnName={attribute.attribute_column_name}
                                      tableName={attribute.datasource_tablename}
                                      onFilterChange={(columnName, values) => 
                                        handleFilterChange(activeTab, columnName, values)
                                      }
                                      selectedValues={
                                        selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                      }
                                    />
                                  ) : (
                                    <IntegerDropdownMultiselect
                                      attributeColumnName={attribute.attribute_column_name}
                                      tableName={attribute.datasource_tablename}
                                      onFilterChange={(columnName: string, values: string[]) => 
                                        handleFilterChange(activeTab, columnName, values)
                                      }
                                      selectedValues={
                                        selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                      }
                                    />
                                  )
                                ) : (
                                  <AttributeFilter
                                    attributeColumnName={attribute.attribute_column_name}
                                    tableName={attribute.datasource_tablename}
                                    onFilterChange={(columnName, values) => 
                                      handleFilterChange(activeTab, columnName, values)
                                    }
                                    selectedValues={
                                      selectedFilters[activeTab]?.[attribute.attribute_column_name] || []
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeTab ? (
              <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
                No attribute filters available for this dataset.
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
                Please select a dataset to view available filters.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetAttributeFilters;
