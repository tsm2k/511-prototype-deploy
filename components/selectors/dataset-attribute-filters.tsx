"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Button } from "@/components/ui/button"
import { AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AttributeFilter } from "@/components/selectors/attribute-filter"
import { AttributeRangeFilter } from "@/components/selectors/attribute-range-filter"
import { 
  fetchDatasetAttributesMetadata, 
  fetchDataSourcesMetadata,
  fetchAttributeFilterValues,
  type DatasetAttributeMetadata, 
  type DataSourceMetadata 
} from "@/services/api"

interface DatasetAttributeFiltersProps {
  selectedDatasets: string[];
  onFilterChange: (datasetId: string, attributeName: string, values: string[]) => void;
  selectedFilters: Record<string, Record<string, string[]>>;
  onSelectedDatasetsChange?: (datasets: string[]) => void;
}

// Extended attribute interface to include datasource information
interface AttributeWithDataSource extends DatasetAttributeMetadata {
  datasource_name: string;
  datasource_tablename: string;
  attribute_ui_priority?: number;
}

export function DatasetAttributeFilters({
  selectedDatasets,
  onFilterChange,
  selectedFilters,
  onSelectedDatasetsChange
}: DatasetAttributeFiltersProps) {
  const [attributes, setAttributes] = useState<AttributeWithDataSource[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [attributeValueCounts, setAttributeValueCounts] = useState<Record<string, Record<string, number>>>({});

  // Fetch datasources first
  useEffect(() => {
    const fetchSources = async () => {
      try {
        const sources = await fetchDataSourcesMetadata();
        setDataSources(sources);
      } catch (err) {
        console.error('Error fetching datasources:', err);
        setError('Failed to fetch datasource information');
      }
    };
    
    fetchSources();
  }, []);

  // Fetch attributes metadata for all datasets
  useEffect(() => {
    const fetchAttributes = async () => {
      if (selectedDatasets.length === 0 || dataSources.length === 0) return;
      
      setIsLoading(true);
      try {
        const allAttributes = await fetchDatasetAttributesMetadata();
        
        // Map attributes to datasources
        const attributesWithSource: AttributeWithDataSource[] = [];
        
        for (const attr of allAttributes) {
          // Extract datasource ID from the URL
          // Example: http://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics/datasources-metadata/1/
          const urlParts = attr.datasource_metadata.split('/');
          const datasourceId = urlParts[urlParts.length - 2]; // Get the ID from the URL
          
          // Find matching datasource
          const datasource = dataSources.find(ds => {
            const dsUrlParts = ds.url.split('/');
            const dsId = dsUrlParts[dsUrlParts.length - 2];
            return dsId === datasourceId;
          });
          
          if (datasource) {
            attributesWithSource.push({
              ...attr,
              datasource_name: datasource.datasource_name,
              datasource_tablename: datasource.datasource_tablename
            });
          }
        }
        
        // Filter attributes for selected datasets
        const filteredAttributes = attributesWithSource.filter(attr => 
          selectedDatasets.includes(attr.datasource_tablename)
        );
        
        if (filteredAttributes.length > 0) {
          setAttributes(filteredAttributes);
          // Set the first dataset as active tab if none is selected
          if (!activeTab || !selectedDatasets.includes(activeTab)) {
            setActiveTab(selectedDatasets[0]);
          }
          setError(null);
          
          // Group attributes by dataset for efficient value fetching
          const attrsByDataset: Record<string, string[]> = {};
          
          for (const attr of filteredAttributes) {
            if (!attrsByDataset[attr.datasource_tablename]) {
              attrsByDataset[attr.datasource_tablename] = [];
            }
            attrsByDataset[attr.datasource_tablename].push(attr.attribute_column_name);
          }
          
          // Fetch value counts for each attribute to determine if we should use range slider
          const valueCounts: Record<string, Record<string, number>> = {};
          
          // Process each dataset in sequence to avoid overwhelming the API
          for (const datasetId of Object.keys(attrsByDataset)) {
            if (!valueCounts[datasetId]) {
              valueCounts[datasetId] = {};
            }
            
            try {
              // Fetch values for all attributes in this dataset at once
              const values = await fetchAttributeFilterValues(
                datasetId,
                attrsByDataset[datasetId]
              );
              
              // Process the results
              if (values) {
                for (const attrName of attrsByDataset[datasetId]) {
                  if (values[attrName]) {
                    valueCounts[datasetId][attrName] = values[attrName].length;
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching values for dataset ${datasetId}:`, err);
            }
          }
          
          setAttributeValueCounts(valueCounts);
        } else {
          setError("No attributes found for selected datasets");
          setAttributes([]);
        }
      } catch (err) {
        setError("Failed to fetch dataset attributes");
        console.error(err);
        setAttributes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttributes();
  }, [selectedDatasets, dataSources]);

  // Group attributes by dataset
  const attributesByDataset = attributes.reduce<Record<string, AttributeWithDataSource[]>>(
    (acc, attr) => {
      if (!acc[attr.datasource_tablename]) {
        acc[attr.datasource_tablename] = [];
      }
      acc[attr.datasource_tablename].push(attr);
      return acc;
    },
    {}
  );

  // Handle attribute filter change
  const handleAttributeFilterChange = (datasetId: string, attributeName: string, values: string[]) => {
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
                  {datasetId}
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
                <h3 className="text-lg font-medium">Filter Options</h3>
                
                {attributesByDataset[datasetId]?.length > 0 ? (
                  <>
                    {/* Select All / Deselect All buttons */}
                    <div className="flex justify-end mb-4 space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
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
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                      {/* High Priority Attributes (1-4) */}
                      {attributesByDataset[datasetId]
                        .filter(attr => (attr.attribute_ui_priority ?? 5) >= 1 && (attr.attribute_ui_priority ?? 5) <= 4)
                        .sort((a, b) => (a.attribute_ui_priority ?? 5) - (b.attribute_ui_priority ?? 5))
                        .map((attribute) => (
                          <div key={`${attribute.attribute_column_name}-${attribute.attribute_ui_name}`} className="space-y-1">
                            <div className="flex items-center gap-1">
                              {/* Check if attribute is an integer type with more than 8 values */}
                              {attribute.attribute_logical_datatype_description === "Integer" && 
                               attributeValueCounts[datasetId]?.[attribute.attribute_column_name] > 8 ? (
                                <AttributeRangeFilter
                                  attributeName={attribute.attribute_ui_name}
                                  attributeColumnName={attribute.attribute_column_name}
                                  tableName={attribute.datasource_tablename}
                                  onFilterChange={(columnName, values) => 
                                    handleAttributeFilterChange(datasetId, columnName, values)
                                  }
                                  selectedValues={
                                    selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                  }
                                />
                              ) : (
                                <AttributeFilter
                                  attributeName={attribute.attribute_ui_name}
                                  attributeColumnName={attribute.attribute_column_name}
                                  tableName={attribute.datasource_tablename}
                                  onFilterChange={(columnName, values) => 
                                    handleAttributeFilterChange(datasetId, columnName, values)
                                  }
                                  selectedValues={
                                    selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                  }
                                />
                              )}
                              {attribute.attribute_category_description && (
                                <InfoTooltip content={
                                  <div className="max-w-[250px]">
                                    <p><strong>{attribute.attribute_ui_name}:</strong> {attribute.attribute_category_description}</p>
                                    {attribute.attribute_logical_datatype_description && (
                                      <p className="mt-1"><strong>Type:</strong> {attribute.attribute_logical_datatype_description}</p>
                                    )}
                                  </div>
                                } />
                              )}
                            </div>
                          </div>
                        ))}
                      
                      {/* Additional Filters Section (5-9) */}
                      {attributesByDataset[datasetId].some(attr => (attr.attribute_ui_priority ?? 5) >= 5 && (attr.attribute_ui_priority ?? 5) <= 9) && (
                        <div className="mt-6">
                          <details className="border rounded-md p-2">
                            <summary className="font-medium cursor-pointer p-2">Additional Filters</summary>
                            <div className="mt-4 space-y-4">
                              {attributesByDataset[datasetId]
                                .filter(attr => (attr.attribute_ui_priority ?? 5) >= 5 && (attr.attribute_ui_priority ?? 5) <= 9)
                                .sort((a, b) => (a.attribute_ui_priority ?? 5) - (b.attribute_ui_priority ?? 5))
                                .map((attribute) => (
                                  <div key={`${attribute.attribute_column_name}-${attribute.attribute_ui_name}`} className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      {/* Check if attribute is an integer type with more than 8 values */}
                                      {attribute.attribute_logical_datatype_description === "Integer" && 
                                       attributeValueCounts[datasetId]?.[attribute.attribute_column_name] > 8 ? (
                                        <AttributeRangeFilter
                                          attributeName={attribute.attribute_ui_name}
                                          attributeColumnName={attribute.attribute_column_name}
                                          tableName={attribute.datasource_tablename}
                                          onFilterChange={(columnName, values) => 
                                            handleAttributeFilterChange(datasetId, columnName, values)
                                          }
                                          selectedValues={
                                            selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                          }
                                        />
                                      ) : (
                                        <AttributeFilter
                                          attributeName={attribute.attribute_ui_name}
                                          attributeColumnName={attribute.attribute_column_name}
                                          tableName={attribute.datasource_tablename}
                                          onFilterChange={(columnName, values) => 
                                            handleAttributeFilterChange(datasetId, columnName, values)
                                          }
                                          selectedValues={
                                            selectedFilters[datasetId]?.[attribute.attribute_column_name] || []
                                          }
                                        />
                                      )}
                                      {attribute.attribute_category_description && (
                                        <InfoTooltip content={
                                          <div className="max-w-[250px]">
                                            <p><strong>{attribute.attribute_ui_name}:</strong> {attribute.attribute_category_description}</p>
                                            {attribute.attribute_logical_datatype_description && (
                                              <p className="mt-1"><strong>Type:</strong> {attribute.attribute_logical_datatype_description}</p>
                                            )}
                                          </div>
                                        } />
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </details>
                        </div>
                      )}
                    </div>
                  </>
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
