"use client"

import { useState, useEffect } from "react"
import { MapPin, Calendar, Database, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Plus, Check, Trash2 } from "lucide-react"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { LocationSelector } from "./selectors/location-selector"
import { TimeframeSelector } from "./selectors/timeframe-selector"
import { DatasetSelector } from "./selectors/dataset-selector"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"

// Simple Spinner component
const Spinner = ({ className }: { className?: string }) => (
  <div className={`animate-spin ${className || ''}`}>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  </div>
)

interface LaneBlockage {
  insideShoulderAffected: boolean
  outsideShoulderAffected: boolean
  allLanesAffected: boolean
  exitRampAffected: boolean
  entranceRampAffected: boolean
  lanesAffected: number[]
}

interface CarEvent {
  id: number
  eventType: string
  route: string
  lat: number
  lon: number
  priorityLevel: number
  eventStatus: string
  dateStart: number
  dateEnd: number | null
  positiveLaneBlockageType: string
  negativeLaneBlockageType: string
  positiveLaneBlockage: LaneBlockage
  negativeLaneBlockage: LaneBlockage
  locationDetails: {
    city: string[]
    county: string[]
    district: string[]
  }
}

// Define the structure for a single filter
interface Filter {
  id: string
  name: string
  isOpen: boolean
  openSelector: string | null
  locations: {
    cities: string[]
    roads: string[]
    districts: string[]
  }
  timeframe: { start: string; end: string } | null
  datasets: {
    carEvents: string[]
    laneBlockages: {
      blockType: string[]
      allLanesAffected: string[]
      lanesAffected: {
        positive: number[]
        negative: number[]
      }
      additionalFilters: {
        negative_exit_ramp_affected: boolean[]
        negative_entrance_ramp_affected: boolean[]
        positive_exit_ramp_affected: boolean[]
        positive_entrance_ramp_affected: boolean[]
        negative_inside_shoulder_affected: boolean[]
        negative_outside_shoulder_affected: boolean[]
        positive_inside_shoulder_affected: boolean[]
        positive_outside_shoulder_affected: boolean[]
      }
    }
    priorities: string[]
    eventStatuses: string[]
    restAreaFilters: {
      capacity: string[]
      spacesAvailable: string[]
      siteAreaStatus: string[]
      amenities: string[]
    }
  }
}

interface SelectorPanelProps {
  onFilteredDataChange?: (events: CarEvent[]) => void
  onSelectedDatasetsChange?: (datasets: {
    carEvents: string[]
    laneBlockages: {
      blockType: string[]
      allLanesAffected: string[]
      lanesAffected: {
        positive: number[]
        negative: number[]
      }
      additionalFilters: {
        negative_exit_ramp_affected: boolean[]
        negative_entrance_ramp_affected: boolean[]
        positive_exit_ramp_affected: boolean[]
        positive_entrance_ramp_affected: boolean[]
        negative_inside_shoulder_affected: boolean[]
        negative_outside_shoulder_affected: boolean[]
        positive_inside_shoulder_affected: boolean[]
        positive_outside_shoulder_affected: boolean[]
      }
    }
  }) => void
}

