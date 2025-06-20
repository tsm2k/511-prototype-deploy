"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MapPin, Calendar, Database, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Plus, Check, Trash2, Filter as FilterIcon, Info, BarChart, AlertTriangle, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CauseEffectDatasetSelector } from "@/components/selectors/cause-effect-dataset-selector"
import { Switch } from "@/components/ui/switch"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { TimelineSelector, TimeframeSelection } from "./selectors/timeline-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationSelector } from "@/components/selectors/location-selector"
import { DynamicDatasetSelector } from "@/components/selectors/dynamic-dataset-selector"
import { DatasetAttributeFilters } from "@/components/selectors/dataset-attribute-filters"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { executeQuery, fetchDataSourcesMetadata, type DataSourceMetadata } from "@/services/api"
import { buildQueryRequest, HOLIDAY_NAMES } from '@/services/query-builder'
import { LocationFilter, TimeFilter } from '@/types/filters'
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion";

// Dataset Tab Selector Component
interface DatasetTabSelectorProps {
  filterId: string;
  selectedDatasets: string[];
  onDatasetChange: (datasets: string[]) => void;
  datasetSummaryRef: { getSummary: (() => string) | null };
  onActiveDatasetChange?: (dataset: string | null) => void;
}

const DatasetTabSelector = ({ filterId, selectedDatasets, onDatasetChange, datasetSummaryRef, onActiveDatasetChange }: DatasetTabSelectorProps) => {
  const [isAddingDataset, setIsAddingDataset] = useState(false);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  
  // Set initial active dataset when datasets change
  useEffect(() => {
    if (selectedDatasets.length > 0 && (!activeDataset || !selectedDatasets.includes(activeDataset))) {
      const newActiveDataset = selectedDatasets[0];
      setActiveDataset(newActiveDataset);
      if (onActiveDatasetChange) {
        onActiveDatasetChange(newActiveDataset);
      }
    } else if (selectedDatasets.length === 0) {
      setActiveDataset(null);
      if (onActiveDatasetChange) {
        onActiveDatasetChange(null);
      }
    }
  }, [selectedDatasets]); // Remove activeDataset and onActiveDatasetChange from dependencies
  
  // Predefined list of available datasets
  const availableDatasets = [
    { value: 'social_events', label: 'Social Events (Ticketmaster)', description: 'Planned social gatherings affecting traffic' },
    { value: 'traffic_events', label: 'Traffic Events (511)', description: 'Traffic incidents and events' },
    { value: 'lane_blockage_info', label: 'Lane Blockages (511)', description: 'Information about lane closures and blockages' },
    { value: 'rest_area_info', label: 'Rest Areas (511)', description: 'Locations and details of highway rest areas' },
    { value: 'dynamic_message_sign_info', label: 'Dynamic Message Signs (511)', description: 'Dynamic message signs data' },
    { value: 'traffic_parking_info', label: 'Truck Parking Information (511)', description: 'Truck parking Information Management System data' },
    { value: 'travel_time_system_info', label: 'Travel Time System (511)', description: 'Travel Time System data' },
    { value: 'variable_speed_limit_sign_info', label: 'Variable Speed Limit Signs (511)', description: 'Variable Speed Limit Signs data' },
    { value: 'weather_info', label: 'Road Weather Inormation System (511)', description: 'Road Weather Inormation System data ' },
    { value: 'traffic_speed_info', label: 'Traffic Speed (511)', description: 'Traffic Speed data' }
  ];

  // Helper function to get display name for a dataset
  const getDisplayName = (dataset: string): string => {
    const datasetOption = availableDatasets.find(d => d.value === dataset);
    return datasetOption ? datasetOption.label : dataset;
  };

  // Handle selecting a dataset
  const handleSelectDataset = (dataset: string): void => {
    if (!selectedDatasets.includes(dataset)) {
      const newDatasets = [...selectedDatasets, dataset];
      onDatasetChange(newDatasets);
      setActiveDataset(dataset); // Set the newly added dataset as active
      if (onActiveDatasetChange) {
        onActiveDatasetChange(dataset);
      }
    }
    setIsAddingDataset(false);
  };

  // Handle clicking on a dataset tab
  const handleTabClick = (dataset: string): void => {
    // Only update if it's different from current active dataset
    if (dataset !== activeDataset) {
      setActiveDataset(dataset);
      if (onActiveDatasetChange) {
        onActiveDatasetChange(dataset);
      }
    }
  };

  return (
    <div className="mb-4">
      <div className="border-b overflow-x-auto whitespace-nowrap pb-1 mb-4">
        {/* Display selected datasets as tabs */}
        <div className="inline-flex">
          {selectedDatasets.map((dataset) => (
            <div 
              key={dataset}
              onClick={() => handleTabClick(dataset)}
              className={`px-4 py-2 rounded-t-md border-t border-l border-r mr-1 relative inline-flex items-center cursor-pointer transition-colors ${activeDataset === dataset ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
            >
              <span className={activeDataset === dataset ? 'font-medium text-blue-700' : ''}>
                {getDisplayName(dataset)}
              </span>
              <button 
                className="ml-2 text-gray-400 hover:text-gray-600"
                onClick={(e) => {
                  e.stopPropagation();
                  // Remove this dataset
                  const newDatasets = selectedDatasets.filter(d => d !== dataset);
                  onDatasetChange(newDatasets);
                  // If removing the active dataset, select the first available one
                  if (activeDataset === dataset && newDatasets.length > 0) {
                    setActiveDataset(newDatasets[0]);
                  }
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        
        {/* Add Dataset button */}
        <div className="inline-flex items-center">
          <div 
            className="px-4 py-2 rounded-t-md border-t border-l border-r mr-1 bg-white flex items-center cursor-pointer hover:bg-gray-50"
            onClick={() => setIsAddingDataset(!isAddingDataset)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Dataset
          </div>
        </div>
      </div>
      
      {/* Dataset selector panel - shown directly below */}
      {isAddingDataset && (
        <div className="border rounded-md p-4 bg-white shadow-md mb-4">
          <div className="space-y-3">
            <h3 className="font-medium">Available Datasets</h3>
            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {availableDatasets
                .filter(dataset => !selectedDatasets.includes(dataset.value))
                .map(dataset => (
                  <div 
                    key={dataset.value}
                    className="flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelectDataset(dataset.value)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{dataset.label}</div>
                      {dataset.description && (
                        <div className="text-sm text-gray-500">{dataset.description}</div>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-gray-400" />
                  </div>
                ))
              }
              {availableDatasets.filter(dataset => !selectedDatasets.includes(dataset.value)).length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No more datasets available to add
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button 
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                onClick={() => setIsAddingDataset(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple Spinner component
const Spinner = ({ className }: { className?: string }) => (
  <div className={`animate-spin ${className || ''}`}>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
)


// Define the structure for a single filter
// Import types from types/filters
import { PolygonCoordinates, LocationSelectionType } from '@/types/filters';

// Define the interface for location selections
interface LocationSelection {
  type: LocationSelectionType
  selection: string | string[] | PolygonCoordinates
  operator: "AND" | "OR" // Operator to use with the next selection
  mileMarkerRange?: { min: number; max: number } // Only for road selections
  poiRadius?: number // Radius in miles for Points of Interest
}

interface Filter {
  id: string;
  name: string;
  isOpen: boolean;
  active: boolean;
  openSelector: string | null;
  locations: {
    cities: string[];
    roads: string[];
    districts: string[];
    pointsOfInterest?: string[];
  };
  cities: string[];
  roads: string[];
  districts: string[];
  pointsOfInterest?: string[];
  timeframe: { start: string; end: string } | null;
  start: string;
  end: string;
  timeframeSelections?: TimeframeSelection[];
  locationSelections?: LocationSelection[];
  roadMileMarkerRanges?: Record<string, { min: number; max: number }>;
  min: number;
  max: number;
  selectedDatasets: string[];
  activeDataset?: string | null; // Track the active dataset tab
  attributeFilters: Record<string, Record<string, string[]>>;
} // Dynamic attribute filters for datasets

interface SelectorPanelProps {
  onFilteredDataChange?: () => void
  onSelectedDatasetsChange?: (datasets: {

    selectedDatasetIds: string[]
  }) => void
}

import { useFilterContext } from "@/contexts/filter-context"

export function SelectorPanel({ onFilteredDataChange, onSelectedDatasetsChange }: SelectorPanelProps) {
  // Get filter state from context
  const { filterState, setFilterState } = useFilterContext();
  
  // State for managing multiple filters - initialize from context if available
  const [filters, setFilters] = useState<Filter[]>(() => {
    if (filterState && filterState.filters) {
      return filterState.filters;
    }
    return [];
  });
  
  const [activeFilterId, setActiveFilterId] = useState<string | null>(() => {
    if (filterState && filterState.activeFilterId) {
      return filterState.activeFilterId;
    }
    return null;
  });
  
  const [isLoading, setIsLoading] = useState(false)
  const [filterToDelete, setFilterToDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  
  // State for results display
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [showResultsHighlight, setShowResultsHighlight] = useState(false);
  const [noResultsFound, setNoResultsFound] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  // Use filter context for query results and summary
  const { queryResults: contextQueryResults, setQueryResults: setContextQueryResults, 
          resultsSummary, setResultsSummary } = useFilterContext();
  
  // State for request search
  const [requestSearchTerm, setRequestSearchTerm] = useState("");
  const [savedRequests, setSavedRequests] = useState([
    "Tanay - Request Jun 13 at 3:03 PM",
    "Abin - Request Jun 13 at 3:03 PM",
    "Liya - Request Jun 13 at 3:03 PM",
    "Tanay - Request Jun 12 at 10:15 AM",
    "Abin - Request Jun 11 at 2:30 PM",
    "Liya - Request Jun 10 at 9:45 AM"
  ]);
  
  // Save filter state to context when it changes
  useEffect(() => {
    setFilterState({
      filters,
      activeFilterId
    });
  }, [filters, activeFilterId, setFilterState])
  
  // Helper function to create a new empty filter
  const createNewFilter = useCallback((): Filter => ({
    id: uuidv4(),
    name: `<Username> — Request created ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`, //`Search ${filters.length + 1}`,
    isOpen: true,
    active: true,
    openSelector: null,
    locations: {
      cities: [],
      roads: [],
      districts: [],
      pointsOfInterest: [],
    },
    cities: [],
    roads: [],
    districts: [],
    pointsOfInterest: [],
    timeframe: null,
    start: '',
    end: '',
    min: 0,
    max: 100,
    timeframeSelections: [],
    locationSelections: [],
    roadMileMarkerRanges: {},
    selectedDatasets: [],
    activeDataset: null,
    attributeFilters: {},
  }), [filters.length]);  // Initialize new dataset structure
  
  // Initialize with one empty filter
  useEffect(() => {
    if (filters.length === 0) {
      const newFilter = createNewFilter()
      setFilters([newFilter])
      setActiveFilterId(newFilter.id)
    }
  }, [filters.length, createNewFilter])

  // Function to toggle event type filter selection
  const toggleEventTypeFilter = (filterId: string, datasetName: string, attributeName: string, value: string) => {    
    console.log(`Toggle filter: ${datasetName}.${attributeName} = ${value}`);
    
    // First get the current filter state
    const currentFilter = filters.find(f => f.id === filterId);
    if (!currentFilter) return;
    
    // Check if the value is already in the filter
    const currentValues = currentFilter.attributeFilters?.[datasetName]?.[attributeName] || [];
    const valueIndex = currentValues.indexOf(value);
    const isAdding = valueIndex === -1;
    
    // Create the updated filter state
    setFilters(prevFilters => {
      const updatedFilters = prevFilters.map(filter => {
        if (filter.id === filterId) {
          // Create a deep copy of the filter with a new reference
          const updatedFilter = {
            ...filter,
            attributeFilters: { ...filter.attributeFilters }
          };
          
          // Initialize the dataset's attribute filters if they don't exist
          if (!updatedFilter.attributeFilters[datasetName]) {
            updatedFilter.attributeFilters[datasetName] = {};
          } else {
            // Create a new reference for this dataset's filters
            updatedFilter.attributeFilters[datasetName] = { ...updatedFilter.attributeFilters[datasetName] };
          }
          
          // Initialize the attribute array if it doesn't exist
          if (!updatedFilter.attributeFilters[datasetName][attributeName]) {
            updatedFilter.attributeFilters[datasetName][attributeName] = [];
          } else {
            // Create a new array reference
            updatedFilter.attributeFilters[datasetName][attributeName] = [...updatedFilter.attributeFilters[datasetName][attributeName]];
          }
          
          // Toggle the value
          if (isAdding) {
            // Add the value if it's not already selected
            updatedFilter.attributeFilters[datasetName][attributeName].push(value);
            console.log(`Added ${value} to ${attributeName} filters`);
          } else {
            // Remove the value if it's already selected
            updatedFilter.attributeFilters[datasetName][attributeName].splice(valueIndex, 1);
            console.log(`Removed ${value} from ${attributeName} filters`);
          }
          
          console.log('Updated filter:', updatedFilter.attributeFilters[datasetName][attributeName]);
          return updatedFilter;
        }
        return filter;
      });
      
      return updatedFilters;
    });
    
    // Create a direct update to the filter context to ensure synchronization
    // This bypasses the React state update cycle and ensures immediate filter application
    const updatedFilterState = {
      ...filterState,
      filters: filterState.filters.map((filter: Filter) => {
        if (filter.id === filterId) {
          // Deep clone the filter
          const updatedFilter = JSON.parse(JSON.stringify(filter)) as Filter;
          
          // Make sure the attribute filters structure exists
          if (!updatedFilter.attributeFilters) updatedFilter.attributeFilters = {};
          if (!updatedFilter.attributeFilters[datasetName]) updatedFilter.attributeFilters[datasetName] = {};
          if (!updatedFilter.attributeFilters[datasetName][attributeName]) {
            updatedFilter.attributeFilters[datasetName][attributeName] = [];
          }
          
          // Apply the change directly
          if (isAdding) {
            updatedFilter.attributeFilters[datasetName][attributeName].push(value);
          } else {
            const idx = updatedFilter.attributeFilters[datasetName][attributeName].indexOf(value);
            if (idx !== -1) {
              updatedFilter.attributeFilters[datasetName][attributeName].splice(idx, 1);
            }
          }
          
          return updatedFilter;
        }
        return filter;
      })
    };
    
    // Update the filter context immediately
    setFilterState(updatedFilterState);
    
    // Log the updated filter state for debugging
    console.log('Direct filter state update:', updatedFilterState);
    
    // Trigger any callback for filtered data changes
    if (onFilteredDataChange) {
      onFilteredDataChange();
    }
  };
  
  // Function to toggle a selector within a filter
  const toggleSelector = (filterId: string, selector: string) => {
    setFilters(prevFilters => {
      return prevFilters.map(filter => {
        if (filter.id === filterId) {
          return {
            ...filter,
            openSelector: filter.openSelector === selector ? null : selector
          }
        }
        return filter
      })
    })
  }
  
  // Function to toggle a filter's expanded/collapsed state
  const toggleFilterExpanded = (filterId: string) => {
    setFilters(prevFilters => {
      return prevFilters.map(filter => {
        if (filter.id === filterId) {
          return {
            ...filter,
            isOpen: !filter.isOpen
          }
        }
        return filter
      })
    })
  }
  
  // Function to add a new filter
  const addNewFilter = () => {
    const newFilter = createNewFilter()
    setFilters(prevFilters => [...prevFilters, newFilter])
    setActiveFilterId(newFilter.id)
  }
  
  // Function to remove a filter
  const removeFilter = (filterId: string) => {
    setFilters(prevFilters => {
      const updatedFilters = prevFilters.filter(filter => filter.id !== filterId)
      
      // If we're removing the active filter, set a new active filter
      if (filterId === activeFilterId && updatedFilters.length > 0) {
        setActiveFilterId(updatedFilters[0].id)
      } else if (updatedFilters.length === 0) {
        // If no filters left, create a new one
        const newFilter = createNewFilter()
        setActiveFilterId(newFilter.id)
        return [newFilter]
      }
      
      return updatedFilters
    })
    // Reset the filter to delete
    setFilterToDelete(null)
  }
  
  // Function to open the delete confirmation dialog
  const confirmDeleteFilter = (filterId: string) => {
    setFilterToDelete(filterId)
  }
  
  // Function to rename a filter
  const renameFilter = (filterId: string, newName: string) => {
    setFilters(prevFilters => {
      return prevFilters.map(filter => {
        if (filter.id === filterId) {
          return {
            ...filter,
            name: newName
          }
        }
        return filter
      })
    })
  }
  
  // Function to toggle a filter's active state
  const toggleFilterActive = (filterId: string) => {
    setFilters(prevFilters => {
      return prevFilters.map(filter => {
        if (filter.id === filterId) {
          return {
            ...filter,
            active: !filter.active
          }
        }
        return filter
      })
    })
  }

  const getLocationOverview = (filter: Filter) => {
    // If we have location selections, use those for the overview
    if (filter.locationSelections && filter.locationSelections.length > 0) {
      // Format each selection in the same way as location-selector.tsx
      const formattedSelections = filter.locationSelections.map(selection => {
        let content = "";
        
        switch (selection.type) {
          case "intersection":
            // Handle intersection selection
            // For intersection, the selection is a string like "I-65 ∩ Fort Wayne"
            if (Array.isArray(selection.selection)) {
              content = `Intersection: ${selection.selection.join(" | ")}`;
            } else {
              // Display the intersection name directly without any prefix
              content = selection.selection as string;
              
              // If the content is empty, create a fallback display
              if (!content || content.trim() === '') {
                content = 'Road Intersection';
              }
            }
            break;
          case "polygon":
            // Handle polygon selection
            const polygonData = selection.selection as any;
            
            // Check if this is an intersection with a name
            if (polygonData.type === 'Intersection' && polygonData.name) {
              // Use the intersection name (road ∩ subdivision)
              content = polygonData.name;
            } else {
              // Fallback to the old behavior for other polygon types
              const boundingBox = polygonData.boundingBox;
              content = boundingBox ? 
                `Custom Area: SW(${boundingBox.southwest[0].toFixed(4)}, ${boundingBox.southwest[1].toFixed(4)}) - NE(${boundingBox.northeast[0].toFixed(4)}, ${boundingBox.northeast[1].toFixed(4)})` :
                `Custom ${polygonData.type} Area`;
            }
            break;
          case "road":
            if (Array.isArray(selection.selection)) {
              content = `Roads: ${selection.selection.join(" | ")}`;
            } else {
              // Make sure we're dealing with a string selection
              const road = selection.selection as string;
              const range = selection.mileMarkerRange;
              content = range ? `Road: ${road} (MM ${range.min}-${range.max})` : road;
            }
            break;
          case "poi":
            if (Array.isArray(selection.selection)) {
              content = `PoIs: ${selection.selection.join(" | ")}`;
            } else {
              content = `PoI: ${selection.selection as string}`;
              // Add radius information if available
              if (selection.poiRadius !== undefined && selection.poiRadius > 0) {
                content += ` (${selection.poiRadius} mi radius)`;
              }
            }
            break;
          case "city":
            if (Array.isArray(selection.selection)) {
              content = `Cities: ${selection.selection.join(" | ")}`;
            } else {
              // Check if this is a Point of Interest (has poiRadius property)
              if (selection.poiRadius !== undefined) {
                content = `PoI: ${selection.selection as string}`;
                // Add radius information if available
                if (selection.poiRadius > 0) {
                  content += ` (${selection.poiRadius} mi radius)`;
                }
              } else {
                content = `City: ${selection.selection as string}`;
              }
            }
            break;
          case "district":
            if (Array.isArray(selection.selection)) {
              content = `Districts: ${selection.selection.join(" | ")}`;
            } else {
              content = `District: ${selection.selection as string}`;
            }
            break;
          case "subdistrict":
            if (Array.isArray(selection.selection)) {
              content = `Subdistricts: ${selection.selection.join(" | ")}`;
            } else {
              content = `Subdistrict: ${selection.selection as string}`;
            }
            break;
          case "county":
            if (Array.isArray(selection.selection)) {
              content = `Counties: ${selection.selection.join(" | ")}`;
            } else {
              content = `County: ${selection.selection as string}`;
            }
            break;
        }
        
        return content;
      });
      
      // Join all formatted selections with a pipe separator
      return formattedSelections.join(' | ');
    }
    
    // Fall back to the old method if no selections
    const allLocations = [...filter.locations.roads, ...filter.locations.cities, ...filter.locations.districts];
    if (allLocations.length === 0) return "No specific location selected (fetching all)";
    if (allLocations.length <= 3) return `Selected: ${allLocations.join(", ")}`;
    return `Selected: ${allLocations.slice(0, 2).join(", ")} + ${allLocations.length - 2} more`;
  }

  // Create references to store the getSummary functions from selector components
  const timeframeSummaryRef = { getSummary: null as null | (() => string) }
  const datasetSummaryRef = { getSummary: null as null | (() => string) }
  
  const getTimeframeOverview = (filter: Filter) => {
    // Check if we have access to the getSummary function from the TimeframeSelector component
    if (timeframeSummaryRef.getSummary) {
      return timeframeSummaryRef.getSummary();
    }
    
    // Check if we have timeframe selections
    if (filter.timeframeSelections && filter.timeframeSelections.length > 0) {
      const parts: string[] = [];
      
      // Process each selection based on its type
      filter.timeframeSelections.forEach(selection => {
        switch (selection.type) {
          case "dateRange": {
            const formatDate = (date: Date) => {
              return date.toLocaleDateString('en-US', { 
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
            };
            parts.push(`${formatDate(selection.range.start)} to ${formatDate(selection.range.end)}`);
            break;
          }
          case "weekdays": {
            const weekdays = selection.weekdays;
            let weekdayStr = "";
            
            if (weekdays.length === 7) {
              weekdayStr = "Every day";
            } else if (weekdays.length === 5 &&
                      weekdays.includes("Mon") &&
                      weekdays.includes("Tue") &&
                      weekdays.includes("Wed") &&
                      weekdays.includes("Thu") &&
                      weekdays.includes("Fri")) {
              weekdayStr = "Weekdays";
            } else if (weekdays.length === 2 &&
                      weekdays.includes("Sat") &&
                      weekdays.includes("Sun")) {
              weekdayStr = "Weekends";
            } else {
              weekdayStr = `${weekdays.slice(0, weekdays.length - 1).join(", ")}${weekdays.length > 1 ? " and " : ""}${weekdays[weekdays.length - 1]}`;
            }
            
            parts.push(`${weekdayStr} each week`);
            break;
          }
          case "monthDays": {
            const monthDays = selection.monthDays;
            const formattedDays = monthDays.map(day => {
              if (day === "1" || day === "21" || day === "31") return `${day}st`;
              if (day === "2" || day === "22") return `${day}nd`;
              if (day === "3" || day === "23") return `${day}rd`;
              if (day === "last") return "last day";
              return `${day}th`;
            });
            
            let monthDayStr = "";
            if (formattedDays.length <= 3) {
              monthDayStr = `The ${formattedDays.slice(0, formattedDays.length - 1).join(", ")}${formattedDays.length > 1 ? " and " : ""}${formattedDays[formattedDays.length - 1]} of each month`;
            } else {
              monthDayStr = `${monthDays.length} selected days of the month`;
            }
            
            parts.push(monthDayStr);
            break;
          }
          case "holidays": {
            const holidayIds = selection.holidays;
            
            // Convert IDs to friendly names using the imported HOLIDAY_NAMES
            const holidayFriendlyNames = holidayIds.map(id => HOLIDAY_NAMES[id] || id);
            
            if (holidayFriendlyNames.length <= 3) {
              parts.push(`${holidayFriendlyNames.slice(0, holidayFriendlyNames.length - 1).join(", ")}${holidayFriendlyNames.length > 1 ? " and " : ""}${holidayFriendlyNames[holidayFriendlyNames.length - 1]}`);
            } else {
              parts.push(`${holidayFriendlyNames.length} selected holidays`);
            }
            break;
          }
          case "monthWeek": {
            parts.push(`The ${selection.monthWeek} ${selection.monthWeekday} of the year`);
            break;
          }
          case "hours": {
            const formatHour = (hour: number) => {
              if (hour === 0 || hour === 24) return "12 AM";
              if (hour === 12) return "12 PM";
              return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
            };
            
            if (selection.hours.length === 2) {
              parts.push(`${formatHour(selection.hours[0])} to ${formatHour(selection.hours[1])}`);
            }
            break;
          }
        }
      });
      
      // Join all parts with semicolons
      return parts.join("; ");
    }
    
    // Fallback to the old format if no timeframe selections
    if (filter.timeframe) {
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      };
      
      return `${formatDate(filter.timeframe.start)} to ${formatDate(filter.timeframe.end)}`;
    }
    
    // Show default date range (last 7 days to today) instead of "No timeframe selected"
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 7);
    const defaultEndDate = new Date();
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };
    
    return `${formatDate(defaultStartDate)} to ${formatDate(defaultEndDate)}`;
  }
  
  // State to store dataset metadata for name lookups
  const [datasetMetadata, setDatasetMetadata] = useState<Record<string, string>>({});

  // Fetch dataset metadata for proper name display
  useEffect(() => {
    const fetchDatasetNames = async () => {
      try {
        const datasources = await fetchDataSourcesMetadata();
        const metadataMap = datasources.reduce((acc: Record<string, string>, source: DataSourceMetadata) => {
          acc[source.datasource_tablename] = source.datasource_name;
          return acc;
        }, {} as Record<string, string>);
        setDatasetMetadata(metadataMap);
      } catch (error) {
        console.error('Error fetching dataset metadata:', error);
      }
    };

    fetchDatasetNames();
  }, []);

  // Function to get a summary of the selected datasets
  const getDatasetOverview = (filter: Filter) => {
    // Check if we have access to the getSummary function from the DynamicDatasetSelector component
    if (datasetSummaryRef.getSummary) {
      return "Datasets: " + datasetSummaryRef.getSummary();
    }
    
    // Fallback implementation if the reference is not available
    if (filter.selectedDatasets.length === 0) {
      return "No datasets selected";
    }
    
    // Map table names to display names using the metadata
    const datasetDisplayNames = filter.selectedDatasets.map(tableName => 
      datasetMetadata[tableName] || tableName
    );
    
    if (datasetDisplayNames.length <= 3) {
      return datasetDisplayNames.join(", ");
    }
    
    return "Datasets: " + `${datasetDisplayNames.slice(0, 2).join(", ")} + ${datasetDisplayNames.length - 2} more`;
  }
  
  // State to store query results for map visualization
  // queryResults is now managed through context
  
  // Execute query against the API based on active filters
  const executeFilterQuery = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the active filter
      const activeFilter = filters.find(f => f.id === activeFilterId && f.active);
      
      if (!activeFilter) {
        setError('No active filter selected.');
        setIsLoading(false);
        return;
      }
      
      // Build location filter from active filter
      const locationFilter: LocationFilter = {
        route: [],
        region: [],
        county: [],
        city: [],
        locationSelections: activeFilter.locationSelections // Add the full locationSelections array
      };
      
      // Process location selections if available
      if (activeFilter.locationSelections && activeFilter.locationSelections.length > 0) {
        // Find the operator between location selections (default to AND if not specified)
        let operator: 'AND' | 'OR' = 'AND';
        
        // Look for an operator in the location selections
        for (const selection of activeFilter.locationSelections) {
          if (selection.operator) {
            operator = selection.operator;
            break; // Use the first operator found
          }
        }
        
        // Set the logic operator for the location filter
        locationFilter.logic = operator;
        
        // Initialize polygons array if needed
        if (!locationFilter.polygons) {
          locationFilter.polygons = [];
        }
        
        // Process each location selection
        activeFilter.locationSelections.forEach(selection => {
          if (selection.type === 'road' && selection.selection) {
            // Make sure we're dealing with string or string[] for roads
            if (typeof selection.selection === 'string' || Array.isArray(selection.selection)) {
              const roads = Array.isArray(selection.selection) ? selection.selection : [selection.selection];
              if (locationFilter.route) {
                locationFilter.route.push(...roads);
              }
            }
          } else if (selection.type === 'district' && selection.selection) {
            // Make sure we're dealing with string or string[] for districts
            if (typeof selection.selection === 'string' || Array.isArray(selection.selection)) {
              const districts = Array.isArray(selection.selection) ? selection.selection : [selection.selection];
              if (locationFilter.region) {
                locationFilter.region.push(...districts);
              }
            }
          } else if (selection.type === 'city' && selection.selection) {
            // Make sure we're dealing with string or string[] for cities
            if (typeof selection.selection === 'string' || Array.isArray(selection.selection)) {
              // Check if this is a POI (has poiRadius property)
              if (selection.poiRadius === undefined || selection.poiRadius <= 0) {
                // Only add to city array if it's not a POI
                const cities = Array.isArray(selection.selection) ? selection.selection : [selection.selection];
                if (locationFilter.city) {
                  locationFilter.city.push(...cities);
                }
              }
            }
          } else if (selection.type === 'county' && selection.selection) {
            // Make sure we're dealing with string or string[] for counties
            if (typeof selection.selection === 'string' || Array.isArray(selection.selection)) {
              const counties = Array.isArray(selection.selection) ? selection.selection : [selection.selection];
              if (locationFilter.county) {
                locationFilter.county.push(...counties);
              }
            }
          } else if (selection.type === 'polygon' && selection.selection && !Array.isArray(selection.selection) && typeof selection.selection !== 'string') {
            // Handle polygon selection
            // The selection is a PolygonCoordinates object
            const polygonData = selection.selection as any; // Using any to avoid type issues
            if (polygonData.coordinates && polygonData.type) {
              locationFilter.polygons?.push(polygonData);
              console.log('Added polygon to location filter:', polygonData);
            }
          }
        });
      }
      
      // Build time filter from active filter
      const timeFilter: TimeFilter = {
        startDate: activeFilter.timeframe?.start,
        endDate: activeFilter.timeframe?.end
      };
      
      // Process timeframe selections if available
      if (activeFilter.timeframeSelections && activeFilter.timeframeSelections.length > 0) {
        // Find the operator between time selections (default to AND if not specified)
        let operator: 'AND' | 'OR' = 'AND';
        
        // Look for an operator in the timeframe selections
        for (const selection of activeFilter.timeframeSelections) {
          if (selection.operator) {
            operator = selection.operator;
            break; // Use the first operator found
          }
        }
        
        // Set the logic operator for the time filter
        timeFilter.logic = operator;
        
        // Find date range selections
        const dateRangeSelection = activeFilter.timeframeSelections.find(s => s.type === 'dateRange');
        if (dateRangeSelection && dateRangeSelection.type === 'dateRange' && dateRangeSelection.range) {
          timeFilter.startDate = format(dateRangeSelection.range.start, 'yyyy-MM-dd');
          timeFilter.endDate = format(dateRangeSelection.range.end, 'yyyy-MM-dd');
        }
        
        // Find weekday selections
        const weekdaysSelection = activeFilter.timeframeSelections.find(s => s.type === 'weekdays');
        if (weekdaysSelection && weekdaysSelection.type === 'weekdays' && weekdaysSelection.weekdays.length > 0) {
          timeFilter.weekdays = weekdaysSelection.weekdays;
          console.log('Added weekdays to time filter:', timeFilter.weekdays);
        }
        
        // Find hours selections
        const hoursSelection = activeFilter.timeframeSelections.find(s => s.type === 'hours');
        if (hoursSelection && hoursSelection.type === 'hours' && hoursSelection.hours.length > 0) {
          // Convert number[] to string[] for consistency with the TimeFilter interface
          timeFilter.hours = hoursSelection.hours.map(h => h.toString());
          console.log('Added hours to time filter:', timeFilter.hours);
        }
        
        // Find month days selections
        const monthDaysSelection = activeFilter.timeframeSelections.find(s => s.type === 'monthDays');
        if (monthDaysSelection && monthDaysSelection.type === 'monthDays' && monthDaysSelection.monthDays.length > 0) {
          timeFilter.monthDays = monthDaysSelection.monthDays;
          console.log('Added month days to time filter:', timeFilter.monthDays);
        }
        
        // Find holiday selections
        const holidaysSelection = activeFilter.timeframeSelections.find(s => s.type === 'holidays');
        if (holidaysSelection && holidaysSelection.type === 'holidays' && holidaysSelection.holidays.length > 0) {
          timeFilter.holidays = holidaysSelection.holidays;
          console.log('Added holidays to time filter:', timeFilter.holidays);
        }
        
        // Find granularity selection
        const granularitySelection = activeFilter.timeframeSelections.find(s => s.type === 'granularity');
        if (granularitySelection && granularitySelection.type === 'granularity') {
          timeFilter.granularity = granularitySelection.granularity;
          console.log('Added granularity to time filter:', timeFilter.granularity);
        }
      }
      
      // Build query request
      const queryRequest = await buildQueryRequest(
        activeFilter.selectedDatasets,
        activeFilter.attributeFilters,
        locationFilter,
        timeFilter
      );
      
      console.log('Executing query with request:', JSON.stringify(queryRequest, null, 2));
      
      // Execute the query
      const results = await executeQuery(queryRequest);
      
      console.log('Query results:', JSON.stringify(results, null, 2));
      
      // Debug: Check if we have results and if they contain readable_coordinates
      if (results && results.results) {
        Object.entries(results.results).forEach(([tableName, items]: [string, any]) => {
          if (Array.isArray(items)) {
            console.log(`Dataset ${tableName} has ${items.length} items`);
            // Check first item for readable_coordinates
            if (items.length > 0) {
              console.log(`Sample item from ${tableName}:`, items[0]);
              console.log(`Has readable_coordinates: ${!!items[0].readable_coordinates}`);
              
              // Detailed analysis of all fields in the item
              const sampleItem = items[0];
              console.log(`All fields in ${tableName} item:`, Object.keys(sampleItem));
              
              // Specifically look for date fields
              const possibleDateFields = Object.keys(sampleItem).filter(key => 
                key.toLowerCase().includes('date') || key.toLowerCase().includes('time')
              );
              
              if (possibleDateFields.length > 0) {
                console.log(`Possible date fields in ${tableName}:`, possibleDateFields);
                possibleDateFields.forEach(field => {
                  console.log(`Field ${field} value:`, sampleItem[field]);
                  // Try to parse as date
                  try {
                    const date = new Date(sampleItem[field]);
                    console.log(`Parsed as date:`, date, `Valid:`, !isNaN(date.getTime()));
                  } catch (e) {
                    console.log(`Could not parse ${field} as date`);
                  }
                });
              } else {
                console.log(`No date fields found in ${tableName}`);
              }
              
              if (sampleItem.readable_coordinates) {
                try {
                  const coords = JSON.parse(sampleItem.readable_coordinates);
                  console.log(`Parsed coordinates:`, coords);
                } catch (e) {
                  console.error(`Error parsing coordinates for ${tableName}:`, e);
                }
              }
            }
          }
        });
      }
      
      // Store the results for map visualization
      setContextQueryResults(results);
      
      // Update filtered count and prepare results summary
      let totalResults = 0;
      const resultsByDataset: Record<string, number> = {};
      
      if (results && results.results) {
        console.log('Processing results structure:', results.results);
        
        // Handle both array and object formats of results
        if (Array.isArray(results.results)) {
          // Format: results.results is an array of objects, each object represents a table
          results.results.forEach((resultItem: Record<string, any>) => {
            if (resultItem && typeof resultItem === 'object') {
              // Each result item might contain multiple tables
              Object.entries(resultItem).forEach(([tableName, datasetResults]: [string, any]) => {
                if (Array.isArray(datasetResults)) {
                  const count = datasetResults.length;
                  totalResults += count;
                  // Add to existing count or initialize
                  resultsByDataset[tableName] = (resultsByDataset[tableName] || 0) + count;
                  console.log(`Added ${count} results from table ${tableName}`);
                }
              });
            }
          });
        } else if (typeof results.results === 'object') {
          // Format: results.results is an object with dataset names as keys
          Object.entries(results.results).forEach(([tableName, datasetResults]: [string, any]) => {
            if (Array.isArray(datasetResults)) {
              const count = datasetResults.length;
              totalResults += count;
              resultsByDataset[tableName] = count;
              console.log(`Added ${count} results from table ${tableName}`);
            }
          });
        }
        
        console.log('Final results summary:', { total: totalResults, byDataset: resultsByDataset });
      }
      
      // Set results summary for display in the collapsible card
      setResultsSummary({
        total: totalResults,
        byDataset: resultsByDataset
      });
      
      // Always open the results panel and scroll to it
      setIsResultsOpen(true);
      
      if (totalResults === 0) {
        // Set no results found flag
        setNoResultsFound(true);
        setShowResultsHighlight(false);
        
        // Show toast notification
        toast({
          title: "No Results Found",
          description: "Your query did not return any results. Try adjusting your filters.",
          variant: "destructive",
        });
      } else {
        // Results found case
        setNoResultsFound(false);
        setShowResultsHighlight(true);
      }
      
      // Scroll to the results section in both cases
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Turn off highlights after animation completes
        setTimeout(() => {
          setShowResultsHighlight(false);
          setNoResultsFound(false);
        }, 3000);
      }, 100);
      
      // Dispatch a custom event to notify the map view of new data
      const mapDataEvent = new CustomEvent('map-data-updated', { detail: results });
      window.dispatchEvent(mapDataEvent);
      
      // Collapse the filter panel after requesting data
      setFilters(prevFilters => {
        return prevFilters.map(filter => {
          if (filter.id === activeFilterId) {
            return {
              ...filter,
              isOpen: false
            };
          }
          return filter;
        });
      });
    } catch (err: any) {
      console.error('Error executing query:', err);
      
      // Check if it's a 504 Gateway Timeout error
      if (err.message && (err.message.includes('504 Gateway Time-out') || err.message.includes('status 504'))) {
        setError('Server timeout: The request is taking longer than expected. Please try again with a smaller time range or fewer filters.');
      } else {
        setError(`Failed to execute query: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
<div className="h-full flex flex-col p-4 overflow-y-auto">
    <div className="mb-4">

      <div className="flex items-center space-x-2">

        <div className="relative group">
          <div className="relative">
            <Button
              onClick={() => {
                // Toggle dropdown visibility
                const dropdown = document.getElementById('savedRequestsDropdown');
                if (dropdown) {
                  dropdown.classList.toggle('hidden');
                }
              }}
              variant="outline"
              className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-gray-800 border rounded-md hover:bg-gray-50 transition-colors"
            >
              Load Request
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
            <div id="savedRequestsDropdown" className="absolute z-50 hidden mt-1 w-72 bg-white border rounded-md shadow-lg">
              <div className="p-2">
                {/* Search input */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="Search requests..."
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={requestSearchTerm}
                    onChange={(e) => setRequestSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {requestSearchTerm && (
                    <button 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRequestSearchTerm("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {/* Request list */}
                <div className="max-h-60 overflow-y-auto">
                  {savedRequests
                    .filter(request => request.toLowerCase().includes(requestSearchTerm.toLowerCase()))
                    .map((request, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                        onClick={() => {
                          // Load the saved request
                          document.getElementById('savedRequestsDropdown')?.classList.add('hidden');
                          addNewFilter();
                        }}
                      >
                        {request}
                      </button>
                    ))}
                  
                  {/* No results message */}
                  {requestSearchTerm && savedRequests.filter(request => 
                    request.toLowerCase().includes(requestSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-500 italic">
                      No matching requests found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-yellow-600 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
            In Progress
          </span>
        </div>

      </div>
    </div>

      {/* <div className="space-y-4 border-2 border-gray-200 rounded-lg p-3 pb-2"> */}
        {filters.map((filter) => (
          <Card key={filter.id} className={`mb-3 ${filter.active ? 'border-gray-300' : 'border-gray-200'} ${activeFilterId === filter.id ? 'shadow-sm' : ''}`}>
            <CardHeader className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-7 w-7"
                    onClick={() => toggleFilterExpanded(filter.id)}
                  >
                    {filter.isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  
                  <div className="flex items-center">
                    {activeFilterId === filter.id ? (
                      <div className="flex items-center justify-between w-full">
                        <h3 className="text-base font-semibold">Start New Request</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 px-2 py-1 flex items-center gap-1 text-xs text-black hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            const name = prompt('Enter a name for this request:');
                            if (name) {
                              renameFilter(filter.id, name);
                              // Save the request logic would go here
                              alert('Request saved as: ' + name);
                            }
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-save"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <CardTitle 
                        className="text-lg cursor-pointer" 
                        onClick={() => setActiveFilterId(filter.id)}
                      >
                        {filter.name}
                      </CardTitle>
                    )}

                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                </div>
              </div>
              
              {!filter.isOpen && (
                <div className="px-4 pb-4 ">
                {/* Summary text above tabs */}
                <div className="mb-3">
                  {(() => {
                    if (!filter.selectedDatasets || filter.selectedDatasets.length === 0) {
                      return (
                        <p className="text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Please select a dataset to get started.
                        </p>
                      );
                    }
                    
                    // Get the start and end dates from the filter
                    // Default to today and one week ago if not set
                    const today = new Date();
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(today.getDate() - 7);
                    
                    const startDate = filter.timeframe?.start ? new Date(filter.timeframe.start).toLocaleDateString() : oneWeekAgo.toLocaleDateString();
                    const endDate = filter.timeframe?.end ? new Date(filter.timeframe.end).toLocaleDateString() : today.toLocaleDateString();
                    
                    // Determine location dimension
                    let locationText = 'in all locations';
                    
                    // Create arrays to hold the different location parts
                    const locationParts = [];
                    
                    // Check for each type of location and add to the appropriate array
                    if (filter.locations.roads && filter.locations.roads.length > 0) {
                      locationParts.push(`on ${filter.locations.roads.join(', ')}`);
                    }
                    
                    if (filter.locations.cities && filter.locations.cities.length > 0) {
                      locationParts.push(`in ${filter.locations.cities.join(', ')}`);
                    }
                    
                    if (filter.locations.districts && filter.locations.districts.length > 0) {
                      locationParts.push(`in ${filter.locations.districts.join(', ')}`);
                    }
                    
                    if (filter.locations.pointsOfInterest && filter.locations.pointsOfInterest.length > 0) {
                      locationParts.push(`at ${filter.locations.pointsOfInterest.join(', ')}`);
                    }
                    
                    // Combine all location parts if there are any
                    if (locationParts.length > 0) {
                      locationText = locationParts.join(' and ');
                    }
                    
                    // Get dataset names using the metadata mapping for proper display names
                    let datasetText = '';
                    
                    if (filter.selectedDatasets.length === 1) {
                      // Single dataset
                      datasetText = datasetMetadata[filter.selectedDatasets[0]] || filter.selectedDatasets[0];
                    } else if (filter.selectedDatasets.length === 2) {
                      // Two datasets - show correlation between them
                      const dataset1 = datasetMetadata[filter.selectedDatasets[0]] || filter.selectedDatasets[0];
                      const dataset2 = datasetMetadata[filter.selectedDatasets[1]] || filter.selectedDatasets[1];
                      datasetText = `correlation between ${dataset1} and ${dataset2}`;
                    } else if (filter.selectedDatasets.length > 2) {
                      // Multiple datasets - show all by name
                      const datasetNames = filter.selectedDatasets.map(ds => datasetMetadata[ds] || ds);
                      datasetText = datasetNames.join(', ');
                    } else {
                      // No datasets selected
                      datasetText = 'no datasets';
                    }
                    
                    return (
                      <p className="bg-blue-50 px-2 py-1 rounded">
                        Viewing <span className="font-medium">{datasetText}</span> from <span className="font-medium">{startDate}</span> to <span className="font-medium">{endDate}</span>
                        <span className="font-medium"> {locationText}</span>
                      </p>
                    );
                  })()}
                </div>

                </div>
              )}
            </CardHeader>
            
            {filter.isOpen && (
              <div className="px-4">
                {/* Summary text above tabs */}
                <div className="mb-3">
                  {(() => {
                    if (!filter.selectedDatasets || filter.selectedDatasets.length === 0) {
                      return (
                        <p className="text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Please select a dataset to get started.
                        </p>
                      );
                    }
                    
                    // Get the start and end dates from the filter
                    // Default to today and one week ago if not set
                    const today = new Date();
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(today.getDate() - 7);
                    
                    const startDate = filter.timeframe?.start ? new Date(filter.timeframe.start).toLocaleDateString() : oneWeekAgo.toLocaleDateString();
                    const endDate = filter.timeframe?.end ? new Date(filter.timeframe.end).toLocaleDateString() : today.toLocaleDateString();
                    
                    // Determine location dimension
                    let locationText = 'in all locations';
                    
                    // Create arrays to hold the different location parts
                    const locationParts = [];
                    
                    // Check for each type of location and add to the appropriate array
                    if (filter.locations.roads && filter.locations.roads.length > 0) {
                      locationParts.push(`on ${filter.locations.roads.join(', ')}`);
                    }
                    
                    if (filter.locations.cities && filter.locations.cities.length > 0) {
                      locationParts.push(`in ${filter.locations.cities.join(', ')}`);
                    }
                    
                    if (filter.locations.districts && filter.locations.districts.length > 0) {
                      locationParts.push(`in ${filter.locations.districts.join(', ')}`);
                    }
                    
                    if (filter.locations.pointsOfInterest && filter.locations.pointsOfInterest.length > 0) {
                      locationParts.push(`at ${filter.locations.pointsOfInterest.join(', ')}`);
                    }
                    
                    // Combine all location parts if there are any
                    if (locationParts.length > 0) {
                      locationText = locationParts.join(' and ');
                    }
                    
                    // Get dataset names using the metadata mapping for proper display names
                    let datasetText = '';
                    
                    if (filter.selectedDatasets.length === 1) {
                      // Single dataset
                      datasetText = datasetMetadata[filter.selectedDatasets[0]] || filter.selectedDatasets[0];
                    } else if (filter.selectedDatasets.length === 2) {
                      // Two datasets - show correlation between them
                      const dataset1 = datasetMetadata[filter.selectedDatasets[0]] || filter.selectedDatasets[0];
                      const dataset2 = datasetMetadata[filter.selectedDatasets[1]] || filter.selectedDatasets[1];
                      datasetText = `correlation between ${dataset1} and ${dataset2}`;
                    } else if (filter.selectedDatasets.length > 2) {
                      // Multiple datasets - show all by name
                      const datasetNames = filter.selectedDatasets.map(ds => datasetMetadata[ds] || ds);
                      datasetText = datasetNames.join(', ');
                    } else {
                      // No datasets selected
                      datasetText = 'no datasets';
                    }
                    
                    return (
                      <p className="bg-blue-50 px-2 py-1 rounded">
                        Viewing <span className="font-medium">{datasetText}</span> from <span className="font-medium">{startDate}</span> to <span className="font-medium">{endDate}</span>
                        <span className="font-medium"> {locationText}</span>
                      </p>
                    );
                  })()}
                </div>
                {/* Horizontal Tabs for Filters */}
                <div className="w-full">
                  {/* Tab Navigation */}
                  <div className="flex justify-between border-b mb-4 w-full">
                    <div 
                      className={`flex items-center justify-center gap-2 px-4 py-3 cursor-pointer flex-1 ${filter.openSelector === 'dataset' ? 'border-b-2 border-black text-black font-bold' : 'text-gray-600'}`}
                      onClick={() => toggleSelector(filter.id, 'dataset')}
                    >
                      <Database className="h-5 w-5" />
                      <span className="text-sm font-bold">Datasets</span>
                    </div>
                    <div 
                      className={`flex items-center justify-center gap-2 px-4 py-3 cursor-pointer flex-1 ${filter.openSelector === 'timeframe' ? 'border-b-2 border-black text-black font-bold' : 'text-gray-600'}`}
                      onClick={() => toggleSelector(filter.id, 'timeframe')}
                    >
                      <Calendar className="h-5 w-5" />
                      <span className="text-sm font-bold">Time</span>
                    </div>
                    <div 
                      className={`flex items-center justify-center gap-2 px-4 py-3 cursor-pointer flex-1 ${filter.openSelector === 'location' ? 'border-b-2 border-black text-black font-bold' : 'text-gray-600'}`}
                      onClick={() => toggleSelector(filter.id, 'location')}
                    >
                      <MapPin className="h-5 w-5" />
                      <span className="text-sm font-bold">Location</span>
                    </div>
                  </div>
                  
                  {/* Tab Content */}
                  <div className="mt-2 pb-3">
                    {/* Dataset Tab Content */}
                    {filter.openSelector === 'dataset' && (
                      <div>
                        <CauseEffectDatasetSelector
                          filterId={filter.id}
                          selectedDatasets={filter.selectedDatasets}
                          onDatasetChange={(newDatasets: string[]) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, selectedDatasets: newDatasets} : f
                            ));
                          }}
                          attributeFilters={filter.attributeFilters}
                          timeframeSelections={filter.timeframeSelections || []}
                          onFilterChange={(datasetId: string, attributeName: string, values: string[]) => {
                            setFilters(prevFilters => prevFilters.map(f => {
                              if (f.id === filter.id) {
                                const updatedAttributeFilters = { ...f.attributeFilters };
                                if (!updatedAttributeFilters[datasetId]) {
                                  updatedAttributeFilters[datasetId] = {};
                                }
                                updatedAttributeFilters[datasetId][attributeName] = values;
                                return { ...f, attributeFilters: updatedAttributeFilters };
                              }
                              return f;
                            }));
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Timeframe Tab Content */}
                    {filter.openSelector === 'timeframe' && (
                      <div>
                        <TimelineSelector
                          selections={filter.timeframeSelections || []}
                          onSelectionsChange={(selections: TimeframeSelection[]) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, timeframeSelections: selections} : f
                            ));
                            
                            // Update the legacy timeframe format if there's a date range selection
                            // This ensures backward compatibility
                            const dateRangeSelection = selections.find((s: TimeframeSelection) => s.type === "dateRange");
                            if (dateRangeSelection && dateRangeSelection.type === "dateRange") {
                              const { start, end } = dateRangeSelection.range;
                              setFilters(prevFilters => prevFilters.map(f => 
                                f.id === filter.id ? {
                                  ...f, 
                                  timeframe: { 
                                    start: start.toISOString(), 
                                    end: end.toISOString() 
                                  }
                                } : f
                              ));
                            } else if (selections.length === 0) {
                              // Clear timeframe if no selections
                              setFilters(prevFilters => prevFilters.map(f => 
                                f.id === filter.id ? {...f, timeframe: null} : f
                              ));
                            }
                          }}
                          getSummaryRef={timeframeSummaryRef}
                        />
                      </div>
                    )}
                    
                    {/* Location Tab Content */}
                    {filter.openSelector === 'location' && (
                      <div>
                        <LocationSelector
                          selectedRoads={filter.locations.roads}
                          onSelectedRoadsChange={(roads) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, locations: {...f.locations, roads}} : f
                            ));
                          }}
                          selectedLocations={filter.locations.cities}
                          onSelectedLocationsChange={(cities) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, locations: {...f.locations, cities}} : f
                            ));
                          }}
                          selectedDistricts={filter.locations.districts}
                          onSelectedDistrictsChange={(districts) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, locations: {...f.locations, districts}} : f
                            ));
                          }}
                          roadMileMarkerRanges={filter.roadMileMarkerRanges || {}}
                          onRoadMileMarkerRangesChange={(ranges) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, roadMileMarkerRanges: ranges} : f
                            ));
                          }}
                          selectedPointsOfInterest={filter.locations.pointsOfInterest || []}
                          onSelectedPointsOfInterestChange={(pointsOfInterest) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, locations: {...f.locations, pointsOfInterest}} : f
                            ));
                          }}
                          selections={filter.locationSelections || []}
                          onSelectionsChange={(selections) => {
                            // Ensure all selections have the required operator property
                            const validSelections = selections.map(selection => ({
                              ...selection,
                              operator: selection.operator || "AND" // Default to AND if not provided
                            }));
                            
                            // Use a type assertion to ensure TypeScript understands this is a valid Filter
                            setFilters(prevFilters => prevFilters.map(f => {
                              if (f.id === filter.id) {
                                // Create a properly typed filter with the validated selections
                                const updatedFilter: Filter = {
                                  ...f,
                                  locationSelections: validSelections
                                };
                                return updatedFilter;
                              }
                              return f;
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Alert */}
                {error && (
                  <div className="mb-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <AlertTitle className="font-semibold">
                        {error.includes('timeout') ? 'Server Timeout Error' : 'Error'}
                      </AlertTitle>
                      <AlertDescription className="mt-1">
                        {error}
                        {error.includes('timeout') && (
                          <div className="mt-2 text-sm">
                            <p className="font-medium">Suggestions:</p>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                              <li>Reduce the time range in your query</li>
                              <li>Select fewer filters or locations</li>
                              <li>Try a more specific query</li>
                            </ul>
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                <div className="flex justify-center pb-2">
                  <Button 
                  className="w-1/3 bg-gray-700" 
                  onClick={executeFilterQuery} 
                  disabled={isLoading || !activeFilterId}
                  variant="default"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {/* <FilterIcon className="mr-2 h-4 w-4" /> */}
                      Request Data
                    </>
                  )}
                </Button>
              </div>
              </div>
            )}
          </Card>
        ))}
      {/* </div> */}
      
      
      {/* Results Summary Card */}
      {contextQueryResults && (
        <motion.div 
          ref={resultsRef}
          initial={{ y: 0 }}
          animate={{
            y: showResultsHighlight ? [0, -10, 0, -10, 0] : 0,
            boxShadow: showResultsHighlight ? 
              ["0 0 0 0 rgba(59, 130, 246, 0)", "0 0 15px 5px rgba(59, 130, 246, 0.5)", "0 0 0 0 rgba(59, 130, 246, 0)", "0 0 15px 5px rgba(59, 130, 246, 0.5)", "0 0 0 0 rgba(59, 130, 246, 0)"] : 
              "0 0 0 0 rgba(59, 130, 246, 0)"
          }}
          transition={{ duration: 2.5 }}
          className={`w-full mt-4 ${showResultsHighlight ? 'ring-2 ring-blue-500 relative' : noResultsFound ? 'ring-2 ring-amber-500 relative' : 'relative'}`}
        >
          {showResultsHighlight && (
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-t-md text-sm font-medium animate-pulse">
              Results Found!
            </div>
          )}
          {noResultsFound && (
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white px-3 py-1 rounded-t-md text-sm font-medium animate-pulse">
              No Results Found
            </div>
          )}
          <Collapsible
            open={isResultsOpen}
            onOpenChange={setIsResultsOpen}
            className="w-full border rounded-md overflow-hidden"
          >
          <div className="flex items-center justify-between p-2 border-b">
            <div className="flex items-center">
              <h4 className="text-base font-medium">
                Search Results Summary <span className="text-sm font-normal truncate max-w-[90%] inline-block">
                  (Total: {resultsSummary?.total || 0}, Datasets: {Object.keys(resultsSummary?.byDataset || {}).length}, 
                  Time: {(() => {
                    const filter = filters.find(f => f.id === activeFilterId);
                    if (!filter) return "";
                    
                    const startDate = filter.timeframe?.start 
                      ? new Date(filter.timeframe.start).toLocaleDateString() 
                      : new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleDateString();
                    const endDate = filter.timeframe?.end 
                      ? new Date(filter.timeframe.end).toLocaleDateString() 
                      : new Date().toLocaleDateString();
                    
                    return `${startDate} - ${endDate}`;
                  })()}, 
                  Locations: {(() => {
                    const filter = filters.find(f => f.id === activeFilterId);
                    if (!filter) return "All";
                    
                    let locationText = 'All';
                    if (filter.roads && filter.roads.length > 0) {
                      locationText = filter.roads.length > 1 ? `${filter.roads.length} roads` : filter.roads[0];
                    } else if (filter.cities && filter.cities.length > 0) {
                      locationText = filter.cities.length > 1 ? `${filter.cities.length} cities` : filter.cities[0];
                    } else if (filter.districts && filter.districts.length > 0) {
                      locationText = filter.districts.length > 1 ? `${filter.districts.length} districts` : filter.districts[0];
                    }
                    
                    return locationText;
                  })()})
                </span>
              </h4>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                {isResultsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="px-2 pb-2">
            {/* Quick Insights */}
            {/* {resultsSummary.total > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-2 bg-gray-50 rounded-md">
                  <div className="text-xs text-gray-500">Total Results</div>
                  <div className="text-lg font-bold">{resultsSummary.total}</div>
                </div>
                <div className="p-2 bg-gray-50 rounded-md">
                  <div className="text-xs text-gray-500">Datasets</div>
                  <div className="text-lg font-bold">{Object.keys(resultsSummary.byDataset).length}</div>
                </div>
              </div>
            )} */}
            
            {/* Results Summary */}
            <div className="space-y-0">
              {/* Dataset Results */}
              <div>
                {Object.entries(resultsSummary.byDataset).map(([datasetName, count]) => {
                  // Get a display name for the dataset
                  const displayName = (() => {
                    switch(datasetName) {
                      case 'traffic_events': return 'Traffic Events';
                      case 'lane_blockage_info': return 'Lane Blockages';
                      case 'rest_area_info': return 'Rest Areas';
                      case 'dynamic_message_sign_info': return 'Dynamic Message Signs';
                      case 'traffic_parking_info': return 'Truck Parking';
                      case 'travel_time_system_info': return 'Travel Time Signs';
                      case 'variable_speed_limit_sign_info': return 'Variable Speed Limit Signs';
                      case 'social_events': return 'Social Events';
                      case 'weather_info': return 'Weather Information';
                      case 'traffic_speed_info': return 'Traffic Speed';
                      default: return datasetName;
                    }
                  })();
                  
                  return (
                    <div key={datasetName} className="text-sm mb-2">
                      {/* {count} results found from {displayName} */}
                    </div>
                  );
                })}
              </div>
              
              {/* Dynamic Analytics for Each Dataset */}
              {Object.entries(resultsSummary.byDataset).map(([datasetName, count]) => {
                if (count === 0 || !contextQueryResults || !contextQueryResults.results) return null;
                
                // Get the actual data for this dataset from contextQueryResults
                let datasetData: any[] = [];
                
                if (Array.isArray(contextQueryResults.results)) {
                  // Check each result object in the array for this dataset
                  contextQueryResults.results.forEach((resultObj: Record<string, any>) => {
                    if (resultObj[datasetName] && Array.isArray(resultObj[datasetName])) {
                      datasetData = [...datasetData, ...resultObj[datasetName]];
                    }
                  });
                } else if (typeof contextQueryResults.results === 'object' && 
                           contextQueryResults.results[datasetName] && 
                           Array.isArray(contextQueryResults.results[datasetName])) {
                  datasetData = contextQueryResults.results[datasetName];
                }
                
                // Get display name for the dataset
                const displayName = (() => {
                  switch(datasetName) {
                    case 'traffic_events': return 'Traffic Events';
                    case 'lane_blockage_info': return 'Lane Blockages';
                    case 'rest_area_info': return 'Rest Areas';
                    case 'dynamic_message_sign_info': return 'Dynamic Message Signs';
                    case 'traffic_parking_info': return 'Truck Parking';
                    case 'travel_time_system_info': return 'Travel Time Signs';
                    case 'variable_speed_limit_sign_info': return 'Variable Speed Limit Signs';
                    case 'social_events': return 'Social Events';
                    case 'weather_info': return 'Weather Information';
                    case 'traffic_speed_info': return 'Traffic Speed';
                    default: return datasetName;
                  }
                })();
                
                // Helper function to get dataset items
                const getDatasetItems = (dataset: string): any[] => {
                  let items: any[] = [];
                  if (Array.isArray(contextQueryResults.results)) {
                    // Format: results is an array - check all result objects
                    contextQueryResults.results.forEach((resultObj: Record<string, any>) => {
                      if (resultObj && typeof resultObj === 'object' && Array.isArray(resultObj[dataset])) {
                        items = [...items, ...resultObj[dataset]];
                      }
                    });
                  } else if (typeof contextQueryResults.results === 'object') {
                    // Format: results is an object
                    if (Array.isArray(contextQueryResults.results[dataset])) {
                      items = contextQueryResults.results[dataset];
                    }
                  }
                  return items;
                };
                
                // Get the items for this dataset
                const datasetItems = getDatasetItems(datasetName);
                if (datasetItems.length === 0) return null;
                
                // Analyze the first item to determine what fields are available
                const sampleItem = datasetItems[0] || {};
                const hasEventType = 'event_type' in sampleItem;
                const hasSegment = 'event_classification_segment' in sampleItem;
                const hasPriority = 'priority_level' in sampleItem;
                const hasLocation = 'location' in sampleItem || 'city' in sampleItem || 'district' in sampleItem || 'route' in sampleItem;
                
                // Find all available fields that might be interesting for analytics
                const availableFields = Object.keys(sampleItem).filter(key => 
                  typeof sampleItem[key] === 'string' || 
                  typeof sampleItem[key] === 'number'
                );
                
                return (
                  <div key={datasetName} className="space-y-1.5">
                    <h3 className="text-sm font-medium flex items-center gap-1">
                      <span>{displayName}</span>
                      <span className="text-xs bg-blue-100 px-1.5 py-0.5 rounded-full">{count}</span>
                    </h3>
                    
                    {/* Event Type Analytics - if event_type field exists */}
                    {hasEventType && (
                      <div className="space-y-1 ml-3">
                        <h4 className="text-xs font-medium text-black-700">Event Types</h4>
                        <div className="grid grid-cols-3 gap-1.5 ml-2">
                          {(() => {
                            // Calculate event type counts
                            const typeCounts: Record<string, number> = {};
                            
                            datasetItems.forEach((item: any) => {
                              const type = item.event_type || 'Unknown';
                              typeCounts[type] = (typeCounts[type] || 0) + 1;
                            });
                            
                            // This line is no longer needed as we're getting the current filter directly below
                            
                            return Object.entries(typeCounts).map(([type, count]) => {
                              // Get the current active filter
                              const currentFilter = filters.find(f => f.id === activeFilterId);
                              const isSelected = currentFilter?.attributeFilters?.[datasetName]?.['event_type']?.includes(type) || false;
                              
                              return (
                                <button
                                  key={type}
                                  onClick={() => {
                                    if (activeFilterId) {
                                      toggleEventTypeFilter(activeFilterId, datasetName, 'event_type', type);
                                    }
                                  }}
                                  className={`flex justify-between items-center p-1.5 rounded-md w-full text-left ${isSelected ? 'bg-blue-200 border border-blue-300' : 'bg-gray-50'}`}
                                >
                                  <span className="text-xs truncate max-w-[70%]">{type.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                                  <span className="text-xs font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">{count}</span>
                                </button>
                              );
                            });
                            
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Priority Analytics - if priority field exists */}
                    {/* {hasPriority && (
                      <div className="space-y-1 ml-3">
                        <h4 className="text-xs font-medium text-gray-700">Priority Levels</h4>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(() => {
                            // Calculate priority counts
                            const priorityCounts: Record<string, number> = {};
                            
                            datasetItems.forEach((item: any) => {
                              const priority_level = item.priority_level ? `Priority ${item.priority_level}` : 'Unknown';
                              priorityCounts[priority_level] = (priorityCounts[priority_level] || 0) + 1;
                            });
                            
                            return Object.entries(priorityCounts).map(([priority_level, count]) => {
                              // Get the current active filter
                              const currentFilter = filters.find(f => f.id === activeFilterId);
                              const isSelected = currentFilter?.attributeFilters?.[datasetName]?.['priority_level']?.includes(priority_level) || false;
                              
                              return (
                                <button
                                  key={priority_level}
                                  onClick={() => {
                                    if (activeFilterId) {
                                      toggleEventTypeFilter(activeFilterId, datasetName, 'priority_level', priority_level);
                                    }
                                  }}
                                  className={`flex justify-between items-center p-1.5 rounded-md w-full text-left ${isSelected ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}
                                >
                                  <span className="text-xs truncate max-w-[70%]">{priority_level}</span>
                                  <span className="text-xs font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">{count}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )} */}

                    {/* Segment Analytics - if segment field exists */}
                    {hasSegment && (
                      <div className="space-y-1 ml-3">
                        <h4 className="text-xs font-medium text-black-700">Segment</h4>
                        <div className="grid grid-cols-3 gap-1.5 ml-2">
                          {(() => {
                            // Calculate segment counts
                            const segmentCounts: Record<string, number> = {};
                            
                            datasetItems.forEach((item: any) => {
                              const segment = item.event_classification_segment ? `${item.event_classification_segment}` : 'Unknown';
                              segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
                            });
                            
                            return Object.entries(segmentCounts).map(([segment, count]) => {
                              // Get the current active filter
                              const currentFilter = filters.find(f => f.id === activeFilterId);
                              const isSelected = currentFilter?.attributeFilters?.[datasetName]?.['event_classification_segment']?.includes(segment) || false;
                              
                              return (
                                <button
                                  key={segment}
                                  onClick={() => {
                                    if (activeFilterId) {
                                      toggleEventTypeFilter(activeFilterId, datasetName, 'event_classification_segment', segment);
                                    }
                                  }}
                                  className={`flex justify-between items-center p-1.5 rounded-md w-full text-left ${isSelected ? 'bg-blue-200 border border-blue-300' : 'bg-gray-50'}`}
                                >
                                  <span className="text-xs truncate max-w-[70%]">{segment}</span>
                                  <span className="text-xs font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">{count}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Location Analytics - if location or city field exists */}
                    {hasLocation && (
                      <div className="space-y-1 ml-3 pb-2">
                        <h4 className="text-xs font-medium text-black-700">Locations</h4>
                        <div className="grid grid-cols-3 gap-1.5 ml-2">
                          {(() => {
                            // Calculate location counts
                            const locationCounts: Record<string, number> = {};
                            
                            datasetItems.forEach((item: any) => {
                              // For traffic_events, the district field is capitalized (e.g., "GREENFIELD")
                              // We need to normalize it for consistent filtering
                              const location = item.district || item.route || item.city || 'Unknown';
                              if (location && location !== 'undefined' && location !== 'null') {
                                locationCounts[location] = (locationCounts[location] || 0) + 1;
                              }
                            });
                            
                            // Get all locations
                            const topLocations = Object.entries(locationCounts)
                              .sort((a, b) => b[1] - a[1]);
                            
                            return topLocations.map(([location, count]) => {
                              // Get the current active filter
                              const currentFilter = filters.find(f => f.id === activeFilterId);
                              // Check if the location is selected, accounting for case differences
                              const isSelected = currentFilter?.attributeFilters?.[datasetName]?.['location']?.some(
                                selectedLoc => selectedLoc.toLowerCase() === location.toLowerCase()
                              ) || false;
                              
                              return (
                                <button
                                  key={location}
                                  onClick={() => {
                                    if (activeFilterId) {
                                      toggleEventTypeFilter(activeFilterId, datasetName, 'location', location);
                                    }
                                  }}
                                  className={`flex justify-between items-center p-1.5 rounded-md w-full text-left ${isSelected ? 'bg-blue-200 border border-blue-300' : 'bg-gray-50'}`}
                                >
                                  <span className="text-xs truncate max-w-[70%]">{location.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                                  <span className="text-xs font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">{count}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Dynamic Field Analytics - for other interesting fields */}
                    {availableFields.length > 0 && !hasEventType && !hasPriority && !hasSegment && !hasLocation && (
                      <div className="space-y-1 ml-3">
                        <h4 className="text-xs font-medium text-gray-700">Key Attributes</h4>
                        <div className="grid grid-cols-3 gap-1.5 ml-2">
                          {(() => {
                            // Pick an interesting field for analytics
                            const interestingField = availableFields[0];
                            const fieldCounts: Record<string, number> = {};
                            
                            datasetItems.forEach((item: any) => {
                              const value = item[interestingField]?.toString() || 'Unknown';
                              fieldCounts[value] = (fieldCounts[value] || 0) + 1;
                            });
                            
                            // Get top values
                            const topValues = Object.entries(fieldCounts)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 6);
                            
                            return topValues.map(([value, count]) => (
                              <div key={value} className="flex justify-between items-center p-1.5 bg-gray-50 rounded-md">
                                <span className="text-xs truncate max-w-[70%]">{value}</span>
                                <span className="text-xs font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">{count}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {resultsSummary.total === 0 && (
                <div className="flex items-center space-x-1.5 text-yellow-600 mt-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs">No results found. Try adjusting your filters.</span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
        </motion.div>
      )}
    </div>
  )
}

