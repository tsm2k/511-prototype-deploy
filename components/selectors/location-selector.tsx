"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/router"
import { useToast } from "@/components/ui/use-toast"
import * as turf from "@turf/turf"
import { IntersectionDialog } from "@/components/ui/intersection-dialog"
import { NoIntersectionAlert } from "@/components/ui/no-intersection-alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { AlertCircle, ChevronDown, ChevronUp, X, Search, Pencil, Circle } from "lucide-react"

// Import from centralized API service
import { fetchLocationData, LocationData } from "@/services/api"
import { getPOICoordinates } from "@/services/poi-service"
import { getAllRoadNames, getRoadCoordinates } from "@/services/road-service"
import { getCityBoundary, getCountyBoundary } from "@/services/political-subdivisions-service"
import { fetchDistricts, fetchSubdistricts, getDistrictBoundary, getSubdistrictBoundary } from "@/services/agency-districts-service"

// Points of Interest and Roads will be loaded from GeoJSON

// Define the interface for mile marker ranges
interface MileMarkerRange {
  min: number
  max: number
}

// Define the interface for polygon coordinates
interface PolygonCoordinates {
  featureId: string;
  type: string;
  name?: string; // Optional name property for displaying in the UI
  coordinates: number[][][];
  boundingBox: {
    southwest: number[];
    northeast: number[];
  } | null;
}

// Define the interface for road selection with mile marker range
interface RoadSelection {
  road: string
  mileMarkerRange: MileMarkerRange
}

// Define the types of location selections
type LocationSelectionType = "road" | "city" | "district" | "subdistrict" | "polygon" | "county"

// Define the interface for location selections
interface LocationSelection {
  type: LocationSelectionType
  selection: string | string[] | PolygonCoordinates
  operator: "AND" | "OR"
  mileMarkerRange?: MileMarkerRange
  poiRadius?: number // Radius in miles for Points of Interest
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
  // State for POI radius values (in miles) - keyed by POI name
  const [poiRadiusValues, setPoiRadiusValues] = useState<Record<string, number>>({});
  // State for POI search query
  const [poiSearchQuery, setPoiSearchQuery] = useState<string>("");
  // State for points of interest from GeoJSON
  const [pointsOfInterest, setPointsOfInterest] = useState<string[]>([])
  // State for locations and districts from GeoJSON
  const [locations, setLocations] = useState<string[]>([])
  const [districts, setDistricts] = useState<string[]>([])
  
  // State for cities and counties from GeoJSON
  const [cities, setCities] = useState<string[]>([])
  const [counties, setCounties] = useState<string[]>([])
  
  // State for political subdivision sub-tab
  const [politicalSubdivisionTab, setPoliticalSubdivisionTab] = useState<"city" | "county">("city")
  
  // State for city and county search
  const [citySearchQuery, setCitySearchQuery] = useState<string>("")
  const [countySearchQuery, setCountySearchQuery] = useState<string>("")
  
  // State for selected cities and counties
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [selectedCounties, setSelectedCounties] = useState<string[]>([])
  
  // State for agency defined districts
  const [agencyDistricts, setAgencyDistricts] = useState<string[]>([])
  
  // State for confirmation dialogs
  const [showAddConfirmation, setShowAddConfirmation] = useState<boolean>(false)
  const [showClearConfirmation, setShowClearConfirmation] = useState<boolean>(false)
  const [agencySubdistricts, setAgencySubdistricts] = useState<string[]>([])
  const [districtSearchQuery, setDistrictSearchQuery] = useState('')
  const [subdistrictSearchQuery, setSubdistrictSearchQuery] = useState('')
  const [selectedAgencyDistricts, setSelectedAgencyDistricts] = useState<string[]>([])
  const [selectedAgencySubdistricts, setSelectedAgencySubdistricts] = useState<string[]>([])
  const [agencyDistrictTab, setAgencyDistrictTab] = useState<'district' | 'subdistrict'>('district')
  
  // State to track active tab
  const [activeTab, setActiveTab] = useState<string>("points-of-interest")
  
  // State for intersection dialog
  const [showIntersectionDialog, setShowIntersectionDialog] = useState(false)
  const [pendingRoadSelections, setPendingRoadSelections] = useState<string[]>([])
  const [pendingPoliticalSubdivisions, setPendingPoliticalSubdivisions] = useState<{name: string, type: 'city' | 'county' | 'district' | 'subdistrict', feature: any}[]>([])
  const [intersectionNoResults, setIntersectionNoResults] = useState(false)
  const [showNoIntersectionAlert, setShowNoIntersectionAlert] = useState(false);
  const [noIntersectionInfo, setNoIntersectionInfo] = useState<{roadName: string, subdivisionName: string}>({roadName: '', subdivisionName: ''});
  
  // Fetch points of interest from GeoJSON file
  useEffect(() => {
    const fetchPointsOfInterest = async () => {
      try {
        const response = await fetch('/geojson/point-of-interest-cleaned.geojson')
        const data = await response.json()
        
        // Extract fullname values from features
        const poiNames = data.features
          .map((feature: any) => feature.attributes.fullname)
          .filter((name: string) => name && name.trim() !== ' ' && name.trim() !== '') // Filter out empty names
          .sort() // Sort alphabetically
        
        setPointsOfInterest(poiNames)
      } catch (error) {
        console.error('Error fetching points of interest:', error)
        // Fallback to empty array if fetch fails
        setPointsOfInterest([])
      }
    }
    
    fetchPointsOfInterest()
  }, [])
  
  // Fetch cities from GeoJSON file
  useEffect(() => {
    const fetchCities = async () => {
      try {
        console.log('Fetching cities...');
        const response = await fetch('/geojson/city-cleaned.geojson');
        if (!response.ok) {
          throw new Error(`Failed to fetch cities: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Loaded ${data.features.length} cities from GeoJSON`);
        
        // Extract city names from features
        const cityNames = data.features
          .map((feature: any) => feature.properties.name)
          .filter((name: string) => name && name.trim() !== '' && name.trim() !== ' ') // Filter out empty names
          .sort((a: string, b: string) => a.localeCompare(b)); // Sort alphabetically
        
        console.log(`Filtered to ${cityNames.length} valid city names`);
        setCities(cityNames);
      } catch (error) {
        console.error('Error fetching cities:', error);
        // Fallback to empty array if fetch fails
        setCities([]);
      }
    };
    
    fetchCities();
  }, []);
  
  // Fetch counties from GeoJSON file
  useEffect(() => {
    const fetchCounties = async () => {
      try {
        console.log('Fetching counties...');
        const response = await fetch('/geojson/counties-cleaned.geojson');
        if (!response.ok) {
          throw new Error(`Failed to fetch counties: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Loaded ${data.features.length} counties from GeoJSON`);
        
        // Extract county names from features
        const countyNames = data.features
          .map((feature: any) => feature.properties.name)
          .filter((name: string) => name && name.trim() !== '' && name.trim() !== ' ') // Filter out empty names
          .sort((a: string, b: string) => a.localeCompare(b)); // Sort alphabetically
        
        console.log(`Filtered to ${countyNames.length} valid county names`);
        setCounties(countyNames);
      } catch (error) {
        console.error('Error fetching counties:', error);
        // Fallback to empty array if fetch fails
        setCounties([]);
      }
    };
    
    fetchCounties();
  }, [])
  
  // Fetch agency districts from GeoJSON file
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        console.log('Fetching agency districts...');
        const districtNames = await fetchDistricts();
        console.log(`Loaded ${districtNames.length} agency districts`);
        setAgencyDistricts(districtNames);
      } catch (error) {
        console.error('Error fetching agency districts:', error);
        // Fallback to empty array if fetch fails
        setAgencyDistricts([]);
      }
    };
    