export function SelectorPanel({ onFilteredDataChange, onSelectedDatasetsChange }: SelectorPanelProps) {
  // State for managing multiple filters
  const [filters, setFilters] = useState<Filter[]>([])
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)
  
  // State for car events data and loading
  const [carEventsData, setCarEventsData] = useState<CarEvent[]>([])
  const [filteredCarEvents, setFilteredCarEvents] = useState<CarEvent[]>([])
  const [filteredCount, setFilteredCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Helper function to create a new empty filter
  const createEmptyFilter = (): Filter => ({
    id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `Filter ${filters.length + 1}`,
    isOpen: true,
    openSelector: null,
    locations: {
      cities: [],
      roads: [],
      districts: []
    },
    timeframe: null,
    datasets: {
      carEvents: [],
      laneBlockages: {
        blockType: [],
        allLanesAffected: [],
        lanesAffected: {
          positive: [],
          negative: []
        },
        additionalFilters: {
          negative_exit_ramp_affected: [],
          negative_entrance_ramp_affected: [],
          positive_exit_ramp_affected: [],
          positive_entrance_ramp_affected: [],
          negative_inside_shoulder_affected: [],
          negative_outside_shoulder_affected: [],
          positive_inside_shoulder_affected: [],
          positive_outside_shoulder_affected: []
        }
      },
      priorities: [],
      eventStatuses: [],
      restAreaFilters: {
        capacity: [],
        spacesAvailable: [],
        siteAreaStatus: [],
        amenities: []
      }
    }
  })
  
  // Initialize with one empty filter
  useEffect(() => {
    if (filters.length === 0) {
      const newFilter = createEmptyFilter()
      setFilters([newFilter])
      setActiveFilterId(newFilter.id)
    }
  }, [])

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

  const getLocationOverview = (filter: Filter) => {
    const allLocations = [...filter.locations.roads, ...filter.locations.cities, ...filter.locations.districts]
    if (allLocations.length === 0) return "No locations selected"
    if (allLocations.length <= 3) return `Selected: ${allLocations.join(", ")}`
    return `Selected: ${allLocations.slice(0, 2).join(", ")} + ${allLocations.length - 2} more`
  }

  const getTimeframeOverview = (filter: Filter) => {
    if (!filter.timeframe) return "No timeframe selected"
    
    // Format dates for better readability
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

  const getDatasetOverview = (filter: Filter) => {
    const carEventsCount = filter.datasets.carEvents.length;
    const laneBlockagesCount = (
      filter.datasets.laneBlockages.blockType.length + 
      filter.datasets.laneBlockages.allLanesAffected.length + 
      filter.datasets.laneBlockages.lanesAffected.positive.length + 
      filter.datasets.laneBlockages.lanesAffected.negative.length +
      Object.values(filter.datasets.laneBlockages.additionalFilters).flat().length
    );
    const restAreaCount = Object.values(filter.datasets.restAreaFilters).flat().length;
    
    if (carEventsCount === 0 && laneBlockagesCount === 0 && restAreaCount === 0) return "No datasets selected";
    
    const datasets = [];
    if (carEventsCount > 0) {
      datasets.push(filter.datasets.carEvents.length <= 2 
        ? filter.datasets.carEvents.join(", ")
        : `${filter.datasets.carEvents.length} Car Events`);
    }
    if (laneBlockagesCount > 0) {
      datasets.push("Lane Blockages");
    }
    if (restAreaCount > 0) {
      datasets.push("Rest Area Filters");
    }
    
    if (datasets.length <= 2) return `Selected: ${datasets.join(", ")}`;
    return `Selected: ${datasets.slice(0, 2).join(", ")} + ${datasets.length - 2} more`;
  }
  
  // Load car events data
  useEffect(() => {
    const loadCarEventsData = async () => {
      try {
        // Using a relative path with public prefix to ensure proper loading
        const response = await fetch('./json/cars-event-feed.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch car events data: ${response.status}`);
        }
        const data = await response.json();
        setCarEventsData(data);
        console.log('Successfully loaded car events data:', data.length, 'events');
      } catch (err) {
        console.error('Error loading car events data:', err);
        setError('Failed to load car events data. Please try again.');
      }
    };
    
    loadCarEventsData();
  }, []);
  
  // Update the parent component with selected datasets from active filter
  useEffect(() => {
    if (onSelectedDatasetsChange && activeFilterId) {
      const activeFilter = filters.find(f => f.id === activeFilterId);
      if (activeFilter) {
        onSelectedDatasetsChange({
          carEvents: activeFilter.datasets.carEvents,
          laneBlockages: activeFilter.datasets.laneBlockages
        });
      }
    }
  }, [filters, activeFilterId, onSelectedDatasetsChange]);
  
  // Filter car events based on the active filter
  const filterCarEvents = () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Find the active filter
      const activeFilter = filters.find(f => f.id === activeFilterId);
      if (!activeFilter) {
        setError('No active filter selected.');
        setFilteredCount(0);
        return;
      }
      
      // Start with all car events - don't filter by event type initially
      let filtered = [...carEventsData];
      
      // Log the total number of events before filtering
      console.log(`Total events before filtering: ${filtered.length}`);
      console.log('Filtering with:', activeFilter.name);
      
      // Apply event type filter only if some are selected
      if (activeFilter.datasets.carEvents.length > 0) {
        filtered = filtered.filter(event => activeFilter.datasets.carEvents.includes(event.eventType));
        console.log(`After event type filter: ${filtered.length} events`);
      }
      
      // Filter by road
      if (activeFilter.locations.roads.length > 0) {
        filtered = filtered.filter(event => activeFilter.locations.roads.includes(event.route));
        console.log(`After road filter: ${filtered.length} events`);
      }
      
      // Filter by location (city)
      if (activeFilter.locations.cities.length > 0) {
        filtered = filtered.filter(event => 
          event.locationDetails.city && event.locationDetails.city.some(city => 
            activeFilter.locations.cities.includes(city)));
        console.log(`After location filter: ${filtered.length} events`);
      }
      
      // Filter by district
      if (activeFilter.locations.districts.length > 0) {
        filtered = filtered.filter(event => 
          event.locationDetails.district && event.locationDetails.district.some(district => 
            activeFilter.locations.districts.includes(district)));
        console.log(`After district filter: ${filtered.length} events`);
      }
      
      // Filter by priority
      if (activeFilter.datasets.priorities.length > 0) {
        filtered = filtered.filter(event => 
          activeFilter.datasets.priorities.includes(String(event.priorityLevel)));
        console.log(`After priority filter: ${filtered.length} events`);
      }
      
      // Filter by event status
      if (activeFilter.datasets.eventStatuses.length > 0) {
        filtered = filtered.filter(event => 
          activeFilter.datasets.eventStatuses.includes(event.eventStatus));
        console.log(`After status filter: ${filtered.length} events`);
      }
      
      // Filter by lane blockages
      const laneBlockages = activeFilter.datasets.laneBlockages;
      const hasLaneBlockageFilters = (
        laneBlockages.blockType.length > 0 ||
        laneBlockages.allLanesAffected.length > 0 ||
        laneBlockages.lanesAffected.positive.length > 0 ||
        laneBlockages.lanesAffected.negative.length > 0 ||
        Object.values(laneBlockages.additionalFilters).some(arr => arr.length > 0)
      );
      
      console.log('Lane blockage filters:', {
        blockType: laneBlockages.blockType,
        allLanesAffected: laneBlockages.allLanesAffected,
        lanesAffected: laneBlockages.lanesAffected,
        additionalFilters: laneBlockages.additionalFilters
      });
      
      if (hasLaneBlockageFilters) {
        filtered = filtered.filter(event => {
          // For debugging
          const hasPositiveBlockage = event.positiveLaneBlockage && 
            (event.positiveLaneBlockage.allLanesAffected || 
             (event.positiveLaneBlockage.lanesAffected && event.positiveLaneBlockage.lanesAffected.length > 0));
          
          const hasNegativeBlockage = event.negativeLaneBlockage && 
            (event.negativeLaneBlockage.allLanesAffected || 
             (event.negativeLaneBlockage.lanesAffected && event.negativeLaneBlockage.lanesAffected.length > 0));
          
          // Block Type filters
          if (laneBlockages.blockType.length > 0) {
            // If we're filtering by block type, check if either direction matches
            const matchesPositiveBlockType = laneBlockages.blockType.includes(event.positiveLaneBlockageType || 'N/A');
            const matchesNegativeBlockType = laneBlockages.blockType.includes(event.negativeLaneBlockageType || 'N/A');
            
            // If neither direction matches, filter out this event
            if (!matchesPositiveBlockType && !matchesNegativeBlockType) {
              return false;
            }
          }
          
          // All Lanes Affected filters
          if (laneBlockages.allLanesAffected.length > 0) {
            const positiveDirectionSelected = laneBlockages.allLanesAffected.includes("Positive Direction");
            const negativeDirectionSelected = laneBlockages.allLanesAffected.includes("Negative Direction");
            
            // Check if the event has the selected all lanes affected property
            const positiveAllLanesAffected = event.positiveLaneBlockage?.allLanesAffected === true;
            const negativeAllLanesAffected = event.negativeLaneBlockage?.allLanesAffected === true;
            
            // If both directions are selected but neither is affected, filter out
            if (positiveDirectionSelected && negativeDirectionSelected && 
                !positiveAllLanesAffected && !negativeAllLanesAffected) {
              return false;
            }
            
            // If only positive direction is selected but not affected, filter out
            if (positiveDirectionSelected && !negativeDirectionSelected && !positiveAllLanesAffected) {
              return false;
            }
            
            // If only negative direction is selected but not affected, filter out
            if (negativeDirectionSelected && !positiveDirectionSelected && !negativeAllLanesAffected) {
              return false;
            }
          }
          
          // Specific Lanes Affected filters
          if (laneBlockages.lanesAffected.positive.length > 0) {
            const positiveLanesAffected = event.positiveLaneBlockage?.lanesAffected || [];
            
            // Check if any of the selected positive lanes are affected
            const hasMatchingPositiveLane = laneBlockages.lanesAffected.positive.some(lane => 
              positiveLanesAffected.includes(Number(lane))
            );
            
            if (!hasMatchingPositiveLane) {
              return false;
            }
          }
          
          if (laneBlockages.lanesAffected.negative.length > 0) {
            const negativeLanesAffected = event.negativeLaneBlockage?.lanesAffected || [];
            
            // Check if any of the selected negative lanes are affected
            const hasMatchingNegativeLane = laneBlockages.lanesAffected.negative.some(lane => 
              negativeLanesAffected.includes(Number(lane))
            );
            
            if (!hasMatchingNegativeLane) {
              return false;
            }
          }
          
          // Additional filters
          const additionalFilters = laneBlockages.additionalFilters;
          
          // Exit Ramps
          if (additionalFilters.negative_exit_ramp_affected.length > 0) {
            // Check if the affected status is included in the selected filters
            const isExitRampAffected = event.negativeLaneBlockage?.exitRampAffected === true;
            const matchesFilter = additionalFilters.negative_exit_ramp_affected.includes(isExitRampAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          if (additionalFilters.positive_exit_ramp_affected.length > 0) {
            const isExitRampAffected = event.positiveLaneBlockage?.exitRampAffected === true;
            const matchesFilter = additionalFilters.positive_exit_ramp_affected.includes(isExitRampAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          // Entrance Ramps
          if (additionalFilters.negative_entrance_ramp_affected.length > 0) {
            const isEntranceRampAffected = event.negativeLaneBlockage?.entranceRampAffected === true;
            const matchesFilter = additionalFilters.negative_entrance_ramp_affected.includes(isEntranceRampAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          if (additionalFilters.positive_entrance_ramp_affected.length > 0) {
            const isEntranceRampAffected = event.positiveLaneBlockage?.entranceRampAffected === true;
            const matchesFilter = additionalFilters.positive_entrance_ramp_affected.includes(isEntranceRampAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          // Inside Shoulders
          if (additionalFilters.negative_inside_shoulder_affected.length > 0) {
            const isInsideShoulderAffected = event.negativeLaneBlockage?.insideShoulderAffected === true;
            const matchesFilter = additionalFilters.negative_inside_shoulder_affected.includes(isInsideShoulderAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          if (additionalFilters.positive_inside_shoulder_affected.length > 0) {
            const isInsideShoulderAffected = event.positiveLaneBlockage?.insideShoulderAffected === true;
            const matchesFilter = additionalFilters.positive_inside_shoulder_affected.includes(isInsideShoulderAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          // Outside Shoulders
          if (additionalFilters.negative_outside_shoulder_affected.length > 0) {
            const isOutsideShoulderAffected = event.negativeLaneBlockage?.outsideShoulderAffected === true;
            const matchesFilter = additionalFilters.negative_outside_shoulder_affected.includes(isOutsideShoulderAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          if (additionalFilters.positive_outside_shoulder_affected.length > 0) {
            const isOutsideShoulderAffected = event.positiveLaneBlockage?.outsideShoulderAffected === true;
            const matchesFilter = additionalFilters.positive_outside_shoulder_affected.includes(isOutsideShoulderAffected);
            if (!matchesFilter) {
              return false;
            }
          }
          
          return true;
        });
        
        console.log(`After lane blockage filters: ${filtered.length} events`);
      }
      
      // Filter by timeframe
      if (activeFilter.timeframe) {
        const startTime = new Date(activeFilter.timeframe.start).getTime();
        const endTime = new Date(activeFilter.timeframe.end).getTime();
        
        filtered = filtered.filter(event => {
          // Event starts within the selected timeframe
          const eventStartsInRange = event.dateStart >= startTime && event.dateStart <= endTime;
          
          // Event ends within the selected timeframe (if it has an end date)
          const eventEndsInRange = event.dateEnd 
            ? event.dateEnd >= startTime && event.dateEnd <= endTime
            : false;
          
          // Event spans the selected timeframe
          const eventSpansRange = event.dateStart <= startTime && 
            (event.dateEnd ? event.dateEnd >= endTime : true);
          
          return eventStartsInRange || eventEndsInRange || eventSpansRange;
        });
      }
      
      setFilteredCarEvents(filtered);
      // Update the filtered count
      setFilteredCount(filtered.length);
      
      // Pass filtered data to parent component if callback exists
      if (onFilteredDataChange) {
        onFilteredDataChange(filtered);
      }
    } catch (err) {
      console.error('Error filtering car events:', err);
      setError('Failed to filter car events. Please try again.');
      setFilteredCount(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Data Filters</h2>
        <Button 
          onClick={addNewFilter}
          variant="outline"
          className="flex items-center"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Filter
        </Button>
      </div>

      <div className="space-y-4">
        {filters.map((filter) => (
          <Card key={filter.id} className={`mb-4 ${activeFilterId === filter.id ? 'border-blue-500 shadow-md' : ''}`}>
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
                    
                    {activeFilterId === filter.id && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        Active
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`p-1 h-8 w-8 ${activeFilterId === filter.id ? 'text-blue-500' : ''}`}
                    onClick={() => setActiveFilterId(filter.id)}
                    title="Set as active filter"
                  >
                    <Check className="h-4 w-4" />
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
                  </CardHeader>
                  {filter.openSelector === 'timeframe' && (
                    <CardContent>
                      <TimeframeSelector
                        selectedTimeframe={filter.timeframe}
                        onSelectedTimeframeChange={(timeframe) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, timeframe} : f
                          ));
                        }}
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
                        <CardTitle className="text-base">Select Dataset</CardTitle>
                      </div>
                      {filter.openSelector === 'dataset' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </CardHeader>
                  {filter.openSelector === 'dataset' && (
                    <CardContent>
                      <DatasetSelector
                        selectedCarEvents={filter.datasets.carEvents}
                        onSelectedCarEventsChange={(carEvents) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, datasets: {...f.datasets, carEvents}} : f
                          ));
                        }}
                        selectedLaneBlockages={filter.datasets.laneBlockages}
                        onSelectedLaneBlockagesChange={(laneBlockages) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, datasets: {...f.datasets, laneBlockages}} : f
                          ));
                        }}
                        selectedRestAreaFilters={filter.datasets.restAreaFilters}
                        onSelectedRestAreaFiltersChange={(restAreaFilters) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, datasets: {...f.datasets, restAreaFilters}} : f
                          ));
                        }}
                        selectedPriorities={filter.datasets.priorities}
                        onSelectedPrioritiesChange={(priorities) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, datasets: {...f.datasets, priorities}} : f
                          ));
                        }}
                        selectedEventStatuses={filter.datasets.eventStatuses}
                        onSelectedEventStatusesChange={(eventStatuses) => {
                          setFilters(prevFilters => prevFilters.map(f => 
                            f.id === filter.id ? {...f, datasets: {...f.datasets, eventStatuses}} : f
                          ));
                        }}
                      />
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
      
      {filteredCount !== null && filteredCount === 0 && (
        <Alert className="mt-4 bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-700">No Data Available</AlertTitle>
          <AlertDescription className="text-amber-600">
            No data matches your current filter criteria. Try adjusting your filters to see results.
          </AlertDescription>
        </Alert>
      )}
      
      {filteredCount !== null && filteredCount > 0 && (
        <div className="mt-4 text-sm text-gray-600 flex items-center">
          <span className="inline-flex items-center justify-center rounded-full bg-green-100 px-2.5 py-0.5 text-green-700 mr-2">
            {filteredCount}
          </span>
          events match your filters
        </div>
      )}
      
      <div className="mt-auto pt-4 flex gap-2">
        <Button 
          className="flex-1" 
          onClick={filterCarEvents} 
          disabled={isLoading}
          variant="default"
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Apply Filters
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

