"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { getBasePath } from "@/utils/path-utils"
import { useRouter } from "next/router"
import { useToast } from "@/components/ui/use-toast"
import * as turf from "@turf/turf"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { AlertCircle, ChevronDown, ChevronUp, X, Search, Pencil, Circle, Plus } from "lucide-react"

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

// Define the types of location selections
type LocationSelectionType = "road" | "city" | "district" | "subdistrict" | "polygon" | "county" | "poi" | "intersection"


// Define the interface for location selections
interface LocationSelection {
  type: LocationSelectionType
  selection: string | string[] | PolygonCoordinates
  operator: "AND" | "OR"
  mileMarkerRange?: MileMarkerRange
  poiRadius?: number // Radius in miles for Points of Interest
  coordinates?: number[][] // Coordinates for intersections and other geometries
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
  
  // Get toast function from useToast hook
  const { toast } = useToast()
  
  // State for confirmation dialogs
  const [showAddConfirmation, setShowAddConfirmation] = useState<boolean>(false)
  const [showClearConfirmation, setShowClearConfirmation] = useState<boolean>(false)
  const [agencySubdistricts, setAgencySubdistricts] = useState<string[]>([])
  const [districtSearchQuery, setDistrictSearchQuery] = useState('')
  const [subdistrictSearchQuery, setSubdistrictSearchQuery] = useState('')
  const [selectedAgencyDistricts, setSelectedAgencyDistricts] = useState<string[]>([])
  const [selectedAgencySubdistricts, setSelectedAgencySubdistricts] = useState<string[]>([])
  const [agencyDistrictTab, setAgencyDistrictTab] = useState<'district' | 'subdistrict'>('district')
  
  // State for intersection popup
  const [showIntersectionPopup, setShowIntersectionPopup] = useState<boolean>(false)
  const [intersectionType, setIntersectionType] = useState<'road-city' | 'road-district' | null>(null)
  const [intersectionItems, setIntersectionItems] = useState<{road: string, entity: string}>({
    road: '',
    entity: ''
  })
  
  // State to track active tab
  const [activeTab, setActiveTab] = useState<string>("points-of-interest")
  
  const [pendingRoadSelections] = useState<string[]>([])
  const [pendingPoliticalSubdivisions] = useState<{name: string, type: 'city' | 'county' | 'district' | 'subdistrict', feature: any}[]>([])
  
  // Fetch points of interest from GeoJSON file
  useEffect(() => {
    const fetchPointsOfInterest = async () => {
      try {
        const basePath = getBasePath();
        const response = await fetch(`${basePath}/geojson/point-of-interest-cleaned.geojson`)
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
        const basePath = getBasePath();
        const response = await fetch(`${basePath}/geojson/city-cleaned.geojson`);
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
        const basePath = getBasePath();
        const response = await fetch(`${basePath}/geojson/counties-cleaned.geojson`);
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
  
  // Listen for POI removal events from selections list
  useEffect(() => {
    const handlePoiRemoved = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const poiName = detail.name;
      
      if (poiName && selectedPointsOfInterest.includes(poiName)) {
        console.log('POI removed from selections, updating checkbox state:', poiName);
        // Update the selected POIs state to uncheck the checkbox
        const updatedPOIs = selectedPointsOfInterest.filter(p => p !== poiName);
        onSelectedPointsOfInterestChange?.(updatedPOIs);
      }
    };
    
    // Add event listener
    window.addEventListener('poi-removed', handlePoiRemoved);
    
    // Clean up
    return () => {
      window.removeEventListener('poi-removed', handlePoiRemoved);
    };
  }, [selectedPointsOfInterest, onSelectedPointsOfInterestChange]);
  
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
  
  // Debug selections state
  useEffect(() => {
    console.log('Current selections state:', selections);
    
    // Check for any intersection selections
    const intersectionSelections = selections.filter(s => s.type === 'intersection');
    if (intersectionSelections.length > 0) {
      console.log('Found intersection selections:', intersectionSelections);
    }
  }, [selections]);
  
  // Handle the case when no intersection is found
  useEffect(() => {
    const handleNoIntersectionFound = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { roadName, entityName, entityType } = customEvent.detail;
      
      console.log('No intersection found event received:', customEvent.detail);
      
      // Show a toast notification to the user
      toast({
        title: "No Intersection Found",
        description: `The selected road (${roadName}) and entity (${entityName}) don't overlap on the map. Please try a different combination.`,
        variant: "destructive",
        duration: 5000
      });
      
      // Clear all selections as if nothing happened
      if (onSelectionsChange) {
        console.log('Clearing all selections due to no intersection found');
        onSelectionsChange([]);
      }
      
      // Clear all UI checkboxes
      if (setSelectedRoads) setSelectedRoads([]);
      if (setSelectedCities) setSelectedCities([]);
      if (setSelectedCounties) setSelectedCounties([]);
      if (setSelectedAgencyDistricts) setSelectedAgencyDistricts([]);
      setSelectedAgencySubdistricts([]);
    };
    
    // Handle successful intersection calculation
    const handleIntersectionAdded = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, roadName, entityName, entityType } = customEvent.detail;
      
      console.log('Intersection added event received:', customEvent.detail);
      
      // Get the coordinates of the intersection from the map
      // We need to get the GeoJSON data from the map source
      const intersectionEvent = new CustomEvent('get-intersection-coordinates', {
        detail: { id }
      });
      
      // Request the coordinates from the map
      window.dispatchEvent(intersectionEvent);
      
      // Show a toast notification to the user
      toast({
        title: "Intersection Found",
        description: `Successfully found the intersection between ${roadName} and ${entityName}.`,
        duration: 3000
      });
    };
    
    // Handle receiving the intersection coordinates from the map
    const handleIntersectionCoordinates = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, coordinates, roadName, entityName } = customEvent.detail;
      
      console.log('Received intersection coordinates:', customEvent.detail);
      
      if (!coordinates || coordinates.length === 0) {
        console.error('No coordinates received for intersection');
        return;
      }
      
      // Find the intersection selection in the current selections
      const intersectionSelection = selections.find(s => 
        s.type === "intersection" && 
        typeof s.selection === 'string' && 
        s.selection === `${roadName} ∩ ${entityName}`
      );
      
      if (!intersectionSelection) {
        console.error('Could not find intersection selection to update');
        return;
      }
      
      // Update the intersection selection with the coordinates
      const updatedSelections = selections.map(s => {
        if (s.type === "intersection" && 
            typeof s.selection === 'string' && 
            s.selection === `${roadName} ∩ ${entityName}`) {
          // Add the coordinates to the selection
          return {
            ...s,
            coordinates: coordinates
          };
        }
        return s;
      });
      
      // Update the selections state
      onSelectionsChange?.(updatedSelections);
    };
    