    loadDistricts();
  }, []);
  
  // Fetch agency subdistricts from GeoJSON file
  useEffect(() => {
    const loadSubdistricts = async () => {
      try {
        console.log('Fetching agency subdistricts...');
        const subdistrictNames = await fetchSubdistricts();
        console.log(`Loaded ${subdistrictNames.length} agency subdistricts`);
        setAgencySubdistricts(subdistrictNames);
      } catch (error) {
        console.error('Error fetching agency subdistricts:', error);
        // Fallback to empty array if fetch fails
        setAgencySubdistricts([]);
      }
    };
    
    loadSubdistricts();
  }, []);;
  
  // Fetch roads from GeoJSON file
  useEffect(() => {
    const fetchRoads = async () => {
      try {
        const roadNames = await getAllRoadNames()
        setLocations(roadNames)
      } catch (error) {
        console.error('Error fetching roads:', error)
        // Fallback to empty array if fetch fails
        setLocations([])
      }
    }
    
    fetchRoads()
  }, [])
  
  // Remove the global mileMarkerRange state as we'll use per-road ranges
  const [drawMode, setDrawMode] = useState<"polygon" | "circle" | null>(null)
  const [searchRoad, setSearchRoad] = useState("")
  const [searchLocation, setSearchLocation] = useState("")
  const [searchDistrict, setSearchDistrict] = useState("")
  const [searchPOI, setSearchPOI] = useState("")
  
  // State for drawn polygons
  const [drawnPolygons, setDrawnPolygons] = useState<PolygonCoordinates[]>([])
  const [selectedPolygonId, setSelectedPolygonId] = useState<string | null>(null)
  
  // State for API data
  const [locationData, setLocationData] = useState<LocationData>({
    city: [],
    district: [],
    route: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Listen for polygon drawing events from MapView
  useEffect(() => {
    const handlePolygonDrawn = (event: CustomEvent) => {
      console.log('Polygon drawn event received:', event.detail);
      // Add the new polygon to state
      setDrawnPolygons(prev => [...prev, event.detail]);
      // Automatically select the new polygon
      setSelectedPolygonId(event.detail.featureId);
      // Reset draw mode
      setDrawMode(null);
    };
    
    const handlePolygonUpdated = (event: CustomEvent) => {
      console.log('Polygon updated event received:', event.detail);
      // Update the polygon in state
      setDrawnPolygons(prev => 
        prev.map(poly => 
          poly.featureId === event.detail.featureId ? event.detail : poly
        )
      );
    };
    
    const handlePolygonDeleted = (event: CustomEvent) => {
      console.log('Polygon deleted event received:', event.detail);
      // Remove the deleted polygons from state
      setDrawnPolygons(prev => 
        prev.filter(poly => !event.detail.featureIds.includes(poly.featureId))
      );
      // Clear selection if the selected polygon was deleted
      if (selectedPolygonId && event.detail.featureIds.includes(selectedPolygonId)) {
        setSelectedPolygonId(null);
      }
    };
    
    // Add event listeners
    window.addEventListener('location-polygon-drawn', handlePolygonDrawn as EventListener);
    window.addEventListener('location-polygon-updated', handlePolygonUpdated as EventListener);
    window.addEventListener('location-polygon-deleted', handlePolygonDeleted as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('location-polygon-drawn', handlePolygonDrawn as EventListener);
      window.removeEventListener('location-polygon-updated', handlePolygonUpdated as EventListener);
      window.removeEventListener('location-polygon-deleted', handlePolygonDeleted as EventListener);
    };
  }, []);
  
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
  
  // Filter functions using the GeoJSON data for roads
  const filteredRoads = locations.filter(road => 
    road.toLowerCase().includes(searchRoad.toLowerCase())
  )

  const filteredLocations = locationData.city.filter(location => 
    location.toLowerCase().includes(searchLocation.toLowerCase())
  )

  const filteredDistricts = locationData.district.filter(district => 
    district.toLowerCase().includes(searchDistrict.toLowerCase())
  )

  const filteredPointsOfInterest = poiSearchQuery
    ? pointsOfInterest.filter(poi => poi.toLowerCase().includes(poiSearchQuery.toLowerCase()))
    : pointsOfInterest;
    
  const filteredCities = citySearchQuery
    ? cities.filter(city => city.toLowerCase().includes(citySearchQuery.toLowerCase()))
    : cities;

  const filteredCounties = countySearchQuery
    ? counties.filter(county => county.toLowerCase().includes(countySearchQuery.toLowerCase()))
    : counties;

  const filteredAgencyDistricts = districtSearchQuery
    ? agencyDistricts.filter(district => district.toLowerCase().includes(districtSearchQuery.toLowerCase()))
    : agencyDistricts;

  const filteredAgencySubdistricts = subdistrictSearchQuery
    ? agencySubdistricts.filter(subdistrict => subdistrict.toLowerCase().includes(subdistrictSearchQuery.toLowerCase()))
    : agencySubdistricts;

  // Toggle functions updated to use dynamic data
  const toggleAllRoads = () => {
    const updatedRoads = selectedRoads.length === locations.length ? [] : [...locations];
    
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

  const toggleAllCities = () => {
    const updatedCities = selectedCities.length === cities.length ? [] : [...cities];
    
    // Always update both state and call callback
    setSelectedCities?.(updatedCities);
  }

  const toggleAllCounties = () => {
    const updatedCounties = selectedCounties.length === counties.length ? [] : [...counties];
    
    // Always update both state and call callback
    setSelectedCounties?.(updatedCounties);
  }

  const toggleAllAgencyDistricts = () => {
    const updatedDistricts = selectedAgencyDistricts.length === agencyDistricts.length ? [] : [...agencyDistricts];

    // Always update state
    setSelectedAgencyDistricts(updatedDistricts);
  }

  const toggleAllAgencySubdistricts = () => {
    const updatedSubdistricts = selectedAgencySubdistricts.length === agencySubdistricts.length ? [] : [...agencySubdistricts];

    // Always update state
    setSelectedAgencySubdistricts(updatedSubdistricts);
  }
  
  // Function to remove a selection
  const handleRemoveSelection = (index: number) => {
    const selectionToRemove = selections[index];
    
    // Dispatch an event to notify the map to remove this selection
    const event = new CustomEvent('selection-removed', {
      detail: selectionToRemove
    });
    window.dispatchEvent(event);
    
    // Remove the selection from the array
    const updatedSelections = selections.filter((_, i) => i !== index);
    onSelectionsChange?.(updatedSelections);
  };
  
  // Function to handle intersection between road and political subdivision
  const handleIntersection = async () => {
    if (pendingRoadSelections.length === 0 || pendingPoliticalSubdivisions.length === 0) {
      setShowIntersectionDialog(false);
      return;
    }
    
    try {
      console.log('Starting intersection process with:', {
        roads: pendingRoadSelections,
        subdivisions: pendingPoliticalSubdivisions.map(s => `${s.type}: ${s.name}`)
      });
      
      // Track if we found any intersections
      let hasAnyIntersection = false;
      
      // Process each road-subdivision pair
      for (const roadName of pendingRoadSelections) {
        // Get coordinates for this road
        const roadCoords = await getRoadCoordinates(roadName);
        
        if (!roadCoords || roadCoords.length === 0) {
          console.warn(`No coordinates found for road ${roadName}, skipping`);
          continue;
        }
        
        console.log(`Processing road ${roadName} with ${roadCoords.length} segments`);
        
        // Create features for this road, handling MultiLineString geometries
        const roadFeatures = [];
        
        for (const lineCoords of roadCoords) {
          if (lineCoords && lineCoords.length >= 2) { // A valid line needs at least 2 points
            console.log('Creating LineString with', lineCoords.length, 'points');
            const lineFeature = turf.lineString(lineCoords);
            roadFeatures.push(lineFeature);
          } else {
            console.warn('Invalid line coordinates, skipping', lineCoords);
          }
        }
        
        if (roadFeatures.length === 0) {
          console.error(`No valid features found for road ${roadName}, skipping`);
          continue;
        }
        
        // Create a feature collection for this road
        const roadCollection = turf.featureCollection(roadFeatures);
        
        // Process each political subdivision for this road
        for (const subdivision of pendingPoliticalSubdivisions) {
          const { name, type, feature } = subdivision;
          
          console.log(`Processing intersection between road ${roadName} and ${type} ${name}`);
          
          // Convert the feature to a proper GeoJSON feature if it's not already
          let subdivisionFeature;
          if (feature.type === 'Feature') {
            subdivisionFeature = feature;
          } else if (feature.geometry) {
            subdivisionFeature = feature;
          } else {
            // If it's just a geometry, convert it to a feature
            subdivisionFeature = turf.feature(feature);
          }
          
          // Find the intersection for this road-subdivision pair
          let intersections = [];
          
          for (const roadFeature of roadFeatures) {
            try {
              // Check if there's any intersection
              const doesIntersect = turf.booleanIntersects(roadFeature, subdivisionFeature);
              console.log(`Does ${roadName} intersect with ${name}?`, doesIntersect);
              
              if (doesIntersect) {
                // If there's an intersection, find the actual intersection points
                try {
                  const intersection = turf.lineIntersect(roadFeature, subdivisionFeature);
                  
                  if (intersection.features.length > 0) {
                    // Add all intersection points to our collection
                    intersections.push(...intersection.features);
                    hasAnyIntersection = true;
                  }
                } catch (intersectionError) {
                  console.error('Error finding precise intersection:', intersectionError);
                }
              }
            } catch (error) {
              console.error('Error checking intersection:', error);
            }
          }
          
          if (intersections.length > 0) {
            // Create a unique feature ID for this road-subdivision pair
            const featureId = `${roadName}-${name}-${type}-intersection`;
            
            // Create a new selection for this intersection
            const intersectionSelection: LocationSelection = {
              type: 'polygon',
              selection: {
                featureId: featureId,
                type: 'Intersection',
                // Display the actual road and subdivision names
                name: `${roadName} ∩ ${name}`,
                coordinates: [[]],  // This will be updated by the map component
                boundingBox: null,
                southwest: [0, 0],
                northeast: [0, 0]
              } as PolygonCoordinates,
              operator: 'AND'
            };
            
            // Update selections state with this intersection
            onSelectionsChange?.([...selections, intersectionSelection]);
            
            // Dispatch event for map to add this intersection
            console.log(`Dispatching intersection event for ${roadName} and ${name} with ${intersections.length} features`);
            
            const event = new CustomEvent('intersection-added', {
              detail: {
                roadName: roadName,
                subdivisionName: name,
                subdivisionType: type,
                roadFeature: roadCollection,
                subdivisionFeature,
                intersectionFeatures: intersections
              }
            });
            window.dispatchEvent(event);
            
            console.log(`Intersection event dispatched for ${roadName} and ${name}`);
          }
        }
      }
      
      // If no intersections were found at all, show the no results alert
      if (!hasAnyIntersection) {
        console.log('No intersections found for any road-subdivision pair');
        setIntersectionNoResults(true);
        
        // Show the custom no intersection alert with the first road and subdivision
        setNoIntersectionInfo({
          roadName: pendingRoadSelections[0],
          subdivisionName: pendingPoliticalSubdivisions[0].name
        });
        setShowNoIntersectionAlert(true);
      }
      
      // Reset pending selections after processing
      setPendingRoadSelections([]);
      setPendingPoliticalSubdivisions([]);
      setShowIntersectionDialog(false);
    } catch (error) {
      console.error('Error processing intersection:', error);
      alert("There was an error finding the intersection. Please try again.");
      setShowIntersectionDialog(false);
    }
  };

  // Function to keep selections separate
  const handleKeepSeparate = () => {
    // Close the dialog
    setShowIntersectionDialog(false);
    
    // Add road selections
    if (pendingRoadSelections.length > 0) {
      const newRoadSelections: LocationSelection[] = pendingRoadSelections.map((road) => ({
        type: "road",
        selection: road,
        operator: "AND"
      }));
      
      onSelectionsChange?.([...selections, ...newRoadSelections]);
      
      // For each road, dispatch event to map
      for (const road of pendingRoadSelections) {
        try {
          // Get the road coordinates from GeoJSON
          getRoadCoordinates(road).then(roadCoords => {
            if (roadCoords) {
              // Dispatch event for map to add road line
              const event = new CustomEvent('road-selection-added', {
                detail: {
                  name: road,
                  coordinates: roadCoords,
                  type: 'road'
                }
              });
              window.dispatchEvent(event);
            }
          });
        } catch (error) {
          console.error(`Error getting coordinates for road ${road}:`, error);
        }
      }
    }
    
    // Add political subdivision selections
    if (pendingPoliticalSubdivisions.length > 0) {
      const newSubdivisionSelections: LocationSelection[] = pendingPoliticalSubdivisions.map((subdivision) => ({
        type: subdivision.type as LocationSelectionType,
        selection: subdivision.name,
        operator: "AND"
      }));
      
      onSelectionsChange?.([...selections, ...newSubdivisionSelections]);
      
      // For each subdivision, dispatch event to map
      for (const subdivision of pendingPoliticalSubdivisions) {
        try {
          // Dispatch event for map to add boundary
          const event = new CustomEvent(`${subdivision.type}-boundary-added`, {
            detail: {
              name: subdivision.name,
              feature: subdivision.feature,
              type: subdivision.type
            }
          });
          window.dispatchEvent(event);
        } catch (error) {
          console.error(`Error adding boundary for ${subdivision.type} ${subdivision.name}:`, error);
        }
      }
    }
    
    // Clear pending selections
    setPendingRoadSelections([]);
    setPendingPoliticalSubdivisions([]);
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
            // Check if this is a Point of Interest (has poiRadius property)
            if (selection.poiRadius !== undefined) {
              return selection.poiRadius > 0 
                ? `PoI: ${selection.selection} (${selection.poiRadius} mi radius)` 
                : `PoI: ${selection.selection}`;
            } else {
              return `City: ${selection.selection}`;
            }
          }
        case "district":
          if (Array.isArray(selection.selection)) {
            return `Districts: ${selection.selection.join(", ")}`;  
          } else {
            return `District: ${selection.selection}`;
          }
        case "subdistrict":
          if (Array.isArray(selection.selection)) {
            return `Subdistricts: ${selection.selection.join(", ")}`;  
          } else {
            return `Subdistrict: ${selection.selection}`;
          }
        case "county":
          if (Array.isArray(selection.selection)) {
            return `Counties: ${selection.selection.join(", ")}`;  
          } else {
            return `County: ${selection.selection}`;
          }
        default:
          return "";
      }
    }).join(", ");
  }, [selections]);

  // Function to add road selections
  const addRoadSelections = async () => {
    if (selectedRoads.length > 0) {
      // Add each road as its own selection
      const newSelections: LocationSelection[] = selectedRoads.map((road) => ({
        type: "road",
        selection: road,
        operator: "AND"
      }));
      
      // Update selections state
      onSelectionsChange?.([...selections, ...newSelections]);
      
      // For each road, get coordinates and dispatch event to map
      for (const road of selectedRoads) {
        try {
          const coordinates = await getRoadCoordinates(road);
          if (coordinates) {
            // Dispatch event for map to add road line
            const event = new CustomEvent('road-selection-added', {
              detail: {
                name: road,
                coordinates,
                type: 'road'
              }
            });
            window.dispatchEvent(event);
          }
        } catch (error) {
          console.error(`Error getting coordinates for road ${road}:`, error);
        }
      }
      
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

  // Function to clear all selections
  const clearAllSelections = () => {
    // Clear all selections
    if (selections.length > 0) {
      // For each selection, dispatch an event to remove it from the map
      selections.forEach(selection => {
        const event = new CustomEvent('selection-removed', {
          detail: selection
        });
        window.dispatchEvent(event);
      });
      
      // Update the selections state
      onSelectionsChange?.([]);
      
      // Hide the confirmation dialog
      setShowClearConfirmation(false);
    }
  };
  
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
      
      // Hide the confirmation dialog
      setShowAddConfirmation(false);
    }
  }

  // Function to add city selections
  const addCityTabSelections = () => {
    if (selectedCities.length > 0) {
      const newSelection: LocationSelection = {
        type: "city",
        selection: [...selectedCities],
        operator: "AND" // Default operator
      };
      
      onSelectionsChange?.([...selections, newSelection]);
      
      // Clear the selected cities after adding
      setSelectedCities?.([]);
    }
  }

  // Function to add county selections
  const addCountyTabSelections = () => {
    if (selectedCounties.length > 0) {
      const newSelection: LocationSelection = {
        type: "district",
        selection: [...selectedCounties],
        operator: "AND" // Default operator
      };
      
      onSelectionsChange?.([...selections, newSelection]);
      
      // Clear the selected counties after adding
      setSelectedCounties?.([]);
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Selection Preview */}
      <div className="space-y-2">
        {/* <h3 className="text-sm font-medium">Current Selections</h3> */}
        <div className="min-h-[40px] p-2 border rounded-md bg-slate-50">
          {selections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No location selections added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selections.map((selection, index) => {
                let content = "";
                
                switch (selection.type) {
                  case "polygon":
                    // Handle polygon selection
                    const polygonData = selection.selection as PolygonCoordinates;
                    
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
                
                return (
                  <div key={index} className="flex items-center gap-1">
                    {index > 0 && (
                      <span className="mx-1 text-lg font-bold text-gray-400">|</span>
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
                        onClick={() => handleRemoveSelection(index)}
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

      {/* Location Selection Area */}
      <div className="flex flex-col space-y-6">
        {/* Main Selection Area */}
        <div className="grid grid-cols-1 gap-6">
          {/* Location Type Selection */}
          <div className="w-full">
            {/* <h3 className="text-sm font-medium mb-2">Choose by Type</h3> */}
            <Tabs defaultValue="points-of-interest" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap gap-2 mb-4 bg-transparent p-0">
                <TabsTrigger 
                  value="points-of-interest" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={selectedRoads.length > 0 || selectedCities.length > 0 || selectedCounties.length > 0 || selectedAgencyDistricts.length > 0 || selectedAgencySubdistricts.length > 0 || drawnPolygons.length > 0}
                >
                  <span>Points of Interest</span>
                  {(selectedPointsOfInterest.length > 0 || selections.some(s => s.type === "city" && typeof s.selection === "string" && s.poiRadius !== undefined)) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full !flex !items-center !justify-center">
                      {selectedPointsOfInterest.length + selections.filter(s => s.type === "city" && typeof s.selection === "string" && s.poiRadius !== undefined).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="road" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={selectedPointsOfInterest.length > 0 || drawnPolygons.length > 0}
                >
                  <span>Road</span>
                  {(selectedRoads.length > 0 || selections.some(s => s.type === "road")) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full !flex !items-center !justify-center">
                      {selectedRoads.length + selections.filter(s => s.type === "road").length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="city" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={selectedPointsOfInterest.length > 0 || selectedAgencyDistricts.length > 0 || selectedAgencySubdistricts.length > 0 || drawnPolygons.length > 0}
                >
                  <span>Political Subdivisions</span>
                  {(selectedCities.length > 0 || selectedCounties.length > 0 || 
                    selections.some(s => (s.type === "city" || s.type === "county") && s.poiRadius === undefined)) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full !flex !items-center !justify-center">
                      {selectedCities.length + selectedCounties.length + 
                       selections.filter(s => (s.type === "city" || s.type === "county") && s.poiRadius === undefined).length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="agency-districts" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={selectedPointsOfInterest.length > 0 || selectedCities.length > 0 || selectedCounties.length > 0 || drawnPolygons.length > 0}
                >
                  <span>Agency Defined Districts</span>
                  {(selectedAgencyDistricts.length > 0 || selectedAgencySubdistricts.length > 0 || 
                    selections.some(s => s.type === "district" || s.type === "subdistrict")) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full !flex !items-center !justify-center">
                      {selectedAgencyDistricts.length + selectedAgencySubdistricts.length + 
                       selections.filter(s => s.type === "district" || s.type === "subdistrict").length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="draw" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={selectedPointsOfInterest.length > 0 || selectedRoads.length > 0 || selectedCities.length > 0 || selectedCounties.length > 0 || selectedAgencyDistricts.length > 0 || selectedAgencySubdistricts.length > 0}
                >
                  <span>Draw on Map</span>
                  {(drawnPolygons.length > 0 || selections.some(s => s.type === "polygon")) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full !flex !items-center !justify-center">
                      {drawnPolygons.length + selections.filter(s => s.type === "polygon").length}
                    </span>
                  )}
                </TabsTrigger>
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
              placeholder="Search 2,480 roads..."
              value={searchRoad}
              onChange={(e) => setSearchRoad(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {/* Sort the roads to show selected items at the top */}
                {filteredRoads
                  .sort((a, b) => {
                    // If both are selected or both are unselected, maintain original order
                    if (selectedRoads.includes(a) === selectedRoads.includes(b)) {
                      return a.localeCompare(b);
                    }
                    // Selected items come first
                    return selectedRoads.includes(a) ? -1 : 1;
                  })
                  .map((road) => {
                  // Get the mile marker range for this road or use default
                  const range = roadMileMarkerRanges[road] || { min: 0, max: 500 };
                
                return (
                  <div key={road} className="border-b border-gray-100 last:border-b-0 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`road-${road}`}
                          checked={selectedRoads.includes(road)}
                          onCheckedChange={async (checked) => {
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
                            
                            // Dispatch event to show/hide road preview on map
                            if (checked) {
                              try {
                                // Get the road coordinates
                                const coordinates = await getRoadCoordinates(road);
                                if (coordinates && coordinates.length > 0) {
                                  const event = new CustomEvent('road-preview-show', {
                                    detail: { road: { name: road, coordinates } }
                                  });
                                  window.dispatchEvent(event);
                                }
                              } catch (error) {
                                console.error(`Error getting coordinates for road ${road}:`, error);
                              }
                            } else {
                              const event = new CustomEvent('road-preview-hide', {
                                detail: { road: { name: road } }
                              });
                              window.dispatchEvent(event);
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
              onClick={() => setShowAddConfirmation(true)} 
              disabled={selectedDistricts.length === 0}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Add Selection
            </Button>
            <Button 
              onClick={() => setShowClearConfirmation(true)} 
              disabled={selections.length === 0}
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Clear All
            </Button>
          </div>
          
          {/* Confirmation Dialog for Add Selection */}
          {showAddConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Confirm Add Selection</h3>
                <p className="mb-6">Are you sure you want to add {selectedDistricts.length} district(s) to your selection?</p>
                <div className="flex justify-end gap-2">
                  <Button 
                    onClick={() => setShowAddConfirmation(false)} 
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={addDistrictSelections} 
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Confirmation Dialog for Clear Selections */}
          {showClearConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h3 className="text-lg font-semibold mb-4">Confirm Clear All Selections</h3>
                <p className="mb-6">Are you sure you want to clear all {selections.length} selection(s) from the map?</p>
                <div className="flex justify-end gap-2">
                  <Button 
                    onClick={() => setShowClearConfirmation(false)} 
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={clearAllSelections} 
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          )}

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
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search 2000 points of interest..."
              value={poiSearchQuery}
              onChange={(e) => setPoiSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {/* Sort the POIs to show selected items at the top */}
              {filteredPointsOfInterest
                .sort((a, b) => {
                  // If both are selected or both are unselected, maintain original order
                  if (selectedPointsOfInterest.includes(a) === selectedPointsOfInterest.includes(b)) {
                    return a.localeCompare(b);
                  }
                  // Selected items come first
                  return selectedPointsOfInterest.includes(a) ? -1 : 1;
                })
                .map((poi) => (
                <React.Fragment key={poi}>
                  <div className="border-b border-gray-100 last:border-b-0 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`poi-${poi}`}
                          checked={selectedPointsOfInterest.includes(poi)}
                          onCheckedChange={(checked) => {
                            const updatedPOIs = checked
                              ? [...selectedPointsOfInterest, poi]
                              : selectedPointsOfInterest.filter((p) => p !== poi);
                            
                            // Notify parent via callback prop
                            onSelectedPointsOfInterestChange?.(updatedPOIs);
                            
                            // Handle radius values
                            if (checked) {
                              // Initialize radius to 0 when selecting a POI
                              setPoiRadiusValues(prev => ({
                                ...prev,
                                [poi]: 0
                              }));
                              
                              // Dispatch event to show POI preview on map
                              try {
                                // Get the POI coordinates using the service function
                                getPOICoordinates(poi).then(coordinates => {
                                  if (coordinates) {
                                    const event = new CustomEvent('poi-preview-show', {
                                      detail: { 
                                        name: poi,
                                        coordinates: coordinates,
                                        radius: 0 // Initial radius
                                      }
                                    });
                                    window.dispatchEvent(event);
                                  }
                                });
                              } catch (error) {
                                console.error(`Error showing preview for POI ${poi}:`, error);
                              }
                            } else {
                              // Remove radius value when deselecting a POI
                              const newRadiusValues = {...poiRadiusValues};
                              delete newRadiusValues[poi];
                              setPoiRadiusValues(newRadiusValues);
                              
                              // Dispatch event to hide POI preview on map
                              const event = new CustomEvent('poi-preview-hide', {
                                detail: { name: poi }
                              });
                              window.dispatchEvent(event);
                            }
                          }}
                        />
                        <Label
                          htmlFor={`poi-${poi}`}
                          className="text-sm font-medium"
                        >
                          {poi}
                        </Label>
                      </div>
                      
                      {selectedPointsOfInterest.includes(poi) && (
                        <div className="flex items-center">
                          <div className="flex items-center space-x-1">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={poiRadiusValues[poi]?.toString() || ''}
                              onChange={(e) => {
                                // Allow empty string (for backspacing) or numbers
                                const inputValue = e.target.value;
                                if (inputValue === '' || /^\d+$/.test(inputValue)) {
                                  const value = inputValue === '' ? 0 : parseInt(inputValue);
                                  setPoiRadiusValues(prev => ({
                                    ...prev,
                                    [poi]: value
                                  }));
                                  
                                  // Update the preview with the new radius
                                  try {
                                    // Get the POI coordinates using the service function
                                    getPOICoordinates(poi).then(coordinates => {
                                      if (coordinates) {
                                        const event = new CustomEvent('poi-preview-update', {
                                          detail: { 
                                            name: poi,
                                            coordinates: coordinates,
                                            radius: value
                                          }
                                        });
                                        window.dispatchEvent(event);
                                      }
                                    });
                                  } catch (error) {
                                    console.error(`Error updating preview for POI ${poi}:`, error);
                                  }
                                }
                              }}
                              className="w-12 h-6 text-xs px-1 py-0"
                            />
                            <span className="text-xs text-gray-500">mi</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </TabsContent>
      
      <TabsContent value="city" className="space-y-4">
        <div className="space-y-4">
          {/* Sub-tabs for City/Town and County - Moved above the card */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-4 py-2 text-sm font-medium ${politicalSubdivisionTab === 'city' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setPoliticalSubdivisionTab('city')}
            >
              City/Town
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${politicalSubdivisionTab === 'county' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setPoliticalSubdivisionTab('county')}
            >
              County
            </button>
          </div>
          
          {/* City/Town Tab Content */}
          {politicalSubdivisionTab === 'city' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search 971 cities and towns..."
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {filteredCities.length > 0 ? (
                    /* Sort the cities to show selected items at the top */
                    filteredCities
                      .sort((a, b) => {
                        // If both are selected or both are unselected, maintain original order
                        if (selectedCities.includes(a) === selectedCities.includes(b)) {
                          return a.localeCompare(b);
                        }
                        // Selected items come first
                        return selectedCities.includes(a) ? -1 : 1;
                      })
                      .map((city) => (
                      <div key={city} className="border-b border-gray-100 last:border-b-0 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`city-${city}`}
                              checked={selectedCities.includes(city)}
                              onCheckedChange={async (checked) => {
                                const updatedCities = checked
                                  ? [...selectedCities, city]
                                  : selectedCities.filter((c) => c !== city);
                                setSelectedCities(updatedCities);
                                
                                // Dispatch event to show/hide city preview on map
                                if (checked) {
                                  try {
                                    // Get the city boundary data
                                    const cityFeature = await getCityBoundary(city);
                                    if (cityFeature) {
                                      const event = new CustomEvent('city-preview-show', {
                                        detail: { name: city, feature: cityFeature }
                                      });
                                      window.dispatchEvent(event);
                                    }
                                  } catch (error) {
                                    console.error(`Error getting boundary for city ${city}:`, error);
                                  }
                                } else {
                                  const event = new CustomEvent('city-preview-hide', {
                                    detail: { name: city }
                                  });
                                  window.dispatchEvent(event);
                                }
                              }}
                            />
                            <Label
                              htmlFor={`city-${city}`}
                              className="text-sm font-medium"
                            >
                              {city}
                            </Label>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-gray-500">
                      {citySearchQuery ? "No cities found matching your search" : "Loading cities..."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* County Tab Content */}
          {politicalSubdivisionTab === 'county' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search 92 counties..."
                  value={countySearchQuery}
                  onChange={(e) => setCountySearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {filteredCounties.length > 0 ? (
                    /* Sort the counties to show selected items at the top */
                    filteredCounties
                      .sort((a, b) => {
                        // If both are selected or both are unselected, maintain original order
                        if (selectedCounties.includes(a) === selectedCounties.includes(b)) {
                          return a.localeCompare(b);
                        }
                        // Selected items come first
                        return selectedCounties.includes(a) ? -1 : 1;
                      })
                      .map((county) => (
                      <div key={county} className="border-b border-gray-100 last:border-b-0 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`county-${county}`}
                              checked={selectedCounties.includes(county)}
                              onCheckedChange={async (checked) => {
                                const updatedCounties = checked
                                  ? [...selectedCounties, county]
                                  : selectedCounties.filter((c) => c !== county);
                                setSelectedCounties(updatedCounties);
                                
                                // Dispatch event to show/hide county preview on map
                                if (checked) {
                                  try {
                                    // Get the county boundary data
                                    const countyFeature = await getCountyBoundary(county);
                                    if (countyFeature) {
                                      const event = new CustomEvent('county-preview-show', {
                                        detail: { name: county, feature: countyFeature }
                                      });
                                      window.dispatchEvent(event);
                                    }
                                  } catch (error) {
                                    console.error(`Error getting boundary for county ${county}:`, error);
                                  }
                                } else {
                                  const event = new CustomEvent('county-preview-hide', {
                                    detail: { name: county }
                                  });
                                  window.dispatchEvent(event);
                                }
                              }}
                            />
                            <Label
                              htmlFor={`county-${county}`}
                              className="text-sm font-medium"
                            >
                              {county}
                            </Label>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-gray-500">
                      {countySearchQuery ? "No counties found matching your search" : "Loading counties..."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="agency-districts" className="space-y-4">
        <div className="space-y-4">
          {/* Sub-tabs for Districts and Subdistricts */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-4 py-2 text-sm font-medium ${agencyDistrictTab === 'district' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setAgencyDistrictTab('district')}
            >
              Districts
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${agencyDistrictTab === 'subdistrict' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setAgencyDistrictTab('subdistrict')}
            >
              Subdistricts
            </button>
          </div>
          
          {/* Districts Tab Content */}
          {agencyDistrictTab === 'district' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search 6 districts..."
                  value={districtSearchQuery}
                  onChange={(e) => setDistrictSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {filteredAgencyDistricts.length > 0 ? (
                    /* Sort the districts to show selected items at the top */
                    filteredAgencyDistricts
                      .sort((a, b) => {
                        // If both are selected or both are unselected, maintain original order
                        if (selectedAgencyDistricts.includes(a) === selectedAgencyDistricts.includes(b)) {
                          return a.localeCompare(b);
                        }
                        // Selected items come first
                        return selectedAgencyDistricts.includes(a) ? -1 : 1;
                      })
                      .map((district) => (
                      <div key={district} className="border-b border-gray-100 last:border-b-0 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`district-${district}`}
                              checked={selectedAgencyDistricts.includes(district)}
                              onCheckedChange={async (checked) => {
                                const updatedDistricts = checked
                                  ? [...selectedAgencyDistricts, district]
                                  : selectedAgencyDistricts.filter((d) => d !== district);
                                setSelectedAgencyDistricts(updatedDistricts);
                                
                                // Dispatch event to show/hide district preview on map
                                if (checked) {
                                  try {
                                    // Get the district boundary data
                                    const districtFeature = await getDistrictBoundary(district);
                                    if (districtFeature) {
                                      const event = new CustomEvent('district-preview-show', {
                                        detail: { name: district, feature: districtFeature }
                                      });
                                      window.dispatchEvent(event);
                                    }
                                  } catch (error) {
                                    console.error(`Error getting boundary for district ${district}:`, error);
                                  }
                                } else {
                                  const event = new CustomEvent('district-preview-hide', {
                                    detail: { name: district }
                                  });
                                  window.dispatchEvent(event);
                                }
                              }}
                            />
                            <Label
                              htmlFor={`district-${district}`}
                              className="text-sm font-medium"
                            >
                              {district}
                            </Label>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-gray-500">
                      {districtSearchQuery ? "No districts found matching your search" : "Loading districts..."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Subdistricts Tab Content */}
          {agencyDistrictTab === 'subdistrict' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search 29 subdistricts..."
                  value={subdistrictSearchQuery}
                  onChange={(e) => setSubdistrictSearchQuery(e.target.value)}
                  className="h-8"
                />
              </div>
              
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {filteredAgencySubdistricts.length > 0 ? (
                    /* Sort the subdistricts to show selected items at the top */
                    filteredAgencySubdistricts
                      .sort((a, b) => {
                        // If both are selected or both are unselected, maintain original order
                        if (selectedAgencySubdistricts.includes(a) === selectedAgencySubdistricts.includes(b)) {
                          return a.localeCompare(b);
                        }
                        // Selected items come first
                        return selectedAgencySubdistricts.includes(a) ? -1 : 1;
                      })
                      .map((subdistrict) => (
                      <div key={subdistrict} className="border-b border-gray-100 last:border-b-0 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`subdistrict-${subdistrict}`}
                              checked={selectedAgencySubdistricts.includes(subdistrict)}
                              onCheckedChange={async (checked) => {
                                const updatedSubdistricts = checked
                                  ? [...selectedAgencySubdistricts, subdistrict]
                                  : selectedAgencySubdistricts.filter((s) => s !== subdistrict);
                                setSelectedAgencySubdistricts(updatedSubdistricts);
                                
                                // Dispatch event to show/hide subdistrict preview on map
                                if (checked) {
                                  try {
                                    // Get the subdistrict boundary data
                                    const subdistrictFeature = await getSubdistrictBoundary(subdistrict);
                                    if (subdistrictFeature) {
                                      const event = new CustomEvent('subdistrict-preview-show', {
                                        detail: { name: subdistrict, feature: subdistrictFeature }
                                      });
                                      window.dispatchEvent(event);
                                    }
                                  } catch (error) {
                                    console.error(`Error getting boundary for subdistrict ${subdistrict}:`, error);
                                  }
                                } else {
                                  const event = new CustomEvent('subdistrict-preview-hide', {
                                    detail: { name: subdistrict }
                                  });
                                  window.dispatchEvent(event);
                                }
                              }}
                            />
                            <Label
                              htmlFor={`subdistrict-${subdistrict}`}
                              className="text-sm font-medium"
                            >
                              {subdistrict}
                            </Label>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-gray-500">
                      {subdistrictSearchQuery ? "No subdistricts found matching your search" : "Loading subdistricts..."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="draw" className="space-y-4">
        <div className="space-y-4">
          {drawnPolygons.length > 0 ? (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <p className="text-blue-800 text-sm font-medium">Drawn Areas ({drawnPolygons.length})</p>
                </div>
              </div>
              
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                {drawnPolygons.map((polygon) => {
                  // Calculate a human-readable description of the polygon
                  const boundingBox = polygon.boundingBox;
                  const description = boundingBox ? 
                    `Area: SW(${boundingBox.southwest[0].toFixed(4)}, ${boundingBox.southwest[1].toFixed(4)}) - NE(${boundingBox.northeast[0].toFixed(4)}, ${boundingBox.northeast[1].toFixed(4)})` :
                    `Polygon with ${polygon.coordinates[0].length} points`;
                    
                  return (
                    <div 
                      key={polygon.featureId}
                      className={`p-2 mb-1 rounded-md cursor-pointer ${selectedPolygonId === polygon.featureId ? 'bg-blue-100 border border-blue-300' : 'hover:bg-gray-100'}`}
                      onClick={() => setSelectedPolygonId(polygon.featureId)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium">Drawn {polygon.type}</div>
                          <div className="text-xs text-gray-500">{description}</div>
                        </div>
                        {selectedPolygonId === polygon.featureId && (
                          <div className="bg-blue-500 rounded-full w-2 h-2"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-amber-800 text-sm">Draw a polygon on the map to define a custom area.</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant={drawMode === "polygon" ? "default" : "outline"}
              onClick={() => {
                const newMode = drawMode === "polygon" ? null : "polygon";
                setDrawMode(newMode);
                
                // Dispatch custom event to notify MapView component
                const event = new CustomEvent('location-draw-mode-change', {
                  detail: { mode: newMode }
                });
                window.dispatchEvent(event);
              }}
              className="flex-1"
            >
              <Pencil className="mr-2 h-4 w-4" />
              {drawMode === "polygon" ? "Cancel Drawing" : "Draw Polygon"}
            </Button>
          </div>
        </div>
      </TabsContent>

            </Tabs>
            
            {/* Global Add Selection and Clear All Buttons */}
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    // Check if we have a drawn polygon selected
                    if (activeTab === 'draw' && selectedPolygonId) {
                      // Add the selected polygon to selections
                      const selectedPolygon = drawnPolygons.find(p => p.featureId === selectedPolygonId);
                      if (selectedPolygon) {
                        const newSelection: LocationSelection = {
                          type: "polygon",
                          selection: selectedPolygon,
                          operator: "AND"
                        };
                        onSelectionsChange?.([...selections, newSelection]);
                        // Clear selection after adding
                        setSelectedPolygonId(null);
                        return; // Exit early since we've handled the drawn polygon case
                      }
                    }
                    
                    // Check if we have both Road and Political Subdivision selections
                    console.log('Active Tab:', activeTab);
                    console.log('Selected Roads:', selectedRoads);
                    console.log('Selected Cities:', selectedCities);
                    console.log('Selected Counties:', selectedCounties);
                    
                    // The issue might be that we're checking if the active tab is 'road' or 'city'
                    // But we should be checking if there are selections in both categories regardless of active tab
                    const hasRoadSelections = selectedRoads.length > 0;
                    const hasCitySelections = selectedCities.length > 0;
                    const hasCountySelections = selectedCounties.length > 0;
                    const hasDistrictSelections = selectedAgencyDistricts.length > 0;
                    const hasSubdistrictSelections = selectedAgencySubdistricts.length > 0;
                    const hasPoliticalSubdivisions = hasCitySelections || hasCountySelections;
                    const hasAgencyDistricts = hasDistrictSelections || hasSubdistrictSelections;
                  
                    console.log('Has Road Selections:', hasRoadSelections);
                    console.log('Has Political Subdivisions:', hasPoliticalSubdivisions);
                    console.log('Has Agency Districts:', hasAgencyDistricts);
                  
                    // If we have both Road and either Political Subdivision or Agency District selections, show the intersection dialog
                    if (hasRoadSelections && (hasPoliticalSubdivisions || hasAgencyDistricts)) {
                    console.log('Road selections with political subdivisions or agency districts detected, showing dialog');
                    // Store the pending selections
                    setPendingRoadSelections([...selectedRoads]);
                    
                    // Store the pending political subdivisions
                    const pendingSubdivisions = [];
                    
                    // Process city selections
                    if (selectedCities.length > 0) {
                      for (const city of selectedCities) {
                        try {
                          const cityFeature = await getCityBoundary(city);
                          if (cityFeature) {
                            pendingSubdivisions.push({
                              name: city,
                              type: 'city' as 'city' | 'county',
                              feature: cityFeature
                            });
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for city ${city}:`, error);
                        }
                      }
                    }
                    
                    // Process county selections
                    if (selectedCounties.length > 0) {
                      for (const county of selectedCounties) {
                        try {
                          const countyFeature = await getCountyBoundary(county);
                          if (countyFeature) {
                            pendingSubdivisions.push({
                              name: county,
                              type: 'county' as 'city' | 'county',
                              feature: countyFeature
                            });
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for county ${county}:`, error);
                        }
                      }
                    }
                    
                    // Process district selections
                    if (selectedAgencyDistricts.length > 0) {
                      for (const district of selectedAgencyDistricts) {
                        try {
                          const districtFeature = await getDistrictBoundary(district);
                          if (districtFeature) {
                            pendingSubdivisions.push({
                              name: district,
                              type: 'district' as 'city' | 'county' | 'district' | 'subdistrict',
                              feature: districtFeature
                            });
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for district ${district}:`, error);
                        }
                      }
                    }
                    
                    // Process subdistrict selections
                    if (selectedAgencySubdistricts.length > 0) {
                      for (const subdistrict of selectedAgencySubdistricts) {
                        try {
                          const subdistrictFeature = await getSubdistrictBoundary(subdistrict);
                          if (subdistrictFeature) {
                            pendingSubdivisions.push({
                              name: subdistrict,
                              type: 'subdistrict' as 'city' | 'county' | 'district' | 'subdistrict',
                              feature: subdistrictFeature
                            });
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for subdistrict ${subdistrict}:`, error);
                        }
                      }
                    }
                    
                    // Set the pending political subdivisions
                    setPendingPoliticalSubdivisions(pendingSubdivisions);
                    
                    // Show the intersection dialog
                    setShowIntersectionDialog(true);
                    
                    // Clear the selected items
                    setSelectedRoads?.([]);
                    onSelectedRoadsChange?.([]);
                    setSelectedCities?.([]);
                    setSelectedCounties?.([]);
                    setSelectedAgencyDistricts([]);
                    setSelectedAgencySubdistricts([]);
                    console.log('Cleared all selections');
                    
                    return;
                  }
                  
                  // Handle POI selections
                  if (activeTab === "points-of-interest" && selectedPointsOfInterest.length > 0) {
                    const newSelections: LocationSelection[] = selectedPointsOfInterest.map((poi) => ({
                      type: "city",
                      selection: poi,
                      operator: "AND",
                      poiRadius: poiRadiusValues[poi] || 0 // Include the radius information for this specific POI
                    }));
                    
                    // Update selections state
                    onSelectionsChange?.([...selections, ...newSelections]);
                    
                    // For each POI, get coordinates and dispatch event to map
                    for (const poi of selectedPointsOfInterest) {
                      try {
                        const coordinates = await getPOICoordinates(poi);
                        if (coordinates) {
                          // Dispatch event for map to add marker with radius
                          const event = new CustomEvent('poi-selection-added', {
                            detail: {
                              name: poi,
                              coordinates,
                              type: 'poi',
                              radius: poiRadiusValues[poi] || 0 // Include the radius in miles for this specific POI
                            }
                          });
                          window.dispatchEvent(event);
                        }
                      } catch (error) {
                        console.error(`Error getting coordinates for POI ${poi}:`, error);
                      }
                    }
                    
                    // Clear the selected POIs after adding
                    onSelectedPointsOfInterestChange?.([]);
                  }
                  
                  // Handle Political Subdivisions selections (both City and County)
                  else if (activeTab === "city") {
                    const newSelections: LocationSelection[] = [];
                    
                    // Handle city selections
                    if (selectedCities.length > 0) {
                      const citySelections = selectedCities.map((city) => ({
                        type: "city" as LocationSelectionType,
                        selection: city,
                        operator: "AND" as "AND" | "OR"
                      }));
                      newSelections.push(...citySelections);
                      
                      // For each city, get boundary and dispatch event to map
                      for (const city of selectedCities) {
                        try {
                          // Get the city boundary from GeoJSON
                          const cityFeature = await getCityBoundary(city);
                          if (cityFeature) {
                            // Dispatch event for map to add city boundary
                            const event = new CustomEvent('city-boundary-added', {
                              detail: {
                                name: city,
                                feature: cityFeature,
                                type: 'city'
                              }
                            });
                            window.dispatchEvent(event);
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for city ${city}:`, error);
                        }
                      }
                      
                      // Clear the selected cities after adding
                      setSelectedCities([]);
                    }
                    
                    // Handle county selections
                    if (selectedCounties.length > 0) {
                      const countySelections = selectedCounties.map((county) => ({
                        type: "county" as LocationSelectionType, // Using county type for counties
                        selection: county,
                        operator: "AND" as "AND" | "OR"
                      }));
                      newSelections.push(...countySelections);
                      
                      // For each county, get boundary and dispatch event to map
                      for (const county of selectedCounties) {
                        try {
                          // Get the county boundary from GeoJSON
                          const countyFeature = await getCountyBoundary(county);
                          if (countyFeature) {
                            // Dispatch event for map to add county boundary
                            const event = new CustomEvent('county-boundary-added', {
                              detail: {
                                name: county,
                                feature: countyFeature,
                                type: 'county'
                              }
                            });
                            window.dispatchEvent(event);
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for county ${county}:`, error);
                        }
                      }
                      
                      // Clear the selected counties after adding
                      setSelectedCounties([]);
                    }
                    
                    // Update selections state
                    onSelectionsChange?.([...selections, ...newSelections]);
                    
                    // Clear the selected items
                    setSelectedCities?.([]);
                    setSelectedCounties?.([]);
                  }
                  
                  else if (activeTab === "agency-districts") {
                    const newSelections: LocationSelection[] = [];
                    
                    // Handle district selections
                    if (selectedAgencyDistricts.length > 0) {
                      const districtSelections = selectedAgencyDistricts.map((district) => ({
                        type: "district" as LocationSelectionType,
                        selection: district,
                        operator: "AND" as "AND" | "OR"
                      }));
                      newSelections.push(...districtSelections);
                      
                      // For each district, get boundary and dispatch event to map
                      for (const district of selectedAgencyDistricts) {
                        try {
                          // Get the district boundary from GeoJSON
                          const districtFeature = await getDistrictBoundary(district);
                          if (districtFeature) {
                            // Dispatch event for map to add district boundary
                            const event = new CustomEvent('district-boundary-added', {
                              detail: {
                                name: district,
                                feature: districtFeature,
                                type: 'district',
                              }
                            });
                            window.dispatchEvent(event);
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for district ${district}:`, error);
                        }
                      }
                    }
                    
                    // Handle subdistrict selections
                    if (selectedAgencySubdistricts.length > 0) {
                      const subdistrictSelections = selectedAgencySubdistricts.map((subdistrict) => ({
                        type: "subdistrict" as LocationSelectionType,
                        selection: subdistrict,
                        operator: "AND" as "AND" | "OR"
                      }));
                      newSelections.push(...subdistrictSelections);
                      
                      // For each subdistrict, get boundary and dispatch event to map
                      for (const subdistrict of selectedAgencySubdistricts) {
                        try {
                          // Get the subdistrict boundary from GeoJSON
                          const subdistrictFeature = await getSubdistrictBoundary(subdistrict);
                          if (subdistrictFeature) {
                            // Dispatch event for map to add subdistrict boundary
                            const event = new CustomEvent('subdistrict-boundary-added', {
                              detail: {
                                name: subdistrict,
                                feature: subdistrictFeature,
                                type: 'subdistrict',
                              }
                            });
                            window.dispatchEvent(event);
                          }
                        } catch (error) {
                          console.error(`Error getting boundary for subdistrict ${subdistrict}:`, error);
                        }
                      }
                    }
                    
                    // Update selections state
                    onSelectionsChange?.([...selections, ...newSelections]);
                    
                    // Clear the selected items
                    setSelectedAgencyDistricts([]);
                    setSelectedAgencySubdistricts([]);
                  }
                                    // Handle Road selections
                  else if (activeTab === "road" && selectedRoads.length > 0) {
                    // Add each road as its own selection
                    const newSelections: LocationSelection[] = selectedRoads.map((road) => ({
                      type: "road",
                      selection: road,
                      operator: "AND"
                    }));
                    
                    // Update selections state
                    onSelectionsChange?.([...selections, ...newSelections]);
                    
                    // For each road, get coordinates and dispatch event to map
                    for (const road of selectedRoads) {
                      try {
                        const coordinates = await getRoadCoordinates(road);
                        if (coordinates) {
                          // Dispatch event for map to add road line
                          const event = new CustomEvent('road-selection-added', {
                            detail: {
                              name: road,
                              coordinates,
                              type: 'road'
                            }
                          });
                          window.dispatchEvent(event);
                        }
                      } catch (error) {
                        console.error(`Error getting coordinates for road ${road}:`, error);
                      }
                    }
                    
                    // Clear the selected roads after adding
                    // Make sure to call both the setter and the onChange callback
                    setSelectedRoads?.([]);
                    onSelectedRoadsChange?.([]);
                  }
                }} 
                disabled={(activeTab === "points-of-interest" && selectedPointsOfInterest.length === 0) || 
                          (activeTab === "road" && selectedRoads.length === 0) ||
                          (activeTab === "city" && selectedCities.length === 0 && selectedCounties.length === 0) ||
                          (activeTab === "agency-districts" && selectedAgencyDistricts.length === 0 && selectedAgencySubdistricts.length === 0)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              >
                Add Selection
              </Button>
              
              <Button 
                onClick={() => setShowClearConfirmation(true)} 
                disabled={selections.length === 0}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Clear All
              </Button>
              </div>
              
              {/* Confirmation Dialog for Clear Selections */}
              {showClearConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h3 className="text-lg font-semibold mb-4">Confirm Clear All Selections</h3>
                    <p className="mb-6">Are you sure you want to clear all {selections.length} selection(s) from the map?</p>
                    <div className="flex justify-end gap-2">
                      <Button 
                        onClick={() => setShowClearConfirmation(false)} 
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={clearAllSelections} 
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Draw functionality moved to its own tab */}
        </div>
      </div>
      
      {/* Intersection Dialog */}
      <IntersectionDialog 
        isOpen={showIntersectionDialog}
        onIntersect={handleIntersection}
        onKeepSeparate={handleKeepSeparate}
        onClose={() => setShowIntersectionDialog(false)}
        roadSelection={pendingRoadSelections}
        politicalSubdivisions={pendingPoliticalSubdivisions}
      />
      
      {/* No Intersection Alert */}
      <NoIntersectionAlert
        isOpen={showNoIntersectionAlert}
        onClose={() => setShowNoIntersectionAlert(false)}
        roadName={noIntersectionInfo.roadName}
        subdivisionName={noIntersectionInfo.subdivisionName}
      />
      
      {/* No Results Alert */}
      {intersectionNoResults && (
        <div className="p-4 mt-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">No intersection found between the selected road and political subdivision.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => setIntersectionNoResults(false)}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  )
}
