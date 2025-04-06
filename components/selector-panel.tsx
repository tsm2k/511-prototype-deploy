"use client"

import { useState, useEffect, useCallback } from "react"
import { MapPin, Calendar, Database, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Plus, Check, Trash2, Filter as FilterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationSelector } from "@/components/selectors/location-selector"
import { DynamicDatasetSelector } from "@/components/selectors/dynamic-dataset-selector"
import { DatasetAttributeFilters } from "@/components/selectors/dataset-attribute-filters"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { executeQuery } from "@/services/api"
import { buildQueryRequest } from "@/services/query-builder"
import { LocationFilter, TimeFilter } from "@/types/filters"

// Simple Spinner component
const Spinner = ({ className }: { className?: string }) => (
  <div className={`animate-spin ${className || ''}`}>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
)


// Define the structure for a single filter
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
  // Mile marker ranges for roads
  roadMileMarkerRanges?: Record<string, { min: number; max: number }>
  // New dataset structure
  selectedDatasets: string[] // Array of selected dataset types
  attributeFilters: Record<string, Record<string, string[]>> // Dynamic attribute filters for datasets
  // datasetFilters: {
  //   // Car Events filters
  //   carEvents: {
  //     enabled: boolean
  //     types: string[]
  //     showFilters: boolean
  //   }
  //   // Lane Blockages filters
  //   laneBlockages: {
  //     enabled: boolean
  //     showFilters: boolean
  //     blockType: string[]
  //     allLanesAffected: string[]
  //     lanesAffected: {
  //       positive: number[]
  //       negative: number[]
  //     }
  //     additionalFilters: {
  //       negative_exit_ramp_affected: boolean[]
  //       negative_entrance_ramp_affected: boolean[]
  //       positive_exit_ramp_affected: boolean[]
  //       positive_entrance_ramp_affected: boolean[]
  //       negative_inside_shoulder_affected: boolean[]
  //       negative_outside_shoulder_affected: boolean[]
  //       positive_inside_shoulder_affected: boolean[]
  //       positive_outside_shoulder_affected: boolean[]
  //     }
  //   }
  //   // Rest Area filters
  //   restArea: {
  //     enabled: boolean
  //     showFilters: boolean
  //     filters: {
  //       capacity: string[]
  //       spacesAvailable: string[]
  //       siteAreaStatus: string[]
  //       amenities: string[]
  //     }
  //   }
  //   // Dynamic Message Signs filters
  //   dynamicMessageSigns: {
  //     enabled: boolean
  //     showFilters: boolean
  //   }
  //   // Traffic Timing System filters
  //   trafficTimingSystem: {
  //     enabled: boolean
  //     showFilters: boolean
  //   }
  //   // Weather Events filters
  //   weatherEvents: {
  //     enabled: boolean
  //     showFilters: boolean
  //   }
  //   // Social Events filters
  //   socialEvents: {
  //     enabled: boolean
  //     showFilters: boolean
  //   }
  //   // Road Weather filters
  //   roadWeather: {
  //     enabled: boolean
  //     showFilters: boolean
  //   }
  //   // General filters that apply to all datasets
  //   priorities: string[]
  //   eventStatuses: string[]
  // }
  // Keep the old structure for backward compatibility during transition
  // datasets: {
  //   carEvents: string[]
  //   laneBlockages: {
  //     blockType: string[]
  //     allLanesAffected: string[]
  //     lanesAffected: {
  //       positive: number[]
  //       negative: number[]
  //     }
  //     additionalFilters: {
  //       negative_exit_ramp_affected: boolean[]
  //       negative_entrance_ramp_affected: boolean[]
  //       positive_exit_ramp_affected: boolean[]
  //       positive_entrance_ramp_affected: boolean[]
  //       negative_inside_shoulder_affected: boolean[]
  //       negative_outside_shoulder_affected: boolean[]
  //       positive_inside_shoulder_affected: boolean[]
  //       positive_outside_shoulder_affected: boolean[]
  //     }
  //   }
  //   priorities: string[]
  //   eventStatuses: string[]
  //   restAreaFilters: {
  //     capacity: string[]
  //     spacesAvailable: string[]
  //     siteAreaStatus: string[]
  //     amenities: string[]
  //   }
  // }
}