    // Add event listeners
    window.addEventListener('intersection-not-found', handleNoIntersectionFound as EventListener);
    window.addEventListener('intersection-added', handleIntersectionAdded as EventListener);
    window.addEventListener('intersection-coordinates', handleIntersectionCoordinates as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('intersection-not-found', handleNoIntersectionFound as EventListener);
      window.removeEventListener('intersection-added', handleIntersectionAdded as EventListener);
      window.removeEventListener('intersection-coordinates', handleIntersectionCoordinates as EventListener);
    };
  }, [toast, onSelectionsChange, setSelectedRoads, setSelectedCities, setSelectedCounties, setSelectedAgencyDistricts]);
  
  // Handle polygon drawing events from the map
  useEffect(() => {
    const handlePolygonDrawn = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { featureId, coordinates, type, boundingBox } = customEvent.detail;
      
      console.log('Polygon drawn event received:', customEvent.detail);
      
      // Add the new polygon to the drawnPolygons state
      setDrawnPolygons(prev => [
        ...prev,
        {
          featureId,
          coordinates,
          type,
          boundingBox
        }
      ]);
      
      // Select the newly drawn polygon
      setSelectedPolygonId(featureId);
      
      // Show a toast notification
      toast({
        title: "Polygon Drawn",
        description: "Polygon has been drawn. You can now add it to your selections.",
        duration: 3000
      });
    };
    
    // Add event listener for polygon drawing
    window.addEventListener('location-polygon-drawn', handlePolygonDrawn as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('location-polygon-drawn', handlePolygonDrawn as EventListener);
    };
  }, [toast]);
  
  // Fetch roads from GeoJSON file
  useEffect(() => {
    const fetchRoads = async () => {
      setLoading(true); // Ensure loading state is true at the start
      try {
        console.log('Fetching roads...');
        const roadNames = await getAllRoadNames()
        console.log(`Loaded ${roadNames.length} roads`);
        setLocations(roadNames)
      } catch (error) {
        console.error('Error fetching roads:', error)
        // Fallback to empty array if fetch fails
        setLocations([])
      } finally {
        // Set loading to false regardless of success or failure
        setLoading(false);
      }
    }
    
    fetchRoads()
  }, [])
  
  // Remove the global mileMarkerRange state as we'll use per-road ranges
  const [drawMode, setDrawMode] = useState<"polygon" | "circle" | null>(null)
  const [searchRoad, setSearchRoad] = useState("")
  // const [searchLocation, setSearchLocation] = useState("")
  const [searchDistrict, setSearchDistrict] = useState("")
  // const [searchPOI, setSearchPOI] = useState("")
  
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

