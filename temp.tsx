"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronUp, ChevronDown, Info, AlertTriangle, Construction, Clock, Map as MapIcon } from "lucide-react"
import { DataSourceMetadata, fetchDataSourcesMetadata } from "@/services/api"
import { PointOfInterest } from "@/services/poi-service"
import * as turf from '@turf/turf'

mapboxgl.accessToken = "pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng"

// Unique source and layer IDs for roads, POI circles, and boundaries
let roadSourceCounter = 0;
let poiCircleCounter = 0;
let boundarySourceCounter = 0;

// Define interface for map data
interface MapData {
  id: number;
  datasource_metadata_id: number;
  datasource_tablename: string;
  event_type?: string;
  priority_level?: number;
  event_status?: string;
  route?: string;
  start_mile_marker?: number;
  end_mile_marker?: number;
  readable_coordinates: string;
  [key: string]: any; // Allow for additional properties
}

// Helper function to calculate bounding box from polygon coordinates
const getBoundingBox = (coordinates: number[][]) => {
  if (!coordinates || coordinates.length === 0) return null;
  
  // Initialize with the first point
  let minX = coordinates[0][0];
  let maxX = coordinates[0][0];
  let minY = coordinates[0][1];
  let maxY = coordinates[0][1];
  
  // Find min/max for all points
  coordinates.forEach(point => {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
  });
  
  return {
    southwest: [minX, minY],
    northeast: [maxX, maxY]
  };
};

// Custom CSS for centered map controls
const mapControlsStyle = `
  .mapboxgl-ctrl-bottom-right {
    bottom: 50% !important;
    transform: translateY(50%);
  }
  .mapboxgl-ctrl-group {
    margin-bottom: 10px;
  }
`;

