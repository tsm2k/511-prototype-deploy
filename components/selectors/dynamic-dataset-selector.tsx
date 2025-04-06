"use client"

import { useState, useEffect } from "react"
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ColorMultiSelect, type ColorMultiSelectOption } from "@/components/ui/color-multiselect";
import { fetchDataSourcesMetadata, mapDataSourceToOption } from "@/services/api";

// Props for the dynamic dataset selector
interface DynamicDatasetSelectorProps {
  selectedDatasets: string[];
  onSelectedDatasetsChange: (datasets: string[]) => void;
}

export function DynamicDatasetSelector({
  selectedDatasets,
  onSelectedDatasetsChange,
}: DynamicDatasetSelectorProps) {
  // State for the multi-select dropdown
  const [availableDatasets, setAvailableDatasets] = useState<ColorMultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available datasets from API
  useEffect(() => {
    const fetchDatasets = async () => {
      setIsLoading(true);
      try {
        const datasources = await fetchDataSourcesMetadata();
        if (datasources.length > 0) {
          const formattedOptions = datasources.map(mapDataSourceToOption);
          setAvailableDatasets(formattedOptions);
          setError(null);
        } else {
          setError("No datasets found");
        }
      } catch (err) {
        setError("Failed to fetch datasets");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDatasets();
  }, []);

  // Handle dataset selection change
  const handleDatasetChange = (newSelectedDatasets: string[]) => {
    // Update the selected datasets
    onSelectedDatasetsChange(newSelectedDatasets);
    
    // Update the parent component with the selected dataset IDs
    if (typeof window !== 'undefined') {
      // Use a custom event to communicate with the parent component
      const event = new CustomEvent('selectedDatasetsChanged', {
        detail: { selectedDatasetIds: newSelectedDatasets }
      });
      window.dispatchEvent(event);
    }
  };

  // Render the dataset selector
  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
          Loading available datasets...
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
          {error}. Please try again later.
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-2">
            <InfoTooltip content={
              <div className="space-y-1 max-w-[250px]">
                <p>Choose one or more datasets to display on the map</p>
                <ul className="list-disc pl-4 text-xs">
                  {availableDatasets.map(dataset => (
                    <li key={dataset.value}>
                      <strong>{dataset.label}</strong>: {dataset.description}
                      {dataset.source && (
                        <div className="text-xs text-gray-500">
                          Source: {
                            dataset.href ? (
                              <a 
                                href={dataset.href} 
                                className="text-blue-600 hover:underline" 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                {dataset.source}
                              </a>
                            ) : dataset.source
                          }
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            } />
          </div>

          <ColorMultiSelect
            options={availableDatasets}
            selected={selectedDatasets}
            onChange={handleDatasetChange}
            placeholder="Select datasets..."
          />

          {selectedDatasets.length === 0 && (
            <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md mt-4">
              No datasets selected. Please select at least one dataset from the dropdown above.
            </div>
          )}
        </>
      )}
    </div>
  );
}