interface SelectorPanelProps {
  onFilteredDataChange?: () => void
  onSelectedDatasetsChange?: (datasets: {

    selectedDatasetIds: string[]
  }) => void
}

export function SelectorPanel({ onFilteredDataChange, onSelectedDatasetsChange }: SelectorPanelProps) {
  // State for managing multiple filters
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  
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
    const allLocations = [...filter.locations.roads, ...filter.locations.cities, ...filter.locations.districts]
    if (allLocations.length === 0) return "No locations selected"
    if (allLocations.length <= 3) return `Selected: ${allLocations.join(", ")}`
    return `Selected: ${allLocations.slice(0, 2).join(", ")} + ${allLocations.length - 2} more`
  }

  // Create a reference to store the getSummary function from TimeframeSelector
  const timeframeSummaryRef = { getSummary: null as null | (() => string) }
  
  const getTimeframeOverview = (filter: Filter) => {
    if (!filter.timeframe) return "No timeframe selected"
    
    // Check if we have access to the getSummary function from the TimeframeSelector component
    if (timeframeSummaryRef.getSummary) {
      return timeframeSummaryRef.getSummary()
    }
    
    // Fallback to the old format if getSummary is not available
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
    
    return `Selected: ${formatDate(filter.timeframe.start)} to ${formatDate(filter.timeframe.end)}`
  }
  
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
        route: activeFilter.locations.roads,
        region: activeFilter.locations.districts,
        county: [],
        city: activeFilter.locations.cities
      };
      
      // Build time filter from active filter
      const timeFilter: TimeFilter = {
        startDate: activeFilter.timeframe?.start,
        endDate: activeFilter.timeframe?.end
      };
      
      // Build query request
      const queryRequest = buildQueryRequest(
        activeFilter.selectedDatasets,
        activeFilter.attributeFilters,
        locationFilter,
        timeFilter
      );
      
      console.log('Executing query with request:', JSON.stringify(queryRequest, null, 2));
      
      // Execute the query
      const results = await executeQuery(queryRequest);
      
      console.log('Query results:', JSON.stringify(results, null, 2));
      
      // Store the results
      // setQueryResults(results);
      
      // Update filtered count
      let totalResults = 0;
      if (results && results.results) {
        Object.values(results.results).forEach((datasetResults: any) => {
          if (Array.isArray(datasetResults)) {
            totalResults += datasetResults.length;
          }
        });
      }
      
      // We've removed the map marker functionality as requested
      // The API response is still available in the queryResults state
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
      <h2 className="text-2xl font-bold mb-2">Data Filters</h2>

      <div className="flex items-center space-x-2">
        <Button
          onClick={addNewFilter}
          variant="outline"
          className="flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Filter
        </Button>

        <Button
          variant="outline"
          className="flex items-center"
        >
          Save Setup
        </Button>

        <Button
          variant="outline"
          className="flex items-center"
        >
          Load Setup
        </Button>
      </div>
    </div>

      <div className="space-y-4">
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
                    
                    <span className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {filter.active ? (
                        <span className="text-green-800 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`p-1 h-8 w-8 ${filter.active ? 'text-green-500' : 'text-gray-400'}`}
                    onClick={() => toggleFilterActive(filter.id)}
                    title={filter.active ? "Deactivate filter" : "Activate filter"}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`p-1 h-8 w-8 ${activeFilterId === filter.id ? 'text-blue-500' : ''}`}
                    onClick={() => setActiveFilterId(filter.id)}
                    title="Edit this filter"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="p-1 h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() => removeFilter(filter.id)}
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
                  {/* <div className="flex items-start">
                    <Database className="h-4 w-4 mr-1 mt-0.5" />
                    <span><strong>Datasets:</strong> {getDatasetOverview(filter)}</span>
                  </div> */}
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
                      {}
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
                    {/* {filter.openSelector !== 'dataset' && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {getDatasetOverview(filter)}
                      </div>
                    )} */}
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
                      />
                      
                      {/* Dataset Attribute Filters */}
                      {filter.selectedDatasets.length > 0 && (
                        <DatasetAttributeFilters
                          selectedDatasets={filter.selectedDatasets}
                          selectedFilters={filter.attributeFilters}
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
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="mt-auto pt-4 flex gap-2">
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
  )
}

