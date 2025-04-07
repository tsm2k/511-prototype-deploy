"use client"

import { useState, useEffect, useCallback } from "react"
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ColorMultiSelect, type ColorMultiSelectOption } from "@/components/ui/color-multiselect";
import { fetchDataSourcesMetadata, mapDataSourceToOption } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Props for the dynamic dataset selector
interface DynamicDatasetSelectorProps {
  selectedDatasets: string[];
  onSelectedDatasetsChange: (datasets: string[]) => void;
  getSummaryRef?: { getSummary: (() => string) | null };
}

export function DynamicDatasetSelector({
  selectedDatasets,
  onSelectedDatasetsChange,
  getSummaryRef,
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

  // Get a summary of the current dataset selections
  const getDatasetSummary = useCallback(() => {
    if (selectedDatasets.length === 0) {
      return "No datasets selected";
    }

    // Find the display names for the selected datasets
    const selectedOptions = availableDatasets.filter(option => 
      selectedDatasets.includes(option.value)
    );

    if (selectedOptions.length <= 3) {
      return selectedOptions.map(option => option.label).join(", ");
    } else {
      return `${selectedOptions.slice(0, 2).map(option => option.label).join(", ")} + ${selectedOptions.length - 2} more`;
    }
  }, [selectedDatasets, availableDatasets]);

  // For external access to the summary
  useEffect(() => {
    if (getSummaryRef) {
      getSummaryRef.getSummary = getDatasetSummary;
    }
    
    return () => {
      if (getSummaryRef) {
        getSummaryRef.getSummary = null;
      }
    };
  }, [getDatasetSummary, getSummaryRef]);

  // Render the dataset selector
  return (
    <div className="space-y-4">
      {/* Current Selections */}
      {/* <div className="space-y-2">
        <h3 className="text-sm font-medium">Current Selections</h3>
        <div className="min-h-[40px] p-2 border rounded-md bg-slate-50">
          {selectedDatasets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No datasets selected yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableDatasets
                .filter(dataset => selectedDatasets.includes(dataset.value))
                .map((dataset) => (
                  <Badge 
                    key={dataset.value}
                    variant="outline" 
                    className="px-2 py-1 flex items-center gap-1 bg-white"
                  >
                    <span>{dataset.label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleDatasetChange(selectedDatasets.filter(id => id !== dataset.value))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
            </div>
          )}
        </div>
      </div> */}

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
          <ColorMultiSelect
            options={availableDatasets}
            selected={selectedDatasets}
            onChange={handleDatasetChange}
            placeholder="Select datasets..."
          />
        </>
      )}
    </div>
  );
}