// Filter functions using the GeoJSON data for roads
  const filteredRoads = locations.filter(road => 
    road.toLowerCase().includes(searchRoad.toLowerCase())
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


  const toggleAllDistricts = () => {
    const updatedDistricts = selectedDistricts.length === locationData.district.length ? [] : [...locationData.district];
    // Add implementation if needed
  }
  
  // Function to determine if a tab should be disabled
  const isTabDisabled = (tabName: string) => {
    // If drawing mode is active, disable all tabs except the draw tab
    if (drawMode) {
      return tabName !== 'draw';
    }
    
    // If there are no selections, all tabs are enabled
    if (selections.length === 0) return false;
    
    // If there are selections, check if they include the current tab type
    const hasSelectionOfType = (type: string) => selections.some(s => s.type === type);
    
    // If there are road selections, only the road tab is enabled
    if (hasSelectionOfType('road')) {
      // Road tab is always enabled if there are road selections
      if (tabName === 'road') return false;
      
      // Political subdivisions tab is enabled if there are road selections
      if (tabName === 'city') return false;
      
      // Agency districts tab is enabled if there are road selections
      if (tabName === 'agency-districts') return false;
      
      // All other tabs are disabled
      return true;
    }
    
    // If there are city or county selections, only the political subdivisions tab is enabled
    if (hasSelectionOfType('city') || hasSelectionOfType('county')) {
      // Political subdivisions tab is always enabled if there are city/county selections
      if (tabName === 'city') return false;
      
      // Road tab is enabled if there are city/county selections
      if (tabName === 'road') return false;
      
      // All other tabs are disabled
      return true;
    }
    
    // If there are district or subdistrict selections, only the agency districts tab is enabled
    if (hasSelectionOfType('district') || hasSelectionOfType('subdistrict')) {
      // Agency districts tab is always enabled if there are district/subdistrict selections
      if (tabName === 'agency-districts') return false;
      
      // Road tab is enabled if there are district/subdistrict selections
      if (tabName === 'road') return false;
      
      // All other tabs are disabled
      return true;
    }
    
    // If there are POI selections, only the POI tab is enabled
    if (hasSelectionOfType('poi')) {
      return tabName !== 'points-of-interest';
    }
    
    // If there are polygon selections, only the draw tab is enabled
    if (hasSelectionOfType('polygon')) {
      return tabName !== 'draw';
    }
    
    // Default: no tabs are disabled
    return false;
  };

  
  // Function to handle removing a selection
  const handleRemoveSelection = (index: number) => {
    if (index < 0 || index >= selections.length) {
      console.error('Invalid selection index:', index);
      return;
    }
    
    const selectionToRemove = selections[index];
    console.log('Removing selection:', selectionToRemove);
    
    // Create a new array without the removed selection
    const updatedSelections = [...selections];
    updatedSelections.splice(index, 1);
    
    // Update the selections state
    onSelectionsChange?.(updatedSelections);
    
    // Handle different selection types
    if (selectionToRemove.type === 'road') {
      const roadName = selectionToRemove.selection as string;
      console.log('Removing road selection:', roadName);
      
      // Dispatch road-specific removal event
      const roadEvent = new CustomEvent('road-selection-removed', {
        detail: {
          type: 'road',
          selection: roadName,
          name: roadName,
          fullSelection: selectionToRemove
        }
      });
      window.dispatchEvent(roadEvent);
      console.log('Dispatched road-selection-removed event for:', roadName);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'road',
          selection: roadName,
          name: roadName
        }
      });
      window.dispatchEvent(selectionEvent);
      console.log('Dispatched selection-removed event for:', roadName);
      
      // Finally dispatch a direct layer removal event with the exact layer ID
      const layerEvent = new CustomEvent('remove-map-layer', {
        detail: {
          layerId: `road-layer-${roadName}`,
          sourceId: `road-source-${roadName}`
        }
      });
      window.dispatchEvent(layerEvent);
      console.log('Dispatched remove-map-layer event for:', `road-layer-${roadName}`);
    } 

    else if (selectionToRemove.type === 'polygon') {
      // Handle polygon removal
      const polygonData = selectionToRemove.selection as PolygonCoordinates;
      console.log('Removing polygon selection:', polygonData.featureId);
      
      // Remove the polygon from drawnPolygons state
      setDrawnPolygons(prev => prev.filter(p => p.featureId !== polygonData.featureId));
      
      // Clear the selected polygon ID if it matches the removed polygon
      if (selectedPolygonId === polygonData.featureId) {
        setSelectedPolygonId(null);
      }
      
      // Check if this was the last polygon selection
      const remainingPolygonSelections = updatedSelections.filter(s => s.type === 'polygon');
      if (remainingPolygonSelections.length === 0) {
        // If no more polygon selections, reset draw mode to ensure other tabs are enabled
        setDrawMode(null);
      }
      
      // Dispatch polygon-specific removal event
      const polygonEvent = new CustomEvent('polygon-removed', {
        detail: {
          polygonId: polygonData.featureId,
          fullSelection: selectionToRemove
        }
      });
      window.dispatchEvent(polygonEvent);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'polygon',
          selection: polygonData,
          name: polygonData.name || 'Custom Area'
        }
      });
      window.dispatchEvent(selectionEvent);
      
      // Show a toast notification
      toast({
        title: "Polygon Removed",
        description: "The drawn polygon has been removed from your selections and the map.",
        duration: 3000
      });
    } 
    else if (selectionToRemove.type === 'city') {
      // Handle city boundary removal
      const cityName = selectionToRemove.selection as string;
      console.log('Removing city selection:', cityName);
      
      // Update selectedCities state to show the checkbox as unchecked
      setSelectedCities(prev => prev.filter(c => c !== cityName));
      
      // Dispatch city-specific removal event
      const cityEvent = new CustomEvent('city-boundary-removed', {
        detail: { name: cityName }
      });
      window.dispatchEvent(cityEvent);
      console.log('Dispatched city-boundary-removed event for:', cityName);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'city',
          selection: cityName,
          name: cityName
        }
      });
      window.dispatchEvent(selectionEvent);
    }
    else if (selectionToRemove.type === 'county') {
      // Handle county boundary removal
      const countyName = selectionToRemove.selection as string;
      console.log('Removing county selection:', countyName);
      
      // Update selectedCounties state to show the checkbox as unchecked
      setSelectedCounties(prev => prev.filter(c => c !== countyName));
      
      // Dispatch county-specific removal event
      const countyEvent = new CustomEvent('county-boundary-removed', {
        detail: { name: countyName }
      });
      window.dispatchEvent(countyEvent);
      console.log('Dispatched county-boundary-removed event for:', countyName);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'county',
          selection: countyName,
          name: countyName
        }
      });
      window.dispatchEvent(selectionEvent);
    }
    else if (selectionToRemove.type === 'district') {
      // Handle district boundary removal
      const districtName = selectionToRemove.selection as string;
      console.log('Removing district selection:', districtName);
      
      // Update selectedAgencyDistricts state to show the checkbox as unchecked
      setSelectedAgencyDistricts(prev => prev.filter(d => d !== districtName));
      
      // Dispatch district-specific removal event
      const districtEvent = new CustomEvent('district-boundary-removed', {
        detail: { name: districtName }
      });
      window.dispatchEvent(districtEvent);
      console.log('Dispatched district-boundary-removed event for:', districtName);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'district',
          selection: districtName,
          name: districtName
        }
      });
      window.dispatchEvent(selectionEvent);
    }
    else if (selectionToRemove.type === 'subdistrict') {
      // Handle subdistrict boundary removal
      const subdistrictName = selectionToRemove.selection as string;
      console.log('Removing subdistrict selection:', subdistrictName);
      
      // Update selectedAgencySubdistricts state if it exists
      if (typeof setSelectedAgencySubdistricts === 'function') {
        setSelectedAgencySubdistricts(prev => prev.filter(s => s !== subdistrictName));
      }
      
      // Dispatch subdistrict-specific removal event
      const subdistrictEvent = new CustomEvent('subdistrict-boundary-removed', {
        detail: { name: subdistrictName }
      });
      window.dispatchEvent(subdistrictEvent);
      console.log('Dispatched subdistrict-boundary-removed event for:', subdistrictName);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'subdistrict',
          selection: subdistrictName,
          name: subdistrictName
        }
      });
      window.dispatchEvent(selectionEvent);
    }
    else if (selectionToRemove.type === 'intersection') {
      // Handle intersection removal
      const intersectionName = selectionToRemove.selection as string;
      console.log('Removing intersection selection:', intersectionName);
      
      // Extract road and entity names from the intersection name
      // Format is typically "Road I-65 ∩ Entity Name"
      const parts = intersectionName.split(' ∩ ');
      if (parts.length === 2) {
        const roadName = parts[0].trim();
        const entityName = parts[1].trim();
        
        // Create a unique ID for the intersection based on the names
        const intersectionId = `intersection-${roadName.replace(/\s+/g, '-')}-${entityName.replace(/\s+/g, '-')}`;
        
        // Dispatch intersection-specific removal event
        const intersectionEvent = new CustomEvent('intersection-removed', {
          detail: {
            id: intersectionId,
            roadName,
            entityName,
            name: intersectionName,
            fullSelection: selectionToRemove
          }
        });
        window.dispatchEvent(intersectionEvent);
        console.log('Dispatched intersection-removed event for:', intersectionId);
        
        // Also dispatch general selection-removed event
        const selectionEvent = new CustomEvent('selection-removed', {
          detail: {
            type: 'intersection',
            selection: intersectionName,
            name: intersectionName
          }
        });
        window.dispatchEvent(selectionEvent);
      } else {
        console.error('Invalid intersection name format:', intersectionName);
      }
    }
    else if (selectionToRemove.type === 'poi') {
      // Handle POI removal
      const poiName = selectionToRemove.selection as string;
      console.log('Removing POI selection:', poiName);
      
      // Update the selectedPointsOfInterest state to uncheck the checkbox
      if (selectedPointsOfInterest.includes(poiName)) {
        console.log('Updating checkbox state for POI:', poiName);
        const updatedPOIs = selectedPointsOfInterest.filter(p => p !== poiName);
        onSelectedPointsOfInterestChange?.(updatedPOIs);
        
        // If setSelectedPointsOfInterest is available, use it directly
        if (setSelectedPointsOfInterest) {
          setSelectedPointsOfInterest(updatedPOIs);
        }
      }
      
      // Dispatch POI-specific removal event
      const poiEvent = new CustomEvent('poi-selection-removed', {
        detail: {
          type: 'poi',
          selection: poiName,
          name: poiName,
          poiRadius: selectionToRemove.poiRadius || 0
        }
      });
      window.dispatchEvent(poiEvent);
      console.log('Dispatched poi-selection-removed event for:', poiName);
      
      // Also dispatch the poi-removed event for backward compatibility
      const poiRemovedEvent = new CustomEvent('poi-removed', {
        detail: {
          name: poiName
        }
      });
      window.dispatchEvent(poiRemovedEvent);
      
      // Also dispatch general selection-removed event
      const selectionEvent = new CustomEvent('selection-removed', {
        detail: {
          type: 'poi',
          selection: poiName,
          name: poiName
        }
      });
      window.dispatchEvent(selectionEvent);
    }
    else {
      // Generic handling for other selection types
      const selectionDisplayName = Array.isArray(selectionToRemove.selection) 
        ? selectionToRemove.selection.join('-') 
        : (typeof selectionToRemove.selection === 'string' ? selectionToRemove.selection : 'unknown');
      
      console.log(`Removing ${selectionToRemove.type} selection:`, selectionDisplayName);
      
      // Dispatch general selection-removed event
      const event = new CustomEvent('selection-removed', {
        detail: {
          type: selectionToRemove.type,
          selection: selectionToRemove.selection,
          name: selectionDisplayName
        }
      });
      window.dispatchEvent(event);
      console.log(`Dispatched selection-removed event for ${selectionToRemove.type}:`, selectionDisplayName);
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
                console.log(`Rendering selection ${index}:`, selection);
                let content = "";
                
                switch (selection.type) {
                  case "polygon":
                    // Handle polygon selection
                    const polygonData = selection.selection as PolygonCoordinates;
                    
                      // Fallback to the old behavior for other polygon types
                      const boundingBox = polygonData.boundingBox;
                      content = boundingBox ? 
                        `Custom Area: SW(${boundingBox.southwest[0].toFixed(4)}, ${boundingBox.southwest[1].toFixed(4)}) - NE(${boundingBox.northeast[0].toFixed(4)}, ${boundingBox.northeast[1].toFixed(4)})` :
                        `Custom ${polygonData.type} Area`;
                    
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
                    content = `PoI: ${selection.selection as string}`;
                    // Add radius information if available
                    if (selection.poiRadius !== undefined && selection.poiRadius > 0) {
                      content += ` (${selection.poiRadius} mi radius)`;
                    }
                    break;
                  case "city":
                    if (Array.isArray(selection.selection)) {
                      content = `Cities: ${selection.selection.join(" | ")}`;
                    } else {
                      // Check for legacy POI (city with poiRadius)
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
                  case "intersection":
                    // Handle intersection selection
                    if (Array.isArray(selection.selection)) {
                      content = `Intersection: ${selection.selection.join(" | ")}`;
                    } else {
                      // Display the intersection name directly without any prefix
                      // This ensures the format "I-65 ∩ Fort Wayne" is displayed as is
                      const intersectionStr = selection.selection as string;
                      console.log('Rendering intersection string:', intersectionStr);
                      content = intersectionStr;
                      
                      // If the content is empty, create a fallback display
                      if (!content || content.trim() === '') {
                        // Try to extract information from the selection object
                        const selectionObj = JSON.stringify(selection);
                        console.log('Selection object for debugging:', selectionObj);
                        content = 'Road ∩ District Intersection';
                      }
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
                  disabled={isTabDisabled('points-of-interest')}
                >
                  <span>Points of Interest</span>
                  {(selectedPointsOfInterest.length > 0 || selections.some(s => s.type === "poi" || (s.type === "city" && typeof s.selection === "string" && s.poiRadius !== undefined))) && (
                    <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="road" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={isTabDisabled('road')}
                >
                  <span>Road</span>
                  {(selectedRoads.length > 0 || pendingRoadSelections.length > 0 || selections.some(s => s.type === "road")) && (
                    <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="city" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={isTabDisabled('city')}
                >
                  <span>Political Subdivisions</span>
                  {(selectedCities.length > 0 || selectedCounties.length > 0 || 
                    (pendingPoliticalSubdivisions.filter(s => s.type === "city" || s.type === "county").length > 0) || 
                    selections.some(s => (s.type === "city" || s.type === "county") && 
                                         s.poiRadius === undefined)) && (
                    <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="agency-districts" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={isTabDisabled('agency-districts')}
                >
                  <span>Agency Defined Districts</span>
                  {(selectedAgencyDistricts.length > 0 || selectedAgencySubdistricts.length > 0 || 
                    pendingPoliticalSubdivisions.some(s => s.type === "district" || s.type === "subdistrict") ||
                    selections.some(s => s.type === "district" || s.type === "subdistrict")) && (
                    <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="draw" 
                  className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center"
                  disabled={isTabDisabled('draw')}
                >
                  <span>Draw on Map</span>
                  {(drawnPolygons.length > 0 || selections.some(s => s.type === "polygon" && typeof s.selection === 'object' && 'type' in s.selection)) && (
                    <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full"></span>
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
              placeholder="Search 232 roads..."
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
                          checked={selectedRoads.includes(road) || selections.some(s => s.type === "road" && s.selection === road)}
                          onCheckedChange={async (checked) => {
                            if (checked) {
                              try {
                                // Get the road coordinates using the service function
                                const coordinates = await getRoadCoordinates(road);
                                if (coordinates) {
                                  // Initialize mile marker range
                                  const updatedRanges = { 
                                    ...roadMileMarkerRanges, 
                                    [road]: { min: 0, max: 500 } 
                                  };
                                  setRoadMileMarkerRanges?.(updatedRanges);
                                  onRoadMileMarkerRangesChange?.(updatedRanges);
                                  
                                  // Add the road directly to selections
                                  const newSelection: LocationSelection = {
                                    type: "road",
                                    selection: road,
                                    operator: "AND",
                                    mileMarkerRange: { min: 0, max: 500 }
                                  };
                                  
                                  // Check if there are any city, county, or district selections
                                  const hasCitySelections = selections.some(s => s.type === "city");
                                  const hasCountySelections = selections.some(s => s.type === "county");
                                  const hasDistrictSelections = selections.some(s => s.type === "district" || s.type === "subdistrict");
                                  
                                  if (hasCitySelections) {
                                    // Find the first city selection
                                    const citySelection = selections.find(s => s.type === "city");
                                    const cityName = citySelection ? 
                                      (Array.isArray(citySelection.selection) ? citySelection.selection[0] : citySelection.selection as string) : 
                                      'city';
                                    
                                    // Show intersection popup for road-city
                                    setIntersectionType('road-city');
                                    setIntersectionItems({
                                      road: road,
                                      entity: cityName
                                    });
                                    setShowIntersectionPopup(true);
                                  } else if (hasCountySelections) {
                                    // Find the first county selection
                                    const countySelection = selections.find(s => s.type === "county");
                                    const countyName = countySelection ? 
                                      (Array.isArray(countySelection.selection) ? countySelection.selection[0] : countySelection.selection as string) : 
                                      'county';
                                    
                                    // Show intersection popup for road-city (using the same type as city since it's a political subdivision)
                                    setIntersectionType('road-city');
                                    setIntersectionItems({
                                      road: road,
                                      entity: countyName
                                    });
                                    setShowIntersectionPopup(true);
                                  } else if (hasDistrictSelections) {
                                    // Find the first district selection
                                    const districtSelection = selections.find(s => s.type === "district" || s.type === "subdistrict");
                                    const districtName = districtSelection ? 
                                      (Array.isArray(districtSelection.selection) ? districtSelection.selection[0] : districtSelection.selection as string) : 
                                      'district';
                                    
                                    // Show intersection popup for road-district
                                    setIntersectionType('road-district');
                                    setIntersectionItems({
                                      road: road,
                                      entity: districtName
                                    });
                                    setShowIntersectionPopup(true);
                                  }
                                  
                                  // Update selections state
                                  onSelectionsChange?.([...selections, newSelection]);
                                  
                                  // Dispatch event for map to add road line
                                  const event = new CustomEvent('road-selection-added', {
                                    detail: {
                                      name: road,
                                      coordinates,
                                      type: 'road'
                                    }
                                  });
                                  window.dispatchEvent(event);
                                  
                                  // Show mile marker range selector
                                  const rangeSelector = document.getElementById(`range-selector-${road}`);
                                  if (rangeSelector) {
                                    rangeSelector.style.display = 'block';
                                  }
                                }
                              } catch (error) {
                                console.error(`Error getting coordinates for road ${road}:`, error);
                              }
                            } else {
                              // Remove the road from selections
                              const updatedSelections = selections.filter(s => 
                                !(s.type === "road" && s.selection === road)
                              );
                              onSelectionsChange?.(updatedSelections);
                              
                              // Dispatch multiple events to ensure road is properly removed
                              
                              // First, dispatch the road-specific event with complete information
                              const roadEvent = new CustomEvent('road-selection-removed', {
                                detail: {
                                  type: 'road',
                                  selection: road,
                                  name: road,
                                  fullSelection: {
                                    type: 'road',
                                    selection: road,
                                    operator: 'AND'
                                  }
                                }
                              });
                              window.dispatchEvent(roadEvent);
                              console.log('Dispatched road-selection-removed event for:', road);
                              
                              // Then dispatch the general selection-removed event
                              const selectionEvent = new CustomEvent('selection-removed', {
                                detail: {
                                  type: 'road',
                                  selection: road,
                                  name: road
                                }
                              });
                              window.dispatchEvent(selectionEvent);
                              console.log('Dispatched selection-removed event for:', road);
                              
                              // Finally dispatch a direct layer removal event with the exact layer ID
                              const layerEvent = new CustomEvent('remove-map-layer', {
                                detail: {
                                  layerId: `road-layer-${road}`,
                                  sourceId: `road-source-${road}`
                                }
                              });
                              window.dispatchEvent(layerEvent);
                              console.log('Dispatched remove-map-layer event for:', `road-layer-${road}`);
                              
                              // Hide mile marker range selector
                              const rangeSelector = document.getElementById(`range-selector-${road}`);
                              if (rangeSelector) {
                                rangeSelector.style.display = 'none';
                              }
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
                          onCheckedChange={async (checked) => {
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
                              
                              try {
                                // Get the POI coordinates using the service function
                                const coordinates = await getPOICoordinates(poi);
                                if (coordinates) {
                                  // Add the POI directly to selections
                                  const newSelection: LocationSelection = {
                                    type: "poi",
                                    selection: poi,
                                    operator: "AND",
                                    poiRadius: 0 // Initial radius
                                  };
                                  
                                  // Update selections state
                                  onSelectionsChange?.([...selections, newSelection]);
                                  
                                  // Dispatch event for map to add marker with radius
                                  const event = new CustomEvent('poi-selection-added', {
                                    detail: {
                                      name: poi,
                                      coordinates,
                                      type: 'poi',
                                      radius: 0 // Initial radius
                                    }
                                  });
                                  window.dispatchEvent(event);
                                }
                              } catch (error) {
                                console.error(`Error getting coordinates for POI ${poi}:`, error);
                              }
                            } else {
                              // Remove the POI from selections
                              const updatedSelections = selections.filter(s => 
                                !(s.type === "poi" && s.selection === poi)
                              );
                              onSelectionsChange?.(updatedSelections);
                              
                              // Remove radius value when deselecting a POI
                              const newRadiusValues = {...poiRadiusValues};
                              delete newRadiusValues[poi];
                              setPoiRadiusValues(newRadiusValues);
                              
                              // Dispatch event to remove POI from map
                              const event = new CustomEvent('poi-selection-removed', {
                                detail: { 
                                  type: 'poi',
                                  selection: poi,
                                  poiRadius: 0 // Include this for backward compatibility
                                }
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
                                  
                                  // Update the selection in the selections array with the new radius
                                  const updatedSelections = selections.map(s => {
                                    if (s.type === "poi" && s.selection === poi) {
                                      // Update this POI's radius
                                      return {
                                        ...s,
                                        poiRadius: value
                                      };
                                    }
                                    return s;
                                  });
                                  
                                  // Update the selections state
                                  onSelectionsChange?.(updatedSelections);
                                  
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
                                if (checked) {
                                  try {
                                    // Get the city boundary data
                                    const cityFeature = await getCityBoundary(city);
                                    if (cityFeature) {
                                      // Add the city directly to selections
                                      const newSelection: LocationSelection = {
                                        type: "city",
                                        selection: city,
                                        operator: "AND"
                                      };
                                      
                                      // Check if there are any road selections
                                      const hasRoadSelections = selections.some(s => s.type === "road");
                                      
                                      if (hasRoadSelections) {
                                        // Find the first road selection
                                        const roadSelection = selections.find(s => s.type === "road");
                                        const roadName = roadSelection ? 
                                          (Array.isArray(roadSelection.selection) ? roadSelection.selection[0] : roadSelection.selection as string) : 
                                          'road';
                                        
                                        // Show intersection popup for road-city
                                        setIntersectionType('road-city');
                                        setIntersectionItems({
                                          road: roadName,
                                          entity: city
                                        });
                                        setShowIntersectionPopup(true);
                                      }
                                      
                                      // Update selections state
                                      onSelectionsChange?.([...selections, newSelection]);
                                      
                                      // Update selectedCities state to show the checkbox as checked
                                      setSelectedCities(prev => [...prev, city]);
                                      
                                      
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
                                } else {
                                  // Remove the city from selections
                                  const updatedSelections = selections.filter(s => 
                                    !(s.type === "city" && s.selection === city && s.poiRadius === undefined)
                                  );
                                  onSelectionsChange?.(updatedSelections);
                                  
                                  // Update selectedCities state to show the checkbox as unchecked
                                  setSelectedCities(prev => prev.filter(c => c !== city));
                                  
                                  // Dispatch event to remove city from map
                                  const event = new CustomEvent('city-boundary-removed', {
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
                                if (checked) {
                                  try {
                                    // Get the county boundary data
                                    const countyFeature = await getCountyBoundary(county);
                                    if (countyFeature) {
                                      // Add the county directly to selections
                                      const newSelection: LocationSelection = {
                                        type: "county",
                                        selection: county,
                                        operator: "AND"
                                      };
                                      
                                      // Check if there are any road selections
                                      const hasRoadSelections = selections.some(s => s.type === "road");
                                      
                                      if (hasRoadSelections) {
                                        // Find the first road selection
                                        const roadSelection = selections.find(s => s.type === "road");
                                        const roadName = roadSelection ? 
                                          (Array.isArray(roadSelection.selection) ? roadSelection.selection[0] : roadSelection.selection as string) : 
                                          'road';
                                        
                                        // Show intersection popup for road-city (using the same type as city since it's a political subdivision)
                                        setIntersectionType('road-city');
                                        setIntersectionItems({
                                          road: roadName,
                                          entity: county
                                        });
                                        setShowIntersectionPopup(true);
                                      }
                                      
                                      // Update selections state
                                      onSelectionsChange?.([...selections, newSelection]);
                                      
                                      // Update selectedCounties state to show the checkbox as checked
                                      setSelectedCounties(prev => [...prev, county]);
                                    
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
                                } else {
                                  // Remove the county from selections
                                  const updatedSelections = selections.filter(s => 
                                    !(s.type === "county" && s.selection === county)
                                  );
                                  onSelectionsChange?.(updatedSelections);
                                  
                                  // Update selectedCounties state to show the checkbox as unchecked
                                  setSelectedCounties(prev => prev.filter(c => c !== county));
                                  
                                  // Dispatch event to remove county from map
                                  const event = new CustomEvent('county-boundary-removed', {
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
                                if (checked) {
                                  try {
                                    // Get the district boundary data
                                    const districtFeature = await getDistrictBoundary(district);
                                    if (districtFeature) {
                                      // Add the district directly to selections
                                      const newSelection: LocationSelection = {
                                        type: "district",
                                        selection: district,
                                        operator: "AND"
                                      };
                                      
                                      // Check if there are any road selections
                                      const hasRoadSelections = selections.some(s => s.type === "road");
                                      
                                      if (hasRoadSelections) {
                                        // Show intersection popup for road-district
                                        setIntersectionType('road-district');
                                        setShowIntersectionPopup(true);
                                      }
                                      
                                      // Update selections state
                                      onSelectionsChange?.([...selections, newSelection]);
                                      
                                      // Update selectedAgencyDistricts state to show the checkbox as checked
                                      setSelectedAgencyDistricts(prev => [...prev, district]);
                                      
                                      // Dispatch event for map to add district boundary
                                      const event = new CustomEvent('district-boundary-added', {
                                        detail: {
                                          name: district,
                                          feature: districtFeature,
                                          type: 'district'
                                        }
                                      });
                                      window.dispatchEvent(event);
                                    }
                                  } catch (error) {
                                    console.error(`Error getting boundary for district ${district}:`, error);
                                  }
                                } else {
                                  // Remove the district from selections
                                  const updatedSelections = selections.filter(s => 
                                    !(s.type === "district" && s.selection === district)
                                  );
                                  onSelectionsChange?.(updatedSelections);
                                  
                                  // Update selectedAgencyDistricts state to show the checkbox as unchecked
                                  setSelectedAgencyDistricts(prev => prev.filter(d => d !== district));
                                  
                                  // Dispatch event to remove district from map
                                  const event = new CustomEvent('district-boundary-removed', {
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
                                if (checked) {
                                  try {
                                    // Get the subdistrict boundary data
                                    const subdistrictFeature = await getSubdistrictBoundary(subdistrict);
                                    if (subdistrictFeature) {
                                      // Add the subdistrict directly to selections
                                      const newSelection: LocationSelection = {
                                        type: "subdistrict",
                                        selection: subdistrict,
                                        operator: "AND"
                                      };
                                      
                                      // Check if there are any road selections
                                      const hasRoadSelections = selections.some(s => s.type === "road");
                                      
                                      if (hasRoadSelections) {
                                        // Show intersection popup for road-district
                                        setIntersectionType('road-district');
                                        setShowIntersectionPopup(true);
                                      }
                                      
                                      // Update selections state
                                      onSelectionsChange?.([...selections, newSelection]);
                                      
                                      // Update selectedAgencySubdistricts state to show the checkbox as checked
                                      setSelectedAgencySubdistricts(prev => [...prev, subdistrict]);
                                      
                                      // Dispatch event for map to add subdistrict boundary
                                      const event = new CustomEvent('subdistrict-boundary-added', {
                                        detail: {
                                          name: subdistrict,
                                          feature: subdistrictFeature,
                                          type: 'subdistrict'
                                        }
                                      });
                                      window.dispatchEvent(event);
                                    }
                                  } catch (error) {
                                    console.error(`Error getting boundary for subdistrict ${subdistrict}:`, error);
                                  }
                                } else {
                                  // Remove the subdistrict from selections
                                  const updatedSelections = selections.filter(s => 
                                    !(s.type === "subdistrict" && s.selection === subdistrict)
                                  );
                                  onSelectionsChange?.(updatedSelections);
                                  
                                  // Update selectedAgencySubdistricts state to show the checkbox as unchecked
                                  setSelectedAgencySubdistricts(prev => prev.filter(s => s !== subdistrict));
                                  
                                  // Dispatch event to remove subdistrict from map
                                  const event = new CustomEvent('subdistrict-boundary-removed', {
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
                <div className="flex items-center justify-between">
                  <p className="text-blue-800 text-sm font-medium">Drawn Areas ({drawnPolygons.length})</p>
                  {selectedPolygonId && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-xs px-2 py-1 h-auto"
                      onClick={() => {
                        // Find the selected polygon
                        const selectedPolygon = drawnPolygons.find(p => p.featureId === selectedPolygonId);
                        if (selectedPolygon && onSelectionsChange) {
                          // Create a new selection for the polygon
                          const newSelection: LocationSelection = {
                            type: 'polygon',
                            selection: {
                              type: selectedPolygon.type,
                              coordinates: selectedPolygon.coordinates,
                              featureId: selectedPolygon.featureId,
                              boundingBox: selectedPolygon.boundingBox
                            },
                            operator: 'AND'
                          };
                          
                          // Add the new selection to the existing selections
                          onSelectionsChange([...selections, newSelection]);
                          
                          // Show a toast notification
                          toast({
                            title: "Polygon Added",
                            description: "The drawn polygon has been added to your selections.",
                            duration: 3000
                          });
                        }
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add to Selection
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="max-h-[200px] overflow-y-auto border rounded-md p-2">
                {drawnPolygons.map((polygon) => {
                  // Calculate a human-readable description of the polygon
                  const boundingBox = polygon.boundingBox;
                  const description = boundingBox ? 
                    `Area: SW(${boundingBox.southwest[0].toFixed(4)}, ${boundingBox.southwest[1].toFixed(4)}) - NE(${boundingBox.northeast[0].toFixed(4)}, ${boundingBox.northeast[1].toFixed(4)})` :
                    `Polygon with ${polygon.coordinates[0].length} points`;
                  
                  // Check if this polygon is already in selections
                  const isAlreadySelected = selections.some(s => 
                    s.type === 'polygon' && 
                    typeof s.selection === 'object' && 
                    'featureId' in s.selection && 
                    s.selection.featureId === polygon.featureId
                  );
                    
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
                          {isAlreadySelected && (
                            <div className="text-xs text-green-600 mt-1">Added to selections</div>
                          )}
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
                    </div>
                  </div>
                </div>
              )}
              
              {/* Intersection Popup */}
              {showIntersectionPopup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h3 className="text-lg font-semibold mb-4">Selection Options</h3>
                    <p className="mb-6">
                      {intersectionType === 'road-city' 
                        ? `You have selected both Road "${intersectionItems.road}" and Political Subdivision "${intersectionItems.entity}". What would you like to do?` 
                        : `You have selected both Road "${intersectionItems.road}" and Agency Defined District "${intersectionItems.entity}". What would you like to do?`}
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button 
                        onClick={() => setShowIntersectionPopup(false)} 
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => {
                          // Handle intersection confirmation
                          setShowIntersectionPopup(false);
                          
                          // Find the road and entity selections
                          const roadSelections = selections.filter(s => s.type === "road");
                          const entitySelections = selections.filter(s => [
                            "city", "county", "district", "subdistrict"
                          ].includes(s.type));
                          
                          // Extract the actual road and entity names from the selections
                          const roadName = roadSelections[0]?.selection as string || intersectionItems.road;
                          const entityName = entitySelections[0]?.selection as string || intersectionItems.entity;
                          console.log('Extracted road name:', roadName, 'and entity name:', entityName);
                          
                          // Determine entity type
                          const entityType = intersectionType === 'road-city' ? 
                            (selections.some(s => s.type === "county") ? 'county' : 'city') : 
                            (selections.some(s => s.type === "subdistrict") ? 'subdistrict' : 'district');
                          console.log('Determined entity type:', entityType, 'for intersection type:', intersectionType);
                          
                          // Create an intersection event with the road and entity details
                          const intersectionEvent = new CustomEvent('intersection-requested', {
                            detail: {
                              type: intersectionType,
                              roadSelections,
                              entitySelections,
                              roadName: roadName,
                              entityName: entityName,
                              entityType: entityType
                            }
                          });
                          window.dispatchEvent(intersectionEvent);
                          
                          // Create a formatted intersection name using the extracted names
                          const intersectionName = `${roadName} ∩ ${entityName}`;
                          console.log('Creating intersection with name:', intersectionName);
                          
                          // Force the type to be string to ensure it's displayed correctly
                          // Add a new selection of type "intersection"
                          const newIntersection: LocationSelection = {
                            type: "intersection" as LocationSelectionType,
                            selection: intersectionName as string,
                            operator: "AND"
                          };
                          console.log('New intersection selection object:', newIntersection);
                          
                          // Force an update to the UI by creating a new array
                          // This ensures React detects the change and re-renders
                          
                          // Remove the original road and entity selections
                          const otherSelections = selections.filter(s => 
                            s.type !== "road" && 
                            s.type !== "city" && 
                            s.type !== "county" && 
                            s.type !== "district" && 
                            s.type !== "subdistrict"
                          );
                          
                          // Update selections state with only the intersection
                          // This needs to happen before removing the roads/entities from the map
                          // to ensure the selection state is updated correctly
                          onSelectionsChange?.([...otherSelections, newIntersection]);
                          
                          // Then remove the original road selections from the map
                          roadSelections.forEach(roadSelection => {
                            const roadName = typeof roadSelection.selection === 'string' ? 
                              roadSelection.selection : Array.isArray(roadSelection.selection) ? 
                              roadSelection.selection[0] : '';
                            
                            // Remove the road from the map using a direct removal event
                            // This bypasses the selection-removed event which might not work correctly
                            const roadEvent = new CustomEvent('remove-map-layer', {
                              detail: { 
                                type: 'road',
                                name: roadName,
                                layerPattern: `road-layer-${roadName.replace(/\s+/g, '-').toLowerCase()}`
                              }
                            });
                            window.dispatchEvent(roadEvent);
                            
                            // Also dispatch the standard event for completeness
                            const selectionEvent = new CustomEvent('road-selection-removed', {
                              detail: { 
                                type: 'road',
                                selection: roadName,
                                name: roadName
                              }
                            });
                            window.dispatchEvent(selectionEvent);
                          });
                          
                          // Then remove the original entity selections from the map
                          entitySelections.forEach(entitySelection => {
                            const entityName = typeof entitySelection.selection === 'string' ? 
                              entitySelection.selection : Array.isArray(entitySelection.selection) ? 
                              entitySelection.selection[0] : '';
                            
                            // Remove the entity from the map using a direct removal event
                            const entityType = entitySelection.type;
                            const eventType = `${entityType}-boundary-removed`;
                            const event = new CustomEvent(eventType, {
                              detail: { 
                                name: entityName,
                                type: entityType,
                                selection: entityName
                              }
                            });
                            window.dispatchEvent(event);
                          });
                          
                          // Update the UI state to reflect the changes
                          if (setSelectedRoads) setSelectedRoads([]);
                          if (setSelectedCities) setSelectedCities([]);
                          if (setSelectedCounties) setSelectedCounties([]);
                          if (setSelectedAgencyDistricts) setSelectedAgencyDistricts([]);
                          // Clear the subdistricts state to remove the badge
                          setSelectedAgencySubdistricts([]);
                          
                          // Show a toast notification
                          toast({
                            title: "Finding Intersection",
                            description: `Finding the intersection between ${intersectionItems.road} and ${intersectionItems.entity}...`,
                            duration: 3000
                          });
                        }}
                      >
                        Find Intersection
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}