export function MapView({ queryResults }: { queryResults?: any }) {
  const { toast } = useToast();
  // Function to clear all markers - defined early to avoid reference errors
  const clearMarkers = () => {
    if (markersRef.current) {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    }
    
    if (popupsRef.current) {
      popupsRef.current.forEach(popup => popup.remove());
      popupsRef.current = [];
    }
  };
  
  // Function to clear only POI markers and circles
  const clearPOIMarkers = () => {
    if (poiMarkersRef.current) {
      poiMarkersRef.current.forEach(marker => marker.remove());
      poiMarkersRef.current = [];
    }
    
    // Also clear POI circle layers
    if (map.current && poiCircleLayersRef.current.length > 0) {
      poiCircleLayersRef.current.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      poiCircleLayersRef.current = [];
    }
  };
  
  // Function to clear road layers
  const clearRoadLayers = () => {
    if (map.current) {
      roadLayersRef.current.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      roadLayersRef.current = [];
    }
  };
  
  // Function to clear boundary layers
  const clearBoundaryLayers = () => {
    if (map.current) {
      boundaryLayersRef.current.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      boundaryLayersRef.current = [];
    }
  };
  
  // Function to clear all preview layers (internal implementation)
  const clearAllPreviewLayers = () => {
    clearPreviewRoadLayers();
    clearPreviewPoiLayers();
    clearPreviewBoundaryLayers();
  };
  
  // Function to clear all preview layers from the map
  const clearAllPreviews = () => {
    // Clear all preview layers
    clearPreviewRoadLayers();
    clearPreviewPoiLayers();
    clearPreviewBoundaryLayers();
    
    // Also dispatch events to notify other components
    const roadEvent = new CustomEvent('road-preview-hide-all');
    window.dispatchEvent(roadEvent);
    
    const cityEvent = new CustomEvent('city-preview-hide-all');
    window.dispatchEvent(cityEvent);
    
    const countyEvent = new CustomEvent('county-preview-hide-all');
    window.dispatchEvent(countyEvent);
    
    const districtEvent = new CustomEvent('district-preview-hide-all');
    window.dispatchEvent(districtEvent);
    
    const subdistrictEvent = new CustomEvent('subdistrict-preview-hide-all');
    window.dispatchEvent(subdistrictEvent);
  };
  
  // Function to clear preview road layers
  const clearPreviewRoadLayers = () => {
    if (map.current) {
      previewRoadLayersRef.current.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      previewRoadLayersRef.current = [];
    }
  };
  
  // Function to clear preview POI layers
  const clearPreviewPoiLayers = () => {
    if (map.current) {
      previewPoiLayersRef.current.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      previewPoiLayersRef.current = [];
    }
  };
  
  // Function to clear preview boundary layers
  const clearPreviewBoundaryLayers = () => {
    if (map.current) {
      previewBoundaryLayersRef.current.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      previewBoundaryLayersRef.current = [];
    }
  };
  
  // Function to clear specific boundary by name and type
  const clearBoundaryByNameAndType = (name: string, type: string) => {
    if (map.current) {
      const boundariesToRemove = boundaryLayersRef.current.filter(
        boundary => boundary.name === name && boundary.type === type
      );
      
      boundariesToRemove.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Update the ref to exclude the removed boundaries
      boundaryLayersRef.current = boundaryLayersRef.current.filter(
        boundary => !(boundary.name === name && boundary.type === type)
      );
    }
  };
  
  // Function to clear specific preview boundary by name and type
  const clearPreviewBoundaryByNameAndType = (name: string, type: string) => {
    if (map.current) {
      const boundariesToRemove = previewBoundaryLayersRef.current.filter(
        boundary => boundary.name === name && boundary.type === type
      );
      
      boundariesToRemove.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Update the ref to exclude the removed boundaries
      previewBoundaryLayersRef.current = previewBoundaryLayersRef.current.filter(
        boundary => !(boundary.name === name && boundary.type === type)
      );
    }
  };
  
  // Function to clear specific preview road by name
  const clearPreviewRoadByName = (name: string) => {
    if (map.current) {
      const roadsToRemove = previewRoadLayersRef.current.filter(
        road => road.name === name
      );
      
      roadsToRemove.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Update the ref to exclude the removed roads
      previewRoadLayersRef.current = previewRoadLayersRef.current.filter(
        road => road.name !== name
      );
    }
  };
  
  // Function to clear specific preview POI by name
  const clearPreviewPoiByName = (name: string) => {
    if (map.current) {
      // Remove layer and source
      const poisToRemove = previewPoiLayersRef.current.filter(
        poi => poi.name === name
      );
      
      poisToRemove.forEach(({sourceId, layerId}) => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });
      
      // Update the ref to exclude the removed POIs
      previewPoiLayersRef.current = previewPoiLayersRef.current.filter(
        poi => poi.name !== name
      );
      
      // Also remove any markers for this POI
      if (poiMarkersRef.current && poiMarkersRef.current.length > 0) {
        // Since we don't have a direct way to identify which marker belongs to which POI,
        // we'll remove all markers when clearing previews
        poiMarkersRef.current.forEach(marker => marker.remove());
        poiMarkersRef.current = [];
      }
    }
  };
  
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const poiMarkersRef = useRef<mapboxgl.Marker[]>([]) // Separate ref for POI markers
  const popupsRef = useRef<mapboxgl.Popup[]>([])
  const roadLayersRef = useRef<{sourceId: string, layerId: string}[]>([]) // Track road layers
  const poiCircleLayersRef = useRef<{sourceId: string, layerId: string, poiName: string}[]>([]) // Track POI circle layers
  const boundaryLayersRef = useRef<{sourceId: string, layerId: string, name: string, type: string}[]>([]) // Track boundary layers
  
  // Refs for preview layers
  const previewRoadLayersRef = useRef<{sourceId: string, layerId: string, name: string}[]>([]) // Track road preview layers
  const previewPoiLayersRef = useRef<{sourceId: string, layerId: string, name: string}[]>([]) // Track POI preview layers
  const previewBoundaryLayersRef = useRef<{sourceId: string, layerId: string, name: string, type: string}[]>([]) // Track boundary preview layers
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  
  // State for dataset metadata (for display names and colors)
  const [datasetMetadata, setDatasetMetadata] = useState<Record<string, DataSourceMetadata>>({})
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({})
  const [showLegend, setShowLegend] = useState(true)
  const [drawModeActive, setDrawModeActive] = useState(false)

  // Fetch dataset metadata for display names and colors
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const datasources = await fetchDataSourcesMetadata();
        const metadataMap = datasources.reduce((acc, source) => {
          acc[source.datasource_tablename] = source;
          return acc;
        }, {} as Record<string, DataSourceMetadata>);
        setDatasetMetadata(metadataMap);
        
        // Initialize all layers as visible
        const initialVisibility = datasources.reduce((acc, source) => {
          acc[source.datasource_tablename] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setVisibleLayers(initialVisibility);
      } catch (error) {
        console.error('Error fetching dataset metadata:', error);
      }
    };

    fetchMetadata();
  }, []);

  // Listen for POI selection events from LocationSelector
  useEffect(() => {
    const handlePOISelection = (event: CustomEvent) => {
      console.log('POI selection event received:', event.detail);
      if (map.current) {
        const { name, coordinates, type, radius } = event.detail;
        
        // Add marker for the POI
        addPOIMarkerToMap(name, coordinates, radius);
      }
    };
    
    // Add event listener for POI selection events
    window.addEventListener('poi-selection-added', handlePOISelection as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('poi-selection-added', handlePOISelection as EventListener);
    };
  }, []);
  
  // Listen for POI preview events
  useEffect(() => {
    // Handler for showing POI preview
    const handlePOIPreviewShow = (event: CustomEvent) => {
      console.log('POI preview show event received:', event.detail);
      if (map.current) {
        const { name, coordinates, radius } = event.detail;
        
        // Clear any existing preview for this POI
        clearPreviewPoiByName(name);
        
        // Create unique source and layer IDs for the preview
        const sourceId = `preview-poi-source-${poiCircleCounter}`;
        const layerId = `preview-poi-layer-${poiCircleCounter}`;
        poiCircleCounter++;
        
        // Always add a marker at the POI location regardless of radius
        const markerElement = document.createElement('div');
        markerElement.className = 'poi-marker';
        markerElement.style.width = '15px';
        markerElement.style.height = '15px';
        markerElement.style.borderRadius = '50%';
        markerElement.style.backgroundColor = '#3b82f6';
        markerElement.style.border = '2px solid white';
        markerElement.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.1)';
        // Add data attribute to identify the POI for removal
        markerElement.setAttribute('data-poi-name', name);
        markerElement.setAttribute('data-poi-type', 'preview'); // Mark as preview marker
        
        // Create a popup with the POI name
        const popup = new mapboxgl.Popup({ offset: 25 })
          .setText(`${name} (Preview)`);
        
        // Create and add the marker
        const marker = new mapboxgl.Marker(markerElement)
          .setLngLat([coordinates.lng, coordinates.lat])
          .setPopup(popup)
          .addTo(map.current);
        
        // Store the marker reference for later removal
        if (!poiMarkersRef.current) {
          poiMarkersRef.current = [];
        }
        poiMarkersRef.current.push(marker);
        
        // Add circle if radius is specified and greater than 0
        if (radius && radius > 0) {
          // Create a point using Turf.js
          const point = turf.point([coordinates.lng, coordinates.lat]);
          
          // Create a circle with the specified radius in miles
          // Note: turf.buffer takes radius in kilometers, so convert miles to km
          const radiusKm = radius * 1.60934;
          const circle = turf.buffer(point, radiusKm, { units: 'kilometers' });
          
          // Add the circle as a source
          map.current.addSource(sourceId, {
            type: 'geojson',
            data: circle
          });
          
          // Add a fill layer for the circle
          map.current.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#3b82f6', // Blue color for preview
              'fill-opacity': 0.3,
              'fill-outline-color': '#3b82f6'
            }
          });
          
          // Store the layer references for later removal
          previewPoiLayersRef.current.push({ sourceId, layerId, name });
        }
        
        // Always fly to the POI location regardless of radius
        map.current.flyTo({
          center: [coordinates.lng, coordinates.lat],
          zoom: 12
        });
      }
    };
    
    // Handler for hiding POI preview
    const handlePOIPreviewHide = (event: CustomEvent) => {
      console.log('POI preview hide event received:', event.detail);
      if (map.current) {
        const { name } = event.detail;
        clearPreviewPoiByName(name);
      }
    };
    
    // Handler for updating POI preview (e.g., when radius changes)
    const handlePOIPreviewUpdate = (event: CustomEvent) => {
      console.log('POI preview update event received:', event.detail);
      if (map.current) {
        const { name, coordinates, radius } = event.detail;
        
        // Remove the existing preview and create a new one with the updated radius
        clearPreviewPoiByName(name);
        
        // Create unique source and layer IDs for the preview
        const sourceId = `preview-poi-source-${poiCircleCounter}`;
        const layerId = `preview-poi-layer-${poiCircleCounter}`;
        poiCircleCounter++;
        
        // Add a circle for the POI with a different style to indicate it's a preview
        if (coordinates) {
          // Convert radius from miles to meters
          const radiusInMeters = radius * 1609.34;
          
          // Create a circle using turf.js
          const point = turf.point([coordinates.lng, coordinates.lat]);
          const circle = turf.circle(point, radiusInMeters, { steps: 64, units: 'meters' });
          
          // Add source and layer to map
          map.current.addSource(sourceId, {
            type: 'geojson',
            data: circle
          });
          
          // Add fill layer with a semi-transparent fill
          map.current.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#3b82f6', // Blue color for preview
              'fill-opacity': 0.3,
              'fill-outline-color': '#3b82f6'
            }
          });
          
          // Store the layer references for later removal
          previewPoiLayersRef.current.push({ sourceId, layerId, name });
        }
      }
    };
    
    // Add event listeners
    window.addEventListener('poi-preview-show', handlePOIPreviewShow as EventListener);
    window.addEventListener('poi-preview-hide', handlePOIPreviewHide as EventListener);
    window.addEventListener('poi-preview-update', handlePOIPreviewUpdate as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('poi-preview-show', handlePOIPreviewShow as EventListener);
      window.removeEventListener('poi-preview-hide', handlePOIPreviewHide as EventListener);
      window.removeEventListener('poi-preview-update', handlePOIPreviewUpdate as EventListener);
    };
  }, []);
  
  // Listen for Road selection events from LocationSelector
  useEffect(() => {
    const handleRoadSelection = (event: CustomEvent) => {
      console.log('Road selection event received:', event.detail);
      if (map.current) {
        const { name, coordinates, type } = event.detail;
        
        // Add road line to map
        addRoadToMap(name, coordinates);
      }
    };
    
    // Add event listener for Road selection events
    window.addEventListener('road-selection-added', handleRoadSelection as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('road-selection-added', handleRoadSelection as EventListener);
    };
  }, []);
  
  // Listen for Road preview events
  useEffect(() => {
    // Handler for showing road preview
    const handleRoadPreviewShow = (event: CustomEvent) => {
      console.log('Road preview show event received:', event.detail);
      if (map.current) {
        const { road } = event.detail;
        const { name, coordinates } = road;
        
        console.log(`Road preview coordinates for ${name}:`, coordinates);
        
        // Clear any existing preview for this road
        clearPreviewRoadByName(name);
        
        if (coordinates && coordinates.length > 0) {
          // Create unique source and layer IDs for the preview
          const sourceId = `preview-road-source-${roadSourceCounter}`;
          const layerId = `preview-road-layer-${roadSourceCounter}`;
          roadSourceCounter++;
          
          console.log(`Raw road coordinates type for ${name}:`, Array.isArray(coordinates) ? 'Array' : typeof coordinates);
          
          // Handle MultiLineString format from road-service.ts
          // The coordinates from getRoadCoordinates are in format number[][][] (MultiLineString)
          if (Array.isArray(coordinates) && coordinates.length > 0 && Array.isArray(coordinates[0])) {
            // Create a bounds object to encompass all line segments
            const bounds = new mapboxgl.LngLatBounds();
            
            // Process each line segment in the MultiLineString
            coordinates.forEach((lineSegment: number[][]) => {
              if (Array.isArray(lineSegment) && lineSegment.length > 0) {
                // Extend bounds with each coordinate in this line segment
                lineSegment.forEach((coord: number[]) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    bounds.extend([coord[0], coord[1]]);
                  }
                });
              }
            });
            
            // Create a GeoJSON feature for the road with MultiLineString geometry
            const roadFeature: GeoJSON.Feature<GeoJSON.MultiLineString> = {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'MultiLineString',
                coordinates: coordinates
              }
            };
            
            console.log(`Created MultiLineString feature for ${name}:`, roadFeature);
            
            // Add source and layer to map
            map.current.addSource(sourceId, {
              type: 'geojson',
              data: roadFeature
            });
            
            // Add line layer with a different style to indicate it's a preview
            map.current.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': '#3b82f6', // Blue color for preview
                'line-width': 6,         // Thicker line for better visibility
                'line-opacity': 0.9,     // More opaque
                'line-dasharray': [2, 1] // Dashed line to distinguish from regular selections
              }
            });
            
            // Store the layer references for later removal
            previewRoadLayersRef.current.push({ sourceId, layerId, name });
            
            // Fit the map to the road
            map.current.fitBounds(bounds, {
              padding: 50
            });
            
            return; // Exit early since we've handled the MultiLineString case
          }
          
          // Fallback for other coordinate formats
          // This handles the case where coordinates might be in a different format
          const validCoordinates = Array.isArray(coordinates) ? 
            coordinates.flatMap((coord: any) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                return [[coord[0], coord[1]]]; // Already in [lng, lat] format
              } else if (coord.lng !== undefined && coord.lat !== undefined) {
                return [[coord.lng, coord.lat]]; // Convert {lng, lat} to [lng, lat]
              } else if (coord.longitude !== undefined && coord.latitude !== undefined) {
                return [[coord.longitude, coord.latitude]]; // Convert {longitude, latitude} to [lng, lat]
              } else {
                console.error('Invalid coordinate format:', coord);
                return [];
              }
            }) : [];
          
          console.log(`Processed road coordinates for ${name}:`, validCoordinates);
          
          if (validCoordinates.length < 2) {
            console.error(`Not enough valid coordinates for road ${name}`);
            return;
          }
          
          // Create a GeoJSON feature for the road with LineString geometry
          const roadFeature: GeoJSON.Feature<GeoJSON.LineString> = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: validCoordinates
            }
          };
          
          console.log(`Created LineString feature for ${name}:`, roadFeature);
          
          // Add source and layer to map
          map.current.addSource(sourceId, {
            type: 'geojson',
            data: roadFeature
          });
          
          // Add line layer with a different style to indicate it's a preview
          map.current.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#3b82f6', // Blue color for preview
              'line-width': 6,         // Thicker line for better visibility
              'line-opacity': 0.9,     // More opaque
              'line-dasharray': [2, 1] // Dashed line to distinguish from regular selections
            }
          });
          
          // Store the layer references for later removal
          previewRoadLayersRef.current.push({ sourceId, layerId, name });
          
          // Fit the map to the road
          const bounds = new mapboxgl.LngLatBounds();
          validCoordinates.forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
          
          map.current.fitBounds(bounds, {
            padding: 50
          });
        }
      }
    };
    
    // Handler for hiding road preview
    const handleRoadPreviewHide = (event: CustomEvent) => {
      console.log('Road preview hide event received:', event.detail);
      if (map.current) {
        const { road } = event.detail;
        clearPreviewRoadByName(road.name);
      }
    };
    
    window.addEventListener('road-preview-show', handleRoadPreviewShow as EventListener);
    window.addEventListener('road-preview-hide', handleRoadPreviewHide as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('road-preview-show', handleRoadPreviewShow as EventListener);
      window.removeEventListener('road-preview-hide', handleRoadPreviewHide as EventListener);
    };
  }, []);
  
  // Listen for clear all previews event
  useEffect(() => {
    const handleClearAllPreviews = () => {
      clearAllPreviews();
    };
    
    window.addEventListener('clear-all-previews', handleClearAllPreviews as EventListener);
    
    return () => {
      window.removeEventListener('clear-all-previews', handleClearAllPreviews as EventListener);
    };
  }, []);
  

  
  // Listen for Intersection events from LocationSelector
  useEffect(() => {
    const handleIntersection = (event: CustomEvent) => {
      console.log('Intersection event received:', event.detail);
      if (map.current) {
        const { roadFeature, subdivisionFeature, roadName, subdivisionName, intersectionId, intersectionFeatures } = event.detail;
        
        // If we have intersection features, add them as a separate layer
        if (intersectionFeatures && intersectionFeatures.length > 0) {
          console.log('Adding intersection points to map');
          // Create a feature collection from the intersection features
          const intersectionFeatureCollection: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: intersectionFeatures
          };
          
          // First add the road segment as a highlighted line (BELOW the points)
          if (roadFeature) {
            // Add source for the road segment
            const roadSegmentSourceId = `road-segment-source-${Date.now()}`;
            map.current.addSource(roadSegmentSourceId, {
              type: 'geojson',
              data: roadFeature
            });
            
            // Add a visible layer for the road segment
            const roadSegmentLayerId = `road-segment-layer-${Date.now()}`;
            map.current.addLayer({
              id: roadSegmentLayerId,
              type: 'line',
              source: roadSegmentSourceId,
              paint: {
                'line-color': '#ef4444',  // Red for road segment
                'line-width': 6,          // Slightly thicker line
                'line-opacity': 0.8,
                'line-gap-width': 0,      // No gap
                'line-dasharray': [0, 0]  // Solid line
              }
            });
            
            // Create a second layer with a dashed pattern at the exact same location
            // This creates a visual effect that makes it look like the road is segmented at intersections
            const roadDashedLayerId = `road-dashed-layer-${Date.now()}`;
            map.current.addLayer({
              id: roadDashedLayerId,
              type: 'line',
              source: roadSegmentSourceId,
              paint: {
                'line-color': '#ffffff',   // White dashes
                'line-width': 2,           // Thinner than the main line
                'line-opacity': 0.8,
                'line-dasharray': [2, 4]   // Dashed pattern
              }
            });
            
            // Add a layer for the intersection points
            map.current.addLayer({
              id: event.detail.intersectionLayerId,
              type: 'circle',
              source: event.detail.intersectionSourceId,
              paint: {
                'circle-color': '#ff0000',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
              }
            });
            
            // Store the intersection info for later removal
            boundaryLayersRef.current.push({
              name: `${event.detail.roadName}-${event.detail.subdivisionName}-${event.detail.intersectionId}`,
              type: 'intersection-points',
              sourceId: event.detail.intersectionSourceId,
              layerId: event.detail.intersectionLayerId
            });
          } else {
            // If no specific intersection points, implement the intersection logic from the HTML file
            console.log('No specific intersection points found, using lineOverlap intersection logic');
            
            try {
              // Get the subdivision polygon and road features
              const subdivisionPolygon = event.detail.subdivisionFeature;
              let roadFeatures;
              
              // Ensure we have a consistent format for road features
              if (event.detail.roadFeature.type === 'FeatureCollection') {
                roadFeatures = event.detail.roadFeature.features;
              } else {
                roadFeatures = [event.detail.roadFeature];
              }
              
              // Flatten the road features to ensure we have individual LineStrings
              const flattened = turf.flatten({
                type: 'FeatureCollection',
                features: roadFeatures
              });
              
              // Find all road segments that are inside or overlap with the subdivision
              const insideSegments: GeoJSON.Feature[] = [];
              
              // Process each road segment
              flattened.features.forEach((feature: any) => {
                if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                  try {
                    // Check if the line is completely within the polygon
                    if (turf.booleanWithin(feature, subdivisionPolygon)) {
                      insideSegments.push(feature);
                      console.log('Found road segment completely within subdivision');
                    } else {
                      // Try to find overlapping segments
                      try {
                        // Use lineOverlap to find where the road overlaps with the subdivision
                        const overlap = turf.lineOverlap(feature, subdivisionPolygon, { tolerance: 0.0001 });
                        if (overlap.features.length > 0) {
                          insideSegments.push(...overlap.features);
                          console.log(`Found ${overlap.features.length} overlapping road segments`);
                        }
                      } catch (error) {
                        console.error('Error in lineOverlap:', error);
                      }
                    }
                  } catch (error) {
                    console.error('Error processing road segment:', error);
                  }
                }
              });
              
              // Create a feature collection from the inside segments
              const intersectionFeatureCollection = {
                type: 'FeatureCollection',
                features: insideSegments
              };
              
              // If we found inside segments, use them for visualization
              if (insideSegments.length > 0) {
                console.log(`Found ${insideSegments.length} total road segments inside/overlapping with subdivision`);
                
                // Add the road segments as a source
                const roadSegmentSourceId = event.detail.roadSegmentSourceId;
                map.current.addSource(roadSegmentSourceId, {
                  type: 'geojson',
                  data: intersectionFeatureCollection
                });
                
                // Add a visible layer for the road segments
                const roadSegmentLayerId = event.detail.roadSegmentLayerId;
                map.current.addLayer({
                  id: roadSegmentLayerId,
                  type: 'line',
                  source: roadSegmentSourceId,
                  paint: {
                    'line-color': '#ff0000',
                    'line-width': 4
                  }
                });
                
                // Store the road segment info for later removal
                boundaryLayersRef.current.push({
                  name: `${event.detail.roadName}-${event.detail.subdivisionName}-road-segments`,
                  type: 'intersection-road',
                  sourceId: roadSegmentSourceId,
                  layerId: roadSegmentLayerId
                });
                
                // Create a representative point for the intersection
                // Use the midpoint of the first segment as a fallback
                let intersectionPoint;
                
                if (insideSegments.length === 1) {
                  // For a single segment, use its midpoint
                  const segment = insideSegments[0];
                  const coords = segment.geometry.coordinates;
                  const midIndex = Math.floor(coords.length / 2);
                  intersectionPoint = turf.point(coords[midIndex]);
                } else {
                  // For multiple segments, create a collection of endpoints and find the center
                  const points = [];
                  insideSegments.forEach(segment => {
                    if (segment.geometry.type === 'LineString') {
                      const coords = segment.geometry.coordinates;
                      points.push(coords[0]);
                      points.push(coords[coords.length - 1]);
                    }
                  });
                  
                  const multiPoint = turf.multiPoint(points);
                  intersectionPoint = turf.center(multiPoint);
                }
                
                // Add the intersection point to the map
                const intersectionSourceId = event.detail.intersectionSourceId;
                map.current.addSource(intersectionSourceId, {
                  type: 'geojson',
                  data: intersectionPoint
                });
                
                const intersectionLayerId = event.detail.intersectionLayerId;
                map.current.addLayer({
                  id: intersectionLayerId,
                  type: 'circle',
                  source: intersectionSourceId,
                  paint: {
                    'circle-radius': 6,
                    'circle-color': '#ff0000',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff'
                  }
                });
                
                // Store the intersection info for later removal
                boundaryLayersRef.current.push({
                  name: `${event.detail.roadName}-${event.detail.subdivisionName}-${event.detail.intersectionId}`,
                  type: 'intersection-points',
                  sourceId: intersectionSourceId,
                  layerId: intersectionLayerId
                });
              } else {
                // If no segments found, use the center of the subdivision as a fallback
                console.log('No road segments found inside subdivision, using center point');
                
                const center = turf.center(subdivisionPolygon);
                const intersectionSourceId = event.detail.intersectionSourceId;
                
                map.current.addSource(intersectionSourceId, {
                  type: 'geojson',
                  data: center
                });
                
                const intersectionLayerId = event.detail.intersectionLayerId;
                map.current.addLayer({
                  id: intersectionLayerId,
                  type: 'circle',
                  source: intersectionSourceId,
                  paint: {
                    'circle-radius': 6,
                    'circle-color': '#ff0000',
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff'
                  }
                });
                
                // Store the intersection info for later removal
                boundaryLayersRef.current.push({
                  name: `${event.detail.roadName}-${event.detail.subdivisionName}-${event.detail.intersectionId}`,
                  type: 'intersection-points',
                  sourceId: intersectionSourceId,
                  layerId: intersectionLayerId
                });
              }
            } catch (error) {
              console.error('Error implementing intersection logic:', error);
              
              // Fallback to the center of the subdivision
              const center = turf.center(event.detail.subdivisionFeature);
              const intersectionSourceId = event.detail.intersectionSourceId;
              
              map.current.addSource(intersectionSourceId, {
                type: 'geojson',
                data: center
              });
              
              const intersectionLayerId = event.detail.intersectionLayerId;
              map.current.addLayer({
                id: intersectionLayerId,
                type: 'circle',
                source: intersectionSourceId,
                paint: {
                  'circle-radius': 6,
                  'circle-color': '#ff0000',
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#ffffff'
                }
              });
              
              // Store the intersection info for later removal
              boundaryLayersRef.current.push({
                name: `${event.detail.roadName}-${event.detail.subdivisionName}-${event.detail.intersectionId}`,
                type: 'intersection-points',
                sourceId: intersectionSourceId,
                layerId: intersectionLayerId
              });
            }
          }
          
          // Fit the map to the intersection area
          try {
            // Calculate bounding box for the road feature
            let roadBbox;
            if (Array.isArray(event.detail.roadFeature)) {
              // If multiple features, calculate combined bbox
              roadBbox = event.detail.roadFeature.reduce((bbox: number[], feature: any) => {
                const featureBbox = turf.bbox(feature);
                return [
                  Math.min(bbox[0], featureBbox[0]),
                  Math.min(bbox[1], featureBbox[1]),
                  Math.max(bbox[2], featureBbox[2]),
                  Math.max(bbox[3], featureBbox[3])
                ];
              }, [180, 90, -180, -90]); // Start with max bounds
              console.log('Calculated bbox from multiple road features:', roadBbox);
            } else {
              roadBbox = turf.bbox(event.detail.roadFeature);
              console.log('Calculated bbox from single road feature:', roadBbox);
            }
            
            const subdivisionBbox = turf.bbox(event.detail.subdivisionFeature);
            console.log('Subdivision bbox:', subdivisionBbox);
            
            // Combine the bounding boxes
            const combinedBbox = [
              Math.min(roadBbox[0], subdivisionBbox[0]),
              Math.min(roadBbox[1], subdivisionBbox[1]),
              Math.max(roadBbox[2], subdivisionBbox[2]),
              Math.max(roadBbox[3], subdivisionBbox[3])
            ];
            
            // Fit the map to the combined bounding box
            if (map.current) {
              map.current.fitBounds([
                [combinedBbox[0], combinedBbox[1]], // Southwest coordinates
                [combinedBbox[2], combinedBbox[3]]  // Northeast coordinates
              ], { padding: 50 });
            }
          } catch (error) {
            console.error('Error fitting map to intersection area:', error);
