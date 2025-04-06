"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pencil, Circle, AlertCircle, X } from "lucide-react"

// Import from centralized API service
import { fetchLocationData, LocationData } from "@/services/api"

// Points of Interest in Indiana (not from API)
const pointsOfInterest = [
  "Lucas Oil Stadium",
  "Indianapolis Motor Speedway",
  "Children's Museum of Indianapolis",
  "Indiana Dunes National Park",
  "Brown County State Park",
  "Conner Prairie",
  "Indiana University Bloomington",
  "Purdue University",
  "Notre Dame University",
  "White River State Park",
  "Eagle Creek Park",
  "Fort Wayne Children's Zoo",
  "Eiteljorg Museum",
  "Indiana State Museum",
  "Soldiers and Sailors Monument",
  "Turkey Run State Park",
  "McCormick's Creek State Park",
  "Marengo Cave",
  "Holiday World & Splashin' Safari",
  "French Lick Resort",
  "Tippecanoe Battlefield",
  "Hoosier National Forest",
  "Prophetstown State Park",
  "Falls of the Ohio State Park",
  "Mesker Park Zoo"
]

// Define the interface for mile marker ranges
interface MileMarkerRange {
  min: number
  max: number
}

// Define the interface for road selection with mile marker range
interface RoadSelection {
  road: string
  mileMarkerRange: MileMarkerRange
}

// Define the types of location selections
type LocationSelectionType = "road" | "city" | "district"

// Define the interface for location selections
interface LocationSelection {
  type: LocationSelectionType
  selection: string | string[]
  mileMarkerRange?: MileMarkerRange // Only for road selections
  operator?: "AND" | "OR" // Operator to use with the next selection
}

export interface LocationSelectorProps {
  selectedRoads: string[]
  onSelectedRoadsChange?: (roads: string[]) => void
  setSelectedRoads?: (roads: string[]) => void
  selectedLocations: string[]
  onSelectedLocationsChange?: (locations: string[]) => void
  setSelectedLocations?: (locations: string[]) => void
  selectedDistricts: string[]
  onSelectedDistrictsChange?: (districts: string[]) => void
  setSelectedDistricts?: (districts: string[]) => void
  // New props for points of interest
  selectedPointsOfInterest?: string[]
  onSelectedPointsOfInterestChange?: (pois: string[]) => void
  setSelectedPointsOfInterest?: (pois: string[]) => void
  // New props for mile marker ranges
  roadMileMarkerRanges?: Record<string, MileMarkerRange>
  onRoadMileMarkerRangesChange?: (ranges: Record<string, MileMarkerRange>) => void
  setRoadMileMarkerRanges?: (ranges: Record<string, MileMarkerRange>) => void
  // New props for selections
  selections?: LocationSelection[]
  onSelectionsChange?: (selections: LocationSelection[]) => void
}

