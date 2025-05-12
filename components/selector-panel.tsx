"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MapPin, Calendar, Database, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Plus, Check, Trash2, Filter as FilterIcon, Info, BarChart, AlertTriangle } from "lucide-react"
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
import { buildQueryRequest } from "@/services/query-builder"
import { LocationFilter, TimeFilter } from "@/types/filters"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion";

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
  id: string
  name: string
  isOpen: boolean
  active: boolean // Whether this filter is currently active
  openSelector: string | null
  locations: {
    cities: string[]
    roads: string[]
    districts: string[]
    pointsOfInterest?: string[]
  }
  timeframe: { start: string; end: string } | null
  // New timeframe selections structure
  timeframeSelections?: TimeframeSelection[]
  // New location selections structure
  locationSelections?: LocationSelection[]
  // Mile marker ranges for roads
  roadMileMarkerRanges?: Record<string, { min: number; max: number }>
  // New dataset structure
  selectedDatasets: string[] // Array of selected dataset types
  attributeFilters: Record<string, Record<string, string[]>> // Dynamic attribute filters for datasets
}

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
  const [resultsSummary, setResultsSummary] = useState<{total: number, byDataset: Record<string, number>}>({total: 0, byDataset: {}})
  
  // Save filter state to context when it changes
  useEffect(() => {
    setFilterState({
      filters,
      activeFilterId
    });
  }, [filters, activeFilterId, setFilterState])
  
  // Helper function to create a new empty filter
  const createEmptyFilter = useCallback((): Filter => ({
    id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `Filter ${filters.length + 1}`,
    isOpen: true,
    active: true, // New filters are active by default
    openSelector: null,
    locations: {
      cities: [],
      roads: [],
      districts: [],
      pointsOfInterest: []
    },
    timeframe: null,
    timeframeSelections: [],
    locationSelections: [], // Initialize location selections
    roadMileMarkerRanges: {},
    // Initialize new dataset structure
    selectedDatasets: [],
    attributeFilters: {},
  }), [filters.length])
  
  // Initialize with one empty filter
  useEffect(() => {
    if (filters.length === 0) {
      const newFilter = createEmptyFilter()
      setFilters([newFilter])
      setActiveFilterId(newFilter.id)
    }
  }, [filters.length, createEmptyFilter])

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
    const newFilter = createEmptyFilter()
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
        const newFilter = createEmptyFilter()
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
    if (allLocations.length === 0) return "No locations selected";
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
            const holidays = selection.holidays;
            if (holidays.length <= 3) {
              parts.push(`${holidays.slice(0, holidays.length - 1).join(", ")}${holidays.length > 1 ? " and " : ""}${holidays[holidays.length - 1]}`);
            } else {
              parts.push(`${holidays.length} selected holidays`);
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
  const [queryResults, setQueryResults] = useState<any>(null);
  
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
        if (dateRangeSelection && dateRangeSelection.range) {
          timeFilter.startDate = format(dateRangeSelection.range.start, 'yyyy-MM-dd');
          timeFilter.endDate = format(dateRangeSelection.range.end, 'yyyy-MM-dd');
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
      setQueryResults(results);
      
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
    } catch (err: any) {
      console.error('Error executing query:', err);
      setError(`Failed to execute query: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
<div className="h-full flex flex-col p-4 overflow-y-auto">
    <div className="mb-4">
      <h2 className="text-xl font-bold mb-2">Data Filters</h2>

      <div className="flex items-center space-x-2">
      <div className="relative group">
        <Button
          onClick={addNewFilter}
          variant="outline"
          className="flex items-center"
          disabled
        >
          + Add Filter
        </Button>
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-600 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
            Backend Fixes Required
          </span>
        </div>

        <div className="relative group">
  
          <Button
            variant="outline"
            className="flex items-center opacity-50 cursor-not-allowed"
            disabled
          >
            Save Filter
          </Button>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-600 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
            Not functional
          </span>
        </div>

        <div className="relative group">
          <Button
            variant="outline"
            className="flex items-center opacity-50 cursor-not-allowed"
            disabled
          >
            Load Filter
          </Button>
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-600 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
            Not functional
          </span>
        </div>

      </div>
    </div>

      <div className="space-y-4 border-2 border-blue-200 rounded-lg p-4 pb-2">
        {filters.map((filter) => (
          <Card key={filter.id} className={`mb-4 ${filter.active ? 'border-green-500' : 'border-gray-200'} ${activeFilterId === filter.id ? 'shadow-md' : ''}`}>
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-8 w-8"
                    onClick={() => toggleFilterExpanded(filter.id)}
                  >
                    {filter.isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                  
                  <div className="flex items-center">
                    {activeFilterId === filter.id ? (
                      <input
                        className="h-8 px-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={filter.name}
                        onChange={(e) => renameFilter(filter.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <CardTitle 
                        className="text-lg cursor-pointer" 
                        onClick={() => setActiveFilterId(filter.id)}
                      >
                        {filter.name}
                      </CardTitle>
                    )}
                    
                    <div className="ml-2 inline-flex items-center gap-2">
                      <Switch
                        checked={filter.active}
                        onCheckedChange={() => toggleFilterActive(filter.id)}
                        className={`${filter.active ? 'bg-green-500' : 'bg-gray-300'} h-5 w-9`}
                      />
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                        {filter.active ? (
                          <span className="text-green-800 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                        ) : (
                          <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  
                  {/* <Button 
                    variant="ghost" 
                    size="sm"
                    className={`p-1 h-8 w-8 ${activeFilterId === filter.id ? 'text-blue-500' : ''}`}
                    onClick={() => setActiveFilterId(filter.id)}
                    title="Edit this filter"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </Button> */}
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="p-1 h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() => confirmDeleteFilter(filter.id)}
                    title="Remove filter"
                    disabled={filters.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {!filter.isOpen && (
                <div className="mt-2 text-sm text-muted-foreground grid grid-cols-1 gap-1">
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-1 mt-0.5" />
                    <span><strong>Locations:</strong> {getLocationOverview(filter)}</span>
                  </div>
                  <div className="flex items-start">
                    <Calendar className="h-4 w-4 mr-1 mt-0.5" />
                    <span><strong>Timeframe:</strong> {getTimeframeOverview(filter)}</span>
                  </div>
                  <div className="flex items-start">
                    <Database className="h-4 w-4 mr-1 mt-0.5" />
                    <span><strong>Datasets:</strong> {getDatasetOverview(filter)}</span>
                  </div>
                </div>
              )}
            </CardHeader>
            
            {filter.isOpen && (
              <div className="px-4 pb-4">
                {/* Location Selector */}
                <Card className="mb-4 border shadow-sm">
                  <CardHeader className="p-3 cursor-pointer" onClick={() => toggleSelector(filter.id, 'location')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        <CardTitle className="text-base">Select Location</CardTitle>
                      </div>
                      {filter.openSelector === 'location' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                    {filter.openSelector !== 'location' && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {getLocationOverview(filter)}
                      </div>
                    )}
                  </CardHeader>
                  {filter.openSelector === 'location' && (
                    <CardContent>
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
                    </CardContent>
                  )}
                </Card>

                {/* Timeframe Selector */}
                <Card className="mb-4 border shadow-sm">
                  <CardHeader className="p-3 cursor-pointer" onClick={() => toggleSelector(filter.id, 'timeframe')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        <CardTitle className="text-base">Select Timeframe</CardTitle>
                      </div>
                      {filter.openSelector === 'timeframe' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                    {filter.openSelector !== 'timeframe' && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {getTimeframeOverview(filter)}
                      </div>
                    )}
                  </CardHeader>
                  {filter.openSelector === 'timeframe' && (
                    <CardContent>
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
                    </CardContent>
                  )}
                </Card>

                {/* Dataset Selector */}
                <Card className="mb-4 border shadow-sm">
                  <CardHeader className="p-3 cursor-pointer" onClick={() => toggleSelector(filter.id, 'dataset')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        <CardTitle className="text-base">Select Datasets</CardTitle>
                      </div>
                      {filter.openSelector === 'dataset' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                    {filter.openSelector !== 'dataset' && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {getDatasetOverview(filter)}
                      </div>
                    )}
                  </CardHeader>
                  {filter.openSelector === 'dataset' && (
                    <CardContent className="pt-2">
                      <DynamicDatasetSelector
                        selectedDatasets={filter.selectedDatasets}
                        onSelectedDatasetsChange={(datasets) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, selectedDatasets: datasets} : f
                          ));
                        }}
                        getSummaryRef={datasetSummaryRef}
                      />
                      
                      {/* Dataset Attribute Filters */}
                      {filter.selectedDatasets.length > 0 && (
                        <DatasetAttributeFilters
                          selectedDatasets={filter.selectedDatasets}
                          selectedFilters={filter.attributeFilters}
                          timeframeSelections={filter.timeframeSelections || []}
                          onFilterChange={(datasetId, attributeName, values) => {
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
                          onSelectedDatasetsChange={(datasets) => {
                            setFilters(prevFilters => prevFilters.map(f => 
                              f.id === filter.id ? {...f, selectedDatasets: datasets} : f
                            ));
                          }}
                        />
                      )}
                    </CardContent>
                  )}
                </Card>

              </div>
            )}
          </Card>
        ))}
        
        {/* Apply Filters Button - Moved inside the filters container */}
        <div className="flex gap-2 mt-4">
          <Button 
            className="flex-1" 
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
                <FilterIcon className="mr-2 h-4 w-4" />
                Apply Filters
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Delete Filter Confirmation Dialog */}
      <AlertDialog open={filterToDelete !== null} onOpenChange={(open) => !open && setFilterToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this filter?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the filter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => filterToDelete && removeFilter(filterToDelete)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Apply Filters button moved up inside the filters container */}
      
      {/* Results Summary Card */}
      {queryResults && (
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
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center space-x-2">
              <BarChart className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium">
                {resultsSummary.total} Results Found
              </h4>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                {isResultsOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="px-4 pb-4">
            {/* Note about results vs markers */}
            {/* <div className="mb-3 p-2 bg-blue-50 rounded-md text-xs text-blue-700 flex items-start space-x-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Not all results may appear as markers on the map if they lack valid coordinates.</span>
            </div> */}
            
            {/* Results Summary */}
            <div className="space-y-4">
              {/* Dataset Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Dataset Breakdown</h4>
                <div className="space-y-2 pl-1">
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
                        default: return datasetName;
                      }
                    })();
                    
                    // Calculate percentage of total
                    const percentage = Math.round((count / resultsSummary.total) * 100);
                    
                    return (
                      <div key={datasetName} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{displayName}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">{count}</span>
                            <span className="text-xs text-gray-500">({percentage}%)</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Dynamic Analytics for Each Dataset */}
              {Object.entries(resultsSummary.byDataset).map(([datasetName, count]) => {
                if (count === 0 || !queryResults || !queryResults.results) return null;
                
                // Get the actual data for this dataset from queryResults
                let datasetData: any[] = [];
                
                if (Array.isArray(queryResults.results)) {
                  // Check each result object in the array for this dataset
                  queryResults.results.forEach((resultObj: Record<string, any>) => {
                    if (resultObj[datasetName] && Array.isArray(resultObj[datasetName])) {
                      datasetData = [...datasetData, ...resultObj[datasetName]];
                    }
                  });
                } else if (typeof queryResults.results === 'object' && 
                           queryResults.results[datasetName] && 
                           Array.isArray(queryResults.results[datasetName])) {
                  datasetData = queryResults.results[datasetName];
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
                    default: return datasetName;
                  }
                })();
                
                // Helper function to get dataset items
                const getDatasetItems = (dataset: string): any[] => {
                  let items: any[] = [];
                  if (Array.isArray(queryResults.results)) {
                    // Format: results is an array
                    const resultsObj = queryResults.results[0];
                    if (resultsObj && typeof resultsObj === 'object' && Array.isArray(resultsObj[dataset])) {
                      items = resultsObj[dataset];
                    }
                  } else if (typeof queryResults.results === 'object' && Array.isArray(queryResults.results[dataset])) {
                    // Format: results is an object
                    items = queryResults.results[dataset];
                  }
                  return items;
                };
                
                // Get the items for this dataset
                const datasetItems = getDatasetItems(datasetName);
                if (datasetItems.length === 0) return null;
                
                // Analyze the first item to determine what fields are available
                const sampleItem = datasetItems[0] || {};
                const hasEventType = 'event_type' in sampleItem;
                const hasPriority = 'priority' in sampleItem;
                const hasLocation = 'location' in sampleItem || 'city' in sampleItem;
                
                // Find all available fields that might be interesting for analytics
                const availableFields = Object.keys(sampleItem).filter(key => 
                  typeof sampleItem[key] === 'string' || 
                  typeof sampleItem[key] === 'number'
                );
                
                return (
                  <div key={datasetName} className="space-y-4 border-t pt-3 mt-3">
                    <h3 className="text-sm font-medium">{displayName} Analytics</h3>
                    
                    {/* Event Type Analytics - if event_type field exists */}
                    {hasEventType && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-gray-500">Event Types</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            // Calculate event type counts
                            const typeCounts: Record<string, number> = {};
                            
                            datasetItems.forEach(item => {
                              const type = item.event_type || 'Unknown';
                              typeCounts[type] = (typeCounts[type] || 0) + 1;
                            });
                            
                            return Object.entries(typeCounts).map(([type, count]) => (
                              <div key={type} className="flex justify-between items-center p-2 bg-blue-50 rounded-md">
                                <span className="text-xs">{type}</span>
                                <span className="text-xs font-semibold bg-blue-100 px-2 py-0.5 rounded-full">{count}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Priority Analytics - if priority field exists */}
                    {hasPriority && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-gray-500">Priority Levels</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            // Calculate priority counts
                            const priorityCounts: Record<string, number> = {};
                            
                            datasetItems.forEach(item => {
                              const priority = item.priority ? `Priority ${item.priority}` : 'Unknown';
                              priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
                            });
                            
                            return Object.entries(priorityCounts).map(([priority, count]) => (
                              <div key={priority} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                                <span className="text-xs">{priority}</span>
                                <span className="text-xs font-semibold bg-blue-100 px-2 py-0.5 rounded-full">{count}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Location Analytics - if location or city field exists */}
                    {hasLocation && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-gray-500">Top Locations</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            // Calculate location counts
                            const locationCounts: Record<string, number> = {};
                            
                            datasetItems.forEach(item => {
                              const location = item.location || item.city || 'Unknown';
                              locationCounts[location] = (locationCounts[location] || 0) + 1;
                            });
                            
                            // Get top 3 locations
                            const topLocations = Object.entries(locationCounts)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 3);
                            
                            return topLocations.map(([location, count]) => (
                              <div key={location} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                                <span className="text-xs">{location}</span>
                                <span className="text-xs font-semibold bg-blue-100 px-2 py-0.5 rounded-full">{count}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {/* Dynamic Field Analytics - for other interesting fields */}
                    {availableFields.length > 0 && !hasEventType && !hasPriority && !hasLocation && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-gray-500">Key Attributes</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            // Pick an interesting field for analytics
                            const interestingField = availableFields[0];
                            const fieldCounts: Record<string, number> = {};
                            
                            datasetItems.forEach(item => {
                              const value = item[interestingField]?.toString() || 'Unknown';
                              fieldCounts[value] = (fieldCounts[value] || 0) + 1;
                            });
                            
                            // Get top values
                            const topValues = Object.entries(fieldCounts)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 6);
                            
                            return topValues.map(([value, count]) => (
                              <div key={value} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                                <span className="text-xs">{value}</span>
                                <span className="text-xs font-semibold bg-blue-100 px-2 py-0.5 rounded-full">{count}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Data Insights */}
              {resultsSummary.total > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="text-xs font-semibold uppercase text-gray-500">Quick Insights</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-50 rounded-md">
                      <div className="text-xs text-gray-500">Total Results</div>
                      <div className="text-lg font-bold">{resultsSummary.total}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-md">
                      <div className="text-xs text-gray-500">Datasets</div>
                      <div className="text-lg font-bold">{Object.keys(resultsSummary.byDataset).length}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {resultsSummary.total === 0 && (
                <div className="flex items-center space-x-2 text-yellow-600 mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">No results found. Try adjusting your filters.</span>
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