export function LocationSelector({
  selectedRoads,
  onSelectedRoadsChange,
  setSelectedRoads,
  selectedLocations,
  onSelectedLocationsChange,
  setSelectedLocations,
  selectedDistricts,
  onSelectedDistrictsChange,
  setSelectedDistricts,
  selectedPointsOfInterest = [],
  onSelectedPointsOfInterestChange,
  setSelectedPointsOfInterest,
  roadMileMarkerRanges = {},
  onRoadMileMarkerRangesChange,
  setRoadMileMarkerRanges,
  selections = [],
  onSelectionsChange,
}: LocationSelectorProps) {
  const [poiRadius, setPoiRadius] = useState(10)
  // Remove the global mileMarkerRange state as we'll use per-road ranges
  const [drawMode, setDrawMode] = useState<"polygon" | "circle" | null>(null)
  const [searchRoad, setSearchRoad] = useState("")
  const [searchLocation, setSearchLocation] = useState("")
  const [searchDistrict, setSearchDistrict] = useState("")
  const [searchPOI, setSearchPOI] = useState("")
  
  // State for API data
  const [locationData, setLocationData] = useState<LocationData>({
    city: [],
    district: [],
    route: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch location data from API
  useEffect(() => {
    const getLocationData = async () => {
      setLoading(true)
      try {
        // Use the centralized API service to fetch location data
        const data = await fetchLocationData('event_location_info')
        setLocationData(data)
        setError(null)
      } catch (err) {
        console.error('Error fetching location data:', err)
        setError('Failed to fetch location data. Using fallback data.')
      } finally {
        setLoading(false)
      }
    }
    
    getLocationData()
  }, [])
  
  // Filter functions using the dynamic data
  const filteredRoads = locationData.route.filter(road => 
    road.toLowerCase().includes(searchRoad.toLowerCase())
  )

  const filteredLocations = locationData.city.filter(location => 
    location.toLowerCase().includes(searchLocation.toLowerCase())
  )

  const filteredDistricts = locationData.district.filter(district => 
    district.toLowerCase().includes(searchDistrict.toLowerCase())
  )

  const filteredPointsOfInterest = pointsOfInterest.filter(poi => 
    poi.toLowerCase().includes(searchPOI.toLowerCase())
  )

  // Toggle functions updated to use dynamic data
  const toggleAllRoads = () => {
    const updatedRoads = selectedRoads.length === locationData.route.length ? [] : [...locationData.route];
    
    // Always update both state and call callback
    setSelectedRoads?.(updatedRoads);
    onSelectedRoadsChange?.(updatedRoads);
  }

  const toggleAllLocations = () => {
    const updatedLocations = selectedLocations.length === locationData.city.length ? [] : [...locationData.city];
    
    // Always update both state and call callback
    setSelectedLocations?.(updatedLocations);
    onSelectedLocationsChange?.(updatedLocations);
  }

  const toggleAllDistricts = () => {
    const updatedDistricts = selectedDistricts.length === locationData.district.length ? [] : [...locationData.district];
    
    // Always update both state and call callback
    setSelectedDistricts?.(updatedDistricts);
    onSelectedDistrictsChange?.(updatedDistricts);
  }

  const toggleAllPointsOfInterest = () => {
    const updatedPOIs = selectedPointsOfInterest.length === pointsOfInterest.length ? [] : [...pointsOfInterest];
    
    // Always update both state and call callback
    setSelectedPointsOfInterest?.(updatedPOIs);
    onSelectedPointsOfInterestChange?.(updatedPOIs);
  }



  // Function to remove a selection
  const removeSelection = (index: number) => {
    const updatedSelections = [...selections];
    updatedSelections.splice(index, 1);
    onSelectionsChange?.(updatedSelections);
  }
  
  // Function to toggle the operator between selections
  const toggleOperator = (index: number) => {
    if (index > 0) {
      const updatedSelections = [...selections];
      const prevSelection = updatedSelections[index - 1];
      
      // Toggle between AND and OR
      prevSelection.operator = prevSelection.operator === "AND" ? "OR" : "AND";
      
      onSelectionsChange?.(updatedSelections);
    }
  }

  // Function to get a summary of the current selections
  const getSummary = useCallback(() => {
    if (selections.length === 0) {
      return "No location selected";
    }
    return selections.map((selection) => {
      switch (selection.type) {
        case "road":
          if (Array.isArray(selection.selection)) {
            return `Roads: ${selection.selection.join(", ")}`;
          } else {
            const road = selection.selection;
            const range = selection.mileMarkerRange;
            return range ? `${road} (MM ${range.min}-${range.max})` : road;
          }
        case "city":
          if (Array.isArray(selection.selection)) {
            return `Cities: ${selection.selection.join(", ")}`;
          } else {
            return `City: ${selection.selection}`;
          }
        case "district":
          if (Array.isArray(selection.selection)) {
            return `Districts: ${selection.selection.join(", ")}`;
          } else {
            return `District: ${selection.selection}`;
          }
        default:
          return "";
      }
    }).join(", ");
  }, [selections]);

  // Function to add road selections
  const addRoadSelections = () => {
    if (selectedRoads.length > 0) {
      const newSelection: LocationSelection = {
        type: "road",
        selection: [...selectedRoads],
        operator: "AND" // Default operator
      };
      
      // Add mile marker ranges if they exist for any of the selected roads
      const hasRanges = selectedRoads.some(road => roadMileMarkerRanges[road]);
      if (hasRanges && selectedRoads.length === 1) {
        const road = selectedRoads[0];
        if (roadMileMarkerRanges[road]) {
          newSelection.mileMarkerRange = roadMileMarkerRanges[road];
        }
      }
      
      onSelectionsChange?.([...selections, newSelection]);
      
      // Clear the selected roads after adding
      setSelectedRoads?.([]);
      onSelectedRoadsChange?.([]);
    }
  }

  // Function to add city selections
  const addCitySelections = () => {
    if (selectedLocations.length > 0) {
      const newSelection: LocationSelection = {
        type: "city",
        selection: [...selectedLocations],
        operator: "AND" // Default operator
      };
      
      onSelectionsChange?.([...selections, newSelection]);
      
      // Clear the selected cities after adding
      setSelectedLocations?.([]);
      onSelectedLocationsChange?.([]);
    }
  }

  // Function to add district selections
  const addDistrictSelections = () => {
    if (selectedDistricts.length > 0) {
      const newSelection: LocationSelection = {
        type: "district",
        selection: [...selectedDistricts],
        operator: "AND" // Default operator
      };
      
      onSelectionsChange?.([...selections, newSelection]);
      
      // Clear the selected districts after adding
      setSelectedDistricts?.([]);
      onSelectedDistrictsChange?.([]);
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Selection Preview */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Current Selections</h3>
        <div className="min-h-[40px] p-2 border rounded-md bg-slate-50">
          {selections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No location selections added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selections.map((selection, index) => {
                let content = "";
                
                switch (selection.type) {
                  case "road":
                    if (Array.isArray(selection.selection)) {
                      content = `Roads: ${selection.selection.join(", ")}`;
                    } else {
                      const road = selection.selection;
                      const range = selection.mileMarkerRange;
                      content = range ? `${road} (MM ${range.min}-${range.max})` : road;
                    }
                    break;
                  case "city":
                    if (Array.isArray(selection.selection)) {
                      content = `Cities: ${selection.selection.join(", ")}`;
                    } else {
                      content = `City: ${selection.selection}`;
                    }
                    break;
                  case "district":
                    if (Array.isArray(selection.selection)) {
                      content = `Districts: ${selection.selection.join(", ")}`;
                    } else {
                      content = `District: ${selection.selection}`;
                    }
                    break;
                }
                
                return (
                  <div key={index} className="flex items-center gap-1">
                    {index > 0 && (
                      <button 
                        onClick={() => toggleOperator(index)}
                        className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer"
                      >
                        {selections[index - 1]?.operator || "AND"}
                      </button>
                    )}
                    <Badge 
                      variant="outline" 
                      className="px-2 py-1 flex items-center gap-1 bg-white"
                    >
                      <span>{content}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => removeSelection(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="road" className="w-full">
      <TabsList className="flex flex-wrap gap-2 mb-4 bg-transparent p-0">
        <TabsTrigger value="road" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Road</TabsTrigger>
        <TabsTrigger value="city" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">City</TabsTrigger>
        <TabsTrigger value="districts" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Districts</TabsTrigger>
        <TabsTrigger value="points-of-interest" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Points of Interest</TabsTrigger>
        <TabsTrigger value="draw" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Draw</TabsTrigger>
      </TabsList>

      <TabsContent value="road" className="space-y-4">
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <p className="text-amber-800 text-sm">{error}</p>
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search roads..."
              value={searchRoad}
              onChange={(e) => setSearchRoad(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllRoads} size="sm" disabled={loading}>
              {selectedRoads.length === locationData.route.length ? "Deselect All" : "Select All"}
            </Button>
            <Button 
              onClick={addRoadSelections} 
              disabled={selectedRoads.length === 0}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Add Selection
            </Button>
          </div>

          <div className="max-h-[400px] overflow-y-auto border rounded-md p-2">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {filteredRoads.map((road) => {
                // Get the mile marker range for this road or use default
                const range = roadMileMarkerRanges[road] || { min: 0, max: 500 };
                
                return (
                  <div key={road} className="border-b border-gray-100 last:border-b-0 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`road-${road}`}
                          checked={selectedRoads.includes(road)}
                          onCheckedChange={(checked) => {
                            const updatedRoads = checked 
                              ? [...selectedRoads, road]
                              : selectedRoads.filter((r) => r !== road);
                            
                            // Always update both state and call callback
                            setSelectedRoads?.(updatedRoads);
                            onSelectedRoadsChange?.(updatedRoads);
                            
                            // If adding a road, initialize its mile marker range if not already set
                            if (checked && !roadMileMarkerRanges[road] && setRoadMileMarkerRanges) {
                              const updatedRanges = { ...roadMileMarkerRanges, [road]: { min: 0, max: 500 } };
                              setRoadMileMarkerRanges(updatedRanges);
                              onRoadMileMarkerRangesChange?.(updatedRanges);
                            }
                          }}
                        />
                        <Label htmlFor={`road-${road}`} className="font-medium text-sm">{road}</Label>
                      </div>
                      
                      {selectedRoads.includes(road) && (
                        <div className="flex items-center">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => {
                              // Open the mile marker range selector for this road
                              const rangeSelector = document.getElementById(`range-selector-${road}`);
                              if (rangeSelector) {
                                rangeSelector.classList.toggle('hidden');
                              }
                            }}
                          >
                            MM {range.min}-{range.max}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Mile Marker Range Selector - Initially Hidden */}
                    {selectedRoads.includes(road) && (
                      <div id={`range-selector-${road}`} className="mt-2 px-2 pt-2 pb-3 bg-gray-50 rounded-md hidden">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-medium">Mile Marker Range</Label>
                          <div className="bg-white text-gray-800 text-xs font-medium px-2 py-1 rounded-md border border-gray-200">
                            {range.min} - {range.max}
                          </div>
                        </div>
                        
                        {/* Range Slider */}
                        <div id={`slider-container-${road}`} className="relative pt-2 pb-2 mb-3">
                          {/* Track */}
                          <div className="h-2 w-full bg-gray-200 rounded-full relative">
                            {/* Colored range between thumbs */}
                            <div 
                              className="absolute h-full bg-blue-500 rounded-full" 
                              style={{
                                left: `${(range.min / 500) * 100}%`,
                                width: `${((range.max - range.min) / 500) * 100}%`
                              }}
                            />
                          </div>
                          
                          {/* Left thumb */}
                          <div 
                            className="absolute top-0 -mt-1 -ml-2.5 h-5 w-5 rounded-full border-2 border-blue-500 bg-white cursor-pointer shadow-md hover:scale-110 transition-transform"
                            style={{ left: `${(range.min / 500) * 100}%` }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const sliderContainer = document.getElementById(`slider-container-${road}`);
                              if (!sliderContainer) return;
                              
                              const sliderRect = sliderContainer.getBoundingClientRect();
                              
                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const newPosition = Math.max(0, Math.min(500, ((moveEvent.clientX - sliderRect.left) / sliderRect.width) * 500));
                                if (newPosition < range.max) {
                                  const updatedRanges = { 
                                    ...roadMileMarkerRanges, 
                                    [road]: { min: Math.round(newPosition), max: range.max } 
                                  };
                                  setRoadMileMarkerRanges?.(updatedRanges);
                                  onRoadMileMarkerRangesChange?.(updatedRanges);
                                }
                              };
                              
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          />
                          
                          {/* Right thumb */}
                          <div 
                            className="absolute top-0 -mt-1 -ml-2.5 h-5 w-5 rounded-full border-2 border-blue-500 bg-white cursor-pointer shadow-md hover:scale-110 transition-transform"
                            style={{ left: `${(range.max / 500) * 100}%` }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const sliderContainer = document.getElementById(`slider-container-${road}`);
                              if (!sliderContainer) return;
                              
                              const sliderRect = sliderContainer.getBoundingClientRect();
                              
                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const newPosition = Math.max(0, Math.min(500, ((moveEvent.clientX - sliderRect.left) / sliderRect.width) * 500));
                                if (newPosition > range.min) {
                                  const updatedRanges = { 
                                    ...roadMileMarkerRanges, 
                                    [road]: { min: range.min, max: Math.round(newPosition) } 
                                  };
                                  setRoadMileMarkerRanges?.(updatedRanges);
                                  onRoadMileMarkerRangesChange?.(updatedRanges);
                                }
                              };
                              
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove);
                                document.removeEventListener('mouseup', handleMouseUp);
                              };
                              
                              document.addEventListener('mousemove', handleMouseMove);
                              document.addEventListener('mouseup', handleMouseUp);
                            }}
                          />
                        </div>
                        
                        {/* Input fields */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <input
                              type="number"
                              value={range.min}
                              min={0}
                              max={range.max - 1}
                              onChange={(e) => {
                                const value = Math.max(0, Math.min(range.max - 1, parseInt(e.target.value) || 0));
                                const updatedRanges = { 
                                  ...roadMileMarkerRanges, 
                                  [road]: { min: value, max: range.max } 
                                };
                                setRoadMileMarkerRanges?.(updatedRanges);
                                onRoadMileMarkerRangesChange?.(updatedRanges);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div className="text-gray-400">—</div>
                          <div className="flex-1">
                            <input
                              type="number"
                              value={range.max}
                              min={range.min + 1}
                              max={500}
                              onChange={(e) => {
                                const value = Math.max(range.min + 1, Math.min(500, parseInt(e.target.value) || 0));
                                const updatedRanges = { 
                                  ...roadMileMarkerRanges, 
                                  [road]: { min: range.min, max: value } 
                                };
                                setRoadMileMarkerRanges?.(updatedRanges);
                                onRoadMileMarkerRangesChange?.(updatedRanges);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>

          {/* <div className="flex flex-wrap gap-1 mt-2">
            {selectedRoads.map((road) => {
              const range = roadMileMarkerRanges[road] || { min: 0, max: 500 };
              return (
                <Badge key={road} variant="secondary" className="text-xs">
                  {road} (MM {range.min}-{range.max})
                </Badge>
              );
            })}
          </div> */}
        </div>
      </TabsContent>

      <TabsContent value="city" className="space-y-4">
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <p className="text-amber-800 text-sm">{error}</p>
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search locations..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllLocations} size="sm" disabled={loading}>
              {selectedLocations.length === locationData.city.length ? "Deselect All" : "Select All"}
            </Button>
            <Button 
              onClick={addCitySelections} 
              disabled={selectedLocations.length === 0}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Add Selection
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {filteredLocations.map((location) => (
                  <div key={location} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`location-${location}`}
                      checked={selectedLocations.includes(location)}
                      onCheckedChange={(checked) => {
                        const updatedLocations = checked
                          ? [...selectedLocations, location]
                          : selectedLocations.filter((l) => l !== location);
                        
                        // Update both state and call callback
                        setSelectedLocations?.(updatedLocations);
                        onSelectedLocationsChange?.(updatedLocations);
                      }}
                    />
                    <Label htmlFor={`location-${location}`} className="text-sm">{location}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* <div className="flex flex-wrap gap-1 mt-2">
            {selectedLocations.map((location) => (
              <Badge key={location} variant="secondary" className="text-xs">
                {location}
              </Badge>
            ))}
          </div> */}
        </div>
      </TabsContent>

      <TabsContent value="districts" className="space-y-4">
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-800" />
            <p className="text-amber-800 text-sm">{error}</p>
          </div>
        )}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search districts..."
              value={searchDistrict}
              onChange={(e) => setSearchDistrict(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllDistricts} size="sm" disabled={loading}>
              {selectedDistricts.length === locationData.district.length ? "Deselect All" : "Select All"}
            </Button>
            <Button 
              onClick={addDistrictSelections} 
              disabled={selectedDistricts.length === 0}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Add Selection
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {filteredDistricts.map((district) => (
                  <div key={district} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`district-${district}`}
                      checked={selectedDistricts.includes(district)}
                      onCheckedChange={(checked) => {
                        const updatedDistricts = checked
                          ? [...selectedDistricts, district]
                          : selectedDistricts.filter((d) => d !== district);
                        
                        // Update both state and call callback
                        setSelectedDistricts?.(updatedDistricts);
                        onSelectedDistrictsChange?.(updatedDistricts);
                      }}
                    />
                    <Label htmlFor={`district-${district}`} className="text-sm">{district}</Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* <div className="flex flex-wrap gap-1 mt-2">
            {selectedDistricts.map((district) => (
              <Badge key={district} variant="secondary" className="text-xs">
                {district}
              </Badge>
            ))}
          </div> */}
        </div>
      </TabsContent>

      <TabsContent value="points-of-interest" className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4">
          <p className="text-amber-800 text-sm">Note: The Points of Interest functionality is not yet implemented. This feature will be available in a future update.</p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search points of interest..."
              value={searchPOI}
              onChange={(e) => setSearchPOI(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllPointsOfInterest} size="sm">
              {selectedPointsOfInterest.length === pointsOfInterest.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {filteredPointsOfInterest.map((poi) => (
                <div key={poi} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={`poi-${poi}`}
                    checked={selectedPointsOfInterest.includes(poi)}
                    onCheckedChange={(checked) => {
                      const updatedPOIs = checked
                        ? [...selectedPointsOfInterest, poi]
                        : selectedPointsOfInterest.filter((p) => p !== poi);
                      
                      // Update both state and call callback
                      setSelectedPointsOfInterest?.(updatedPOIs);
                      onSelectedPointsOfInterestChange?.(updatedPOIs);
                    }}
                  />
                  <Label htmlFor={`poi-${poi}`} className="text-sm">{poi}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Radius (miles) (Not Functional): {poiRadius}</Label>
            <Slider value={[poiRadius]} min={1} max={50} step={1} onValueChange={([value]) => setPoiRadius(value)} />
          </div>

          {/* <div className="flex flex-wrap gap-1 mt-2">
            {selectedPointsOfInterest.map((poi) => (
              <Badge key={poi} variant="secondary" className="text-xs">
                {poi} ({poiRadius} mi)
              </Badge>
            ))}
          </div> */}
        </div>
      </TabsContent>

      <TabsContent value="draw" className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4">
          <p className="text-amber-800 text-sm">Note: The draw functionality is not yet implemented. This feature will be available in a future update.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={drawMode === "polygon" ? "default" : "outline"}
            onClick={() => setDrawMode("polygon")}
            className="flex-1"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Draw Polygon
          </Button>
          <Button
            variant={drawMode === "circle" ? "default" : "outline"}
            onClick={() => setDrawMode("circle")}
            className="flex-1"
          >
            <Circle className="mr-2 h-4 w-4" />
            Draw Circle
          </Button>
        </div>

        <div className="border rounded-md p-4 h-40 flex items-center justify-center bg-muted/50">
          {drawMode ? (
            <p className="text-center text-muted-foreground">Click on the map to start drawing a {drawMode}</p>
          ) : (
            <p className="text-center text-muted-foreground">Select a drawing mode above</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
    </div>
  )
}
