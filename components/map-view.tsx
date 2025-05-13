"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import * as turf from '@turf/turf'
import MapboxDraw from "@mapbox/mapbox-gl-draw"
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { ChevronUp, ChevronDown, Info, AlertTriangle, Construction, Clock, Map as MapIcon } from "lucide-react"
import { DataSourceMetadata, fetchDataSourcesMetadata } from "@/services/api"
import { PointOfInterest } from "@/services/poi-service"
mapboxgl.accessToken = "pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng"

// Unique source and layer IDs for roads, POI circles, boundaries, and intersections
let roadSourceCounter = 0;
let poiCircleCounter = 0;
let boundarySourceCounter = 0; // For backward compatibility
let cityBoundaryCounter = 0;
let countyBoundaryCounter = 0;
let districtBoundaryCounter = 0;
let subdistrictBoundaryCounter = 0;
let intersectionCounter = 0;

// Unique source and layer IDs for clustered markers
const CLUSTER_SOURCE_ID = 'clustered-markers';
const CLUSTER_LAYER_ID = 'clustered-markers-layer';
const CLUSTER_COUNT_LAYER_ID = 'cluster-count';
const UNCLUSTERED_POINT_LAYER_ID = 'unclustered-point';

// Reference to the active popup for reuse
// Reference to the active popup for reuse
// Using non-null assertion for places where we've already checked it exists
let activePopup: mapboxgl.Popup | null = null;

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

export function MapView({ queryResults, onMarkerCountChange }: { queryResults?: any; onMarkerCountChange?: (count: number) => void }) {
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
    
    // Remove cluster layers and source if they exist
    if (map.current) {
      if (map.current.getLayer(CLUSTER_COUNT_LAYER_ID)) {
        map.current.removeLayer(CLUSTER_COUNT_LAYER_ID);
      }
      if (map.current.getLayer(CLUSTER_LAYER_ID)) {
        map.current.removeLayer(CLUSTER_LAYER_ID);
      }
      if (map.current.getLayer(UNCLUSTERED_POINT_LAYER_ID)) {
        map.current.removeLayer(UNCLUSTERED_POINT_LAYER_ID);
      }
      if (map.current.getLayer('single-point-count')) {
        map.current.removeLayer('single-point-count');
      }
      if (map.current.getSource(CLUSTER_SOURCE_ID)) {
        map.current.removeSource(CLUSTER_SOURCE_ID);
      }
      
      // Clean up line layers for MultiLineString geometries
      if (lineLayerIds.current.length > 0) {
        lineLayerIds.current.forEach(lineId => {
          if (map.current?.getLayer(lineId)) {
            map.current.removeLayer(lineId);
          }
          if (map.current?.getSource(lineId)) {
            map.current.removeSource(lineId);
          }
        });
        lineLayerIds.current = [];
      }
    }
  };
  
  // Function to clear only POI markers and circles
  const clearPOIMarkers = () => {
    if (!map.current) return;
    
    // Clear POI markers
    if (poiMarkersRef.current && poiMarkersRef.current.length > 0) {
      poiMarkersRef.current.forEach(marker => marker.remove());
      poiMarkersRef.current = [];
    }
    
    // Clear POI circle layers
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
    
    // Brute force approach to remove all POI-related layers
    removeAllPOILayers();
  };
  
  // Function to remove all POI-related layers from the map
  const removeAllPOILayers = () => {
    if (!map.current) return;
    
    console.log('Attempting to remove all POI-related layers from the map');
    
    try {
      const style = map.current.getStyle();
      if (!style) return;
      
      // Find all layers that might be POI circles
      if (style.layers) {
        const poiLayers = style.layers
          .filter(layer => {
            // Look for any layer that might be related to POIs
            const id = layer.id || '';
            return id.includes('poi-circle') || 
                   id.includes('circle') || 
                   id.toLowerCase().includes('poi');
          })
          .map(layer => layer.id);
        
        console.log('Found these potential POI layers on the map:', poiLayers);
        
        // Remove each layer
        poiLayers.forEach(id => {
          if (id && map.current?.getLayer(id)) {
            try {
              map.current.removeLayer(id);
              console.log(`Successfully removed layer: ${id}`);
            } catch (e) {
              console.error(`Error removing layer ${id}:`, e);
            }
          }
        });
      }
      
      // Find all sources that might be POI circles
      if (style.sources) {
        const poiSources = Object.keys(style.sources)
          .filter(id => {
            return id.includes('poi-circle') || 
                   id.includes('circle') || 
                   id.toLowerCase().includes('poi');
          });
        
        console.log('Found these potential POI sources on the map:', poiSources);
        
        // Remove each source
        poiSources.forEach(id => {
          if (map.current?.getSource(id)) {
            try {
              map.current.removeSource(id);
              console.log(`Successfully removed source: ${id}`);
            } catch (e) {
              console.error(`Error removing source ${id}:`, e);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error in brute force POI layer removal:', error);
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
  
  // Function to clear all preview layers
  const clearAllPreviews = () => {
    clearPreviewRoadLayers();
    clearPreviewPoiLayers();
    clearPreviewBoundaryLayers();
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
  const poiCircleLayersRef = useRef<{sourceId: string, layerId: string, poiName: string, sanitizedName?: string}[]>([]) // Track POI circle layers
  const boundaryLayersRef = useRef<{sourceId: string, layerId: string, name: string, type: string}[]>([]) // Track boundary layers
  
  // Refs for preview layers
  const previewRoadLayersRef = useRef<{sourceId: string, layerId: string, name: string}[]>([]) // Track road preview layers
  const previewPoiLayersRef = useRef<{sourceId: string, layerId: string, name: string}[]>([]) // Track POI preview layers
  const previewBoundaryLayersRef = useRef<{sourceId: string, layerId: string, name: string, type: string}[]>([]) // Track boundary preview layers
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const lineLayerIds = useRef<string[]>([]) // Track line layers for MultiLineString geometries
  
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
    
    // Add event listeners
    window.addEventListener('road-preview-show', handleRoadPreviewShow as EventListener);
    window.addEventListener('road-preview-hide', handleRoadPreviewHide as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('road-preview-show', handleRoadPreviewShow as EventListener);
      window.removeEventListener('road-preview-hide', handleRoadPreviewHide as EventListener);
    };
  }, []);
  
  // Listen for City preview events
  useEffect(() => {
    // Handler for showing city preview
    const handleCityPreviewShow = (event: CustomEvent) => {
      console.log('City preview show event received:', event.detail);
      if (map.current) {
        const { name, feature } = event.detail;
        
        // Clear any existing preview for this city
        clearPreviewBoundaryByNameAndType(name, 'city');
        
        // Create unique source and layer IDs for the preview
        const sourceId = `preview-city-source-${boundarySourceCounter}`;
        const layerId = `preview-city-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer with a different style to indicate it's a preview
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#10b981', // Green color for cities
            'fill-opacity': 0.3,
            'fill-outline-color': '#10b981'
          }
        });
        
        // Store the layer references for later removal
        previewBoundaryLayersRef.current.push({ sourceId, layerId, name, type: 'city' });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Handler for hiding city preview
    const handleCityPreviewHide = (event: CustomEvent) => {
      console.log('City preview hide event received:', event.detail);
      if (map.current) {
        const { name } = event.detail;
        clearPreviewBoundaryByNameAndType(name, 'city');
      }
    };
    
    // Add event listeners
    window.addEventListener('city-preview-show', handleCityPreviewShow as EventListener);
    window.addEventListener('city-preview-hide', handleCityPreviewHide as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('city-preview-show', handleCityPreviewShow as EventListener);
      window.removeEventListener('city-preview-hide', handleCityPreviewHide as EventListener);
    };
  }, []);
  
  // Listen for County preview events
  useEffect(() => {
    // Handler for showing county preview
    const handleCountyPreviewShow = (event: CustomEvent) => {
      console.log('County preview show event received:', event.detail);
      if (map.current) {
        const { name, feature } = event.detail;
        
        // Clear any existing preview for this county
        clearPreviewBoundaryByNameAndType(name, 'county');
        
        // Create unique source and layer IDs for the preview
        const sourceId = `preview-county-source-${boundarySourceCounter}`;
        const layerId = `preview-county-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer with a different style to indicate it's a preview
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#8b5cf6', // Purple color for counties
            'fill-opacity': 0.3,
            'fill-outline-color': '#8b5cf6'
          }
        });
        
        // Store the layer references for later removal
        previewBoundaryLayersRef.current.push({ sourceId, layerId, name, type: 'county' });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Handler for hiding county preview
    const handleCountyPreviewHide = (event: CustomEvent) => {
      console.log('County preview hide event received:', event.detail);
      if (map.current) {
        const { name } = event.detail;
        clearPreviewBoundaryByNameAndType(name, 'county');
      }
    };
    
    // Add event listeners
    window.addEventListener('county-preview-show', handleCountyPreviewShow as EventListener);
    window.addEventListener('county-preview-hide', handleCountyPreviewHide as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('county-preview-show', handleCountyPreviewShow as EventListener);
      window.removeEventListener('county-preview-hide', handleCountyPreviewHide as EventListener);
    };
  }, []);
  
  // Listen for District preview events
  useEffect(() => {
    // Handler for showing district preview
    const handleDistrictPreviewShow = (event: CustomEvent) => {
      console.log('District preview show event received:', event.detail);
      if (map.current) {
        const { name, feature } = event.detail;
        
        // Clear any existing preview for this district
        clearPreviewBoundaryByNameAndType(name, 'district');
        
        // Create unique source and layer IDs for the preview
        const sourceId = `preview-district-source-${boundarySourceCounter}`;
        const layerId = `preview-district-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer with a different style to indicate it's a preview
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#3b82f6', // Blue color for districts
            'fill-opacity': 0.3,
            'fill-outline-color': '#3b82f6'
          }
        });
        
        // Store the layer references for later removal
        previewBoundaryLayersRef.current.push({ sourceId, layerId, name, type: 'district' });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Handler for hiding district preview
    const handleDistrictPreviewHide = (event: CustomEvent) => {
      console.log('District preview hide event received:', event.detail);
      if (map.current) {
        const { name } = event.detail;
        clearPreviewBoundaryByNameAndType(name, 'district');
      }
    };
    
    // Add event listeners
    window.addEventListener('district-preview-show', handleDistrictPreviewShow as EventListener);
    window.addEventListener('district-preview-hide', handleDistrictPreviewHide as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('district-preview-show', handleDistrictPreviewShow as EventListener);
      window.removeEventListener('district-preview-hide', handleDistrictPreviewHide as EventListener);
    };
  }, []);
  
  // Listen for Subdistrict preview events
  useEffect(() => {
    // Handler for showing subdistrict preview
    const handleSubdistrictPreviewShow = (event: CustomEvent) => {
      console.log('Subdistrict preview show event received:', event.detail);
      if (map.current) {
        const { name, feature } = event.detail;
        
        // Clear any existing preview for this subdistrict
        clearPreviewBoundaryByNameAndType(name, 'subdistrict');
        
        // Create unique source and layer IDs for the preview
        const sourceId = `preview-subdistrict-source-${boundarySourceCounter}`;
        const layerId = `preview-subdistrict-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer with a different style to indicate it's a preview
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#93c5fd', // Light blue color for subdistricts
            'fill-opacity': 0.3,
            'fill-outline-color': '#93c5fd'
          }
        });
        
        // Store the layer references for later removal
        previewBoundaryLayersRef.current.push({ sourceId, layerId, name, type: 'subdistrict' });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Handler for hiding subdistrict preview
    const handleSubdistrictPreviewHide = (event: CustomEvent) => {
      console.log('Subdistrict preview hide event received:', event.detail);
      if (map.current) {
        const { name } = event.detail;
        clearPreviewBoundaryByNameAndType(name, 'subdistrict');
      }
    };
    
    // Add event listeners
    window.addEventListener('subdistrict-preview-show', handleSubdistrictPreviewShow as EventListener);
    window.addEventListener('subdistrict-preview-hide', handleSubdistrictPreviewHide as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('subdistrict-preview-show', handleSubdistrictPreviewShow as EventListener);
      window.removeEventListener('subdistrict-preview-hide', handleSubdistrictPreviewHide as EventListener);
    };
  }, []);
  
  // Listen for selection added events to clear previews
  useEffect(() => {
    const handleSelectionAdded = () => {
      console.log('Selection added, clearing all previews');
      clearAllPreviews();
    };
    
    // Add event listeners for all selection added events
    window.addEventListener('poi-selection-added', handleSelectionAdded);
    // Removed road-selection-added from here to prevent duplication with the specific handler above
    window.addEventListener('city-boundary-added', handleSelectionAdded);
    window.addEventListener('county-boundary-added', handleSelectionAdded);
    window.addEventListener('district-boundary-added', handleSelectionAdded);
    window.addEventListener('subdistrict-boundary-added', handleSelectionAdded);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('poi-selection-added', handleSelectionAdded);
      // Removed road-selection-added from here to prevent duplication with the specific handler above
      window.removeEventListener('city-boundary-added', handleSelectionAdded);
      window.removeEventListener('county-boundary-added', handleSelectionAdded);
      window.removeEventListener('district-boundary-added', handleSelectionAdded);
      window.removeEventListener('subdistrict-boundary-added', handleSelectionAdded);
    };
  }, []);
  
  // Listen for City boundary events from LocationSelector
  useEffect(() => {
    const handleCityBoundary = (event: CustomEvent) => {
      console.log('City boundary event received:', event.detail);
      if (map.current) {
        const { name, feature, type } = event.detail;
        
        // Create unique source and layer IDs
        const sourceId = `boundary-source-${boundarySourceCounter}`;
        const layerId = `boundary-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#10b981', // Green color for cities
            'fill-opacity': 0.2,
            'fill-outline-color': '#10b981'
          }
        });
        
        // Store the layer references for later removal
        boundaryLayersRef.current.push({ sourceId, layerId, name, type });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Add event listener for City boundary events
    window.addEventListener('city-boundary-added', handleCityBoundary as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('city-boundary-added', handleCityBoundary as EventListener);
    };
  }, []);
  
  // Listen for County boundary events from LocationSelector
  useEffect(() => {
    const handleCountyBoundary = (event: CustomEvent) => {
      console.log('County boundary event received:', event.detail);
      if (map.current) {
        const { name, feature, type } = event.detail;
        
        // Create unique source and layer IDs
        const sourceId = `boundary-source-${boundarySourceCounter}`;
        const layerId = `boundary-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#8b5cf6', // Purple color for counties
            'fill-opacity': 0.2,
            'fill-outline-color': '#8b5cf6'
          }
        });
        
        // Store the layer references for later removal
        boundaryLayersRef.current.push({ sourceId, layerId, name, type });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Add event listener for County boundary events
    window.addEventListener('county-boundary-added', handleCountyBoundary as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('county-boundary-added', handleCountyBoundary as EventListener);
    };
  }, []);
  
  // Listen for District boundary events from LocationSelector
  useEffect(() => {
    const handleDistrictBoundary = (event: CustomEvent) => {
      console.log('District boundary event received:', event.detail);
      if (map.current) {
        const { name, feature, type } = event.detail;
        
        // Create unique source and layer IDs
        const sourceId = `boundary-source-${boundarySourceCounter}`;
        const layerId = `boundary-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#3b82f6', // Blue color for districts
            'fill-opacity': 0.2,
            'fill-outline-color': '#3b82f6'
          }
        });
        
        // Store the layer references for later removal
        boundaryLayersRef.current.push({ sourceId, layerId, name, type });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Add event listener for District boundary events
    window.addEventListener('district-boundary-added', handleDistrictBoundary as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('district-boundary-added', handleDistrictBoundary as EventListener);
    };
  }, []);
  
  // Listen for Subdistrict boundary events from LocationSelector
  useEffect(() => {
    const handleSubdistrictBoundary = (event: CustomEvent) => {
      console.log('Subdistrict boundary event received:', event.detail);
      if (map.current) {
        const { name, feature, type } = event.detail;
        
        // Create unique source and layer IDs
        const sourceId = `boundary-source-${boundarySourceCounter}`;
        const layerId = `boundary-layer-${boundarySourceCounter}`;
        boundarySourceCounter++;
        
        // Add source and layer to map
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: feature
        });
        
        // Add fill layer
        map.current.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#60a5fa', // Light blue color for subdistricts
            'fill-opacity': 0.2,
            'fill-outline-color': '#60a5fa'
          }
        });
        
        // Store the layer references for later removal
        boundaryLayersRef.current.push({ sourceId, layerId, name, type });
        
        // Fit the map to the boundary
        const bounds = new mapboxgl.LngLatBounds();
        
        // Handle both Polygon and MultiPolygon geometries
        if (feature.geometry.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord: number[]) => {
            bounds.extend([coord[0], coord[1]]);
          });
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon: number[][][]) => {
            polygon[0].forEach((coord: number[]) => {
              bounds.extend([coord[0], coord[1]]);
            });
          });
        }
        
        // Fly to the boundary with padding
        map.current.fitBounds(bounds, {
          padding: 50
        });
      }
    };
    
    // Add event listener for Subdistrict boundary events
    window.addEventListener('subdistrict-boundary-added', handleSubdistrictBoundary as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('subdistrict-boundary-added', handleSubdistrictBoundary as EventListener);
    };
  }, []);
  

  useEffect(() => {
    
    // Function to handle selection removal events
    const handleSelectionRemoved = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Selection removed event received:', customEvent);
      
      if (!map.current) {
        console.error('Map not initialized');
        return;
      }
      
      // Extract event details
      const detail = customEvent.detail || {};
      const type = detail.type;
      const selection = detail.selection;
      const name = detail.name;
      
      console.log('Removing selection:', { type, name, selection });
      
      if (type === 'road') {
        // Handle road removal
        const roadName = name || (typeof selection === 'string' ? selection : '');
        if (!roadName) {
          console.error('No road name provided for removal');
          return;
        }
        
        console.log('Removing road selection:', roadName);
        
        // Find and remove road layers by checking all layers in roadLayersRef
        // since the layer IDs use a counter, not the road name
        try {
          if (roadLayersRef && roadLayersRef.current && roadLayersRef.current.length > 0) {
            console.log('Looking for road layers to remove in roadLayersRef:', roadLayersRef.current);
            
            // Find layers that match the road name in their source data
            const style = map.current.getStyle();
            const mapLayers = style?.layers || [];
            const mapSources = style?.sources || {};
            
            // Track which layers and sources we've removed
            const removedLayers: string[] = [];
            const removedSources: string[] = [];
            
            // Check each road layer reference
            for (const layerRef of roadLayersRef.current) {
              // Handle both string and object formats
              if (typeof layerRef === 'string') {
                // Old format - just a layer ID string
                if (map.current.getLayer(layerRef)) {
                  // Try to get the source data to check if it's for this road
                  const layer = mapLayers.find(l => l.id === layerRef);
                  if (layer && layer.source) {
                    const sourceData = mapSources[layer.source] as any;
                    // Check if this is a GeoJSON source with our road data
                    if (sourceData && 
                        sourceData.type === 'geojson' && 
                        sourceData.data && 
                        sourceData.data.properties && 
                        sourceData.data.properties.name === roadName) {
                      // This is the layer for our road
                      map.current.removeLayer(layerRef);
                      removedLayers.push(layerRef);
                      console.log(`Removed layer ${layerRef} for road ${roadName}`);
                      
                      // Also remove the source if possible
                      if (map.current.getSource(layer.source)) {
                        map.current.removeSource(layer.source);
                        removedSources.push(layer.source);
                        console.log(`Removed source ${layer.source} for road ${roadName}`);
                      }
                    }
                  }
                }
              } else if (layerRef && typeof layerRef === 'object' && layerRef.layerId && layerRef.sourceId) {
                // New format - object with layerId and sourceId
                // Check if this layer corresponds to our road
                const layer = mapLayers.find(l => l.id === layerRef.layerId);
                if (layer) {
                  const sourceData = mapSources[layerRef.sourceId] as any;
                  // Check if this is a GeoJSON source with our road data
                  if (sourceData && 
                      sourceData.type === 'geojson' && 
                      sourceData.data && 
                      sourceData.data.properties && 
                      sourceData.data.properties.name === roadName) {
                    // This is the layer for our road
                    if (map.current.getLayer(layerRef.layerId)) {
                      map.current.removeLayer(layerRef.layerId);
                      removedLayers.push(layerRef.layerId);
                      console.log(`Removed layer ${layerRef.layerId} for road ${roadName}`);
                    }
                    
                    if (map.current.getSource(layerRef.sourceId)) {
                      map.current.removeSource(layerRef.sourceId);
                      removedSources.push(layerRef.sourceId);
                      console.log(`Removed source ${layerRef.sourceId} for road ${roadName}`);
                    }
                  }
                }
              }
            }
            
            // Update the road layers reference to remove the ones we deleted
            if (removedLayers.length > 0) {
              roadLayersRef.current = roadLayersRef.current.filter(l => {
                if (typeof l === 'string') {
                  return !removedLayers.includes(l);
                } else if (l && typeof l === 'object' && l.layerId) {
                  return !removedLayers.includes(l.layerId);
                }
                return true;
              });
              console.log(`Updated roadLayersRef after removing ${removedLayers.length} layers`);
            } else {
              console.log(`No matching road layers found for ${roadName}`);
            }
          } else {
            console.log('No road layers reference available or empty');
          }
        } catch (e) {
          console.error(`Error removing specific road elements:`, e);
          
          // As a fallback, try to remove all road-related layers and sources
          try {
            const style = map.current.getStyle();
            const mapLayers = style?.layers || [];
            const mapSources = Object.keys(style?.sources || {});
            
            // Remove road-related layers
            for (const layer of mapLayers) {
              if (layer.id && layer.id.includes('road-layer')) {
                try {
                  if (map.current.getLayer(layer.id)) {
                    map.current.removeLayer(layer.id);
                    console.log(`Removed layer ${layer.id}`);
                  }
                } catch (e) {
                  console.error(`Error removing layer ${layer.id}:`, e);
                }
              }
            }
            
            // Remove road-related sources
            for (const sourceId of mapSources) {
              if (sourceId.includes('road-source')) {
                try {
                  if (map.current.getSource(sourceId)) {
                    map.current.removeSource(sourceId);
                    console.log(`Removed source ${sourceId}`);
                  }
                } catch (e) {
                  console.error(`Error removing source ${sourceId}:`, e);
                }
              }
            }
            
            // Update the road layers reference
            if (roadLayersRef && roadLayersRef.current) {
              roadLayersRef.current = roadLayersRef.current.filter(layer => {
                // Check if the layerId contains 'road-layer'
                return !layer.layerId.includes('road-layer');
              });
            }
          } catch (fallbackError) {
            console.error('Error in fallback road removal:', fallbackError);
          }
        }
        console.log('Road layers have been removed');
      } else if (type === 'poi') {
        // Handle POI removal
        const poiName = typeof selection === 'string' ? selection : '';
        if (!poiName) {
          console.error('No POI name provided for removal');
          return;
        }
        
        console.log('Removing Point of Interest:', poiName);
        
        // Use the dedicated POI removal function
        handlePoiBoundaryRemoval(poiName);
      } else if (type === 'city') {
        if (detail.poiRadius !== undefined) {
          // Handle legacy POI removal (city with poiRadius)
          const poiName = typeof selection === 'string' ? selection : '';
          if (!poiName) {
            console.error('No POI name provided for removal');
            return;
          }
          
          console.log('Removing legacy Point of Interest:', poiName);
          
          // Clear POI markers
          if (poiMarkersRef && poiMarkersRef.current && poiMarkersRef.current.length > 0) {
            console.log('Looking for POI markers with name:', poiName);
            
            // Find markers with the matching POI name
            const markersToRemove = poiMarkersRef.current.filter(marker => {
              const element = marker.getElement();
              const markerName = element.getAttribute('data-poi-name');
              console.log('Checking marker:', markerName, 'against POI:', poiName);
              return markerName === poiName;
            });
            
            console.log('Found', markersToRemove.length, 'markers to remove');
            
            // Remove the markers from the map
            markersToRemove.forEach(marker => {
              console.log('Removing marker from map');
              marker.remove();
            });
            
            // Update the markers reference array
            poiMarkersRef.current = poiMarkersRef.current.filter(marker => {
              const element = marker.getElement();
              return element.getAttribute('data-poi-name') !== poiName;
            });
          }
          
          // Clear POI circle layers
          if (map.current && poiCircleLayersRef && poiCircleLayersRef.current && poiCircleLayersRef.current.length > 0) {
            // Find circle layers with the matching POI name
            const circlesToRemove = poiCircleLayersRef.current.filter(circle => circle.poiName === poiName);
            
            // Remove the layers and sources from the map
            circlesToRemove.forEach(({sourceId, layerId}) => {
              if (map.current?.getLayer(layerId)) {
                map.current.removeLayer(layerId);
              }
              if (map.current?.getSource(sourceId)) {
                map.current.removeSource(sourceId);
              }
            });
            
            // Update the circle layers reference array
            poiCircleLayersRef.current = poiCircleLayersRef.current.filter(circle => circle.poiName !== poiName);
          }
        } else {
          // Handle city boundary removal
          const cityName = typeof selection === 'string' ? selection : '';
          if (!cityName) {
            console.error('No city name provided for removal');
            return;
          }
          
          console.log('Removing City Boundary:', cityName);
          
          // Use the existing function to remove the city boundary
          handleCityBoundaryRemoval(cityName);
        }
      } else if (type === 'county') {
        // Handle county boundary removal
        const countyName = typeof selection === 'string' ? selection : '';
        if (!countyName) {
          console.error('No county name provided for removal');
          return;
        }
        
        console.log('Removing County Boundary:', countyName);
        
        // Use the existing function to remove the county boundary
        handleCountyBoundaryRemoval(countyName);
      }
    };
    
    // Add event listeners for selection removal events
    window.addEventListener('selection-removed', handleSelectionRemoved);
    window.addEventListener('road-selection-removed', handleSelectionRemoved);
    window.addEventListener('poi-selection-removed', handleSelectionRemoved);
    
    // Add event listener for polygon removal
    window.addEventListener('polygon-removed', (e) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const polygonId = detail.polygonId;
      
      console.log('Polygon removal event received for:', polygonId);
      
      if (polygonId && map.current && drawRef.current) {
        try {
          // Get all features from the draw control
          const allFeatures = drawRef.current.getAll();
          
          // Find the feature with the matching ID
          const featureToRemove = allFeatures.features.find(f => f.id === polygonId);
          
          if (featureToRemove) {
            console.log('Found polygon to remove:', featureToRemove);
            
            // Delete the feature from the draw control
            drawRef.current.delete(polygonId);
            console.log('Removed polygon from map with ID:', polygonId);
            
            // Show a toast notification
            toast({
              title: "Polygon Removed",
              description: "The drawn polygon has been removed from the map.",
              duration: 3000
            });
          } else {
            console.log('Polygon with ID not found in draw control:', polygonId);
          }
        } catch (error) {
          console.error('Error removing polygon from map:', error);
        }
      }
    });
    window.addEventListener('city-boundary-removed', (e) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const cityName = detail.name;
      
      if (cityName) {
        console.log('City boundary removal event received for:', cityName);
        handleCityBoundaryRemoval(cityName);
      }
    });
    window.addEventListener('county-boundary-removed', (e) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const countyName = detail.name;
      
      if (countyName) {
        console.log('County boundary removal event received for:', countyName);
        handleCountyBoundaryRemoval(countyName);
      }
    });
    window.addEventListener('district-boundary-removed', (e) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const districtName = detail.name;
      
      if (districtName) {
        console.log('District boundary removal event received for:', districtName);
        handleDistrictBoundaryRemoval(districtName);
      }
    });
    window.addEventListener('subdistrict-boundary-removed', (e) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const subdistrictName = detail.name;
      
      if (subdistrictName) {
        console.log('Subdistrict boundary removal event received for:', subdistrictName);
        handleSubdistrictBoundaryRemoval(subdistrictName);
      }
    });
    
    // Listen for POI removed events (from selections list)
    window.addEventListener('poi-removed', (e) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const poiName = detail.name;
      console.log('POI removed from selections list:', poiName);
      handlePoiBoundaryRemoval(poiName);
    });
    
    // Function to handle city boundary removal
    const handleCityBoundaryRemoval = (selection: string | null) => {
      // If a specific city is provided, remove just that one
      if (selection) {
        if (typeof clearBoundaryByNameAndType === 'function') {
          clearBoundaryByNameAndType(selection, 'city');
        }
      } else if (boundaryLayersRef && boundaryLayersRef.current) {
        // Otherwise clear all city boundaries
        const cityBoundaries = boundaryLayersRef.current.filter(b => b.type === 'city');
        cityBoundaries.forEach(({sourceId, layerId}) => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current?.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
        boundaryLayersRef.current = boundaryLayersRef.current.filter(b => b.type !== 'city');
      }
    };
    
    // Function to handle county boundary removal
    const handleCountyBoundaryRemoval = (selection: string | null) => {
      // If a specific county is provided, remove just that one
      if (selection) {
        if (typeof clearBoundaryByNameAndType === 'function') {
          clearBoundaryByNameAndType(selection, 'county');
        }
      } else if (boundaryLayersRef && boundaryLayersRef.current) {
        // Otherwise clear all county boundaries
        const countyBoundaries = boundaryLayersRef.current.filter(b => b.type === 'county');
        countyBoundaries.forEach(({sourceId, layerId}) => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current?.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
        boundaryLayersRef.current = boundaryLayersRef.current.filter(b => b.type !== 'county');
      }
    };
    
    // Function to handle district boundary removal
    const handleDistrictBoundaryRemoval = (selection: string | null) => {
      // If a specific district is provided, remove just that one
      if (selection) {
        if (typeof clearBoundaryByNameAndType === 'function') {
          clearBoundaryByNameAndType(selection, 'district');
        }
      } else if (boundaryLayersRef && boundaryLayersRef.current) {
        // Otherwise clear all district boundaries
        const districtBoundaries = boundaryLayersRef.current.filter(b => b.type === 'district');
        districtBoundaries.forEach(({sourceId, layerId}) => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current?.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
        boundaryLayersRef.current = boundaryLayersRef.current.filter(b => b.type !== 'district');
      }
    };
    
    // Function to handle subdistrict boundary removal
    const handleSubdistrictBoundaryRemoval = (selection: string | null) => {
      // If a specific subdistrict is provided, remove just that one
      if (selection) {
        if (typeof clearBoundaryByNameAndType === 'function') {
          clearBoundaryByNameAndType(selection, 'subdistrict');
        }
      } else if (boundaryLayersRef && boundaryLayersRef.current) {
        // Otherwise clear all subdistrict boundaries
        const subdistrictBoundaries = boundaryLayersRef.current.filter(b => b.type === 'subdistrict');
        subdistrictBoundaries.forEach(({sourceId, layerId}) => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
          if (map.current?.getSource(sourceId)) {
            map.current.removeSource(sourceId);
          }
        });
        boundaryLayersRef.current = boundaryLayersRef.current.filter(b => b.type !== 'subdistrict');
      }
    };
    
    // Function to handle POI boundary removal
    const handlePoiBoundaryRemoval = (selection: string | null) => {
      console.log('handlePoiBoundaryRemoval called for:', selection);
      
      // If a specific POI is provided, remove just that one
      if (selection) {
        // Remove POI markers
        if (poiMarkersRef && poiMarkersRef.current && poiMarkersRef.current.length > 0) {
          console.log('Looking for POI markers with name:', selection, 'Current markers:', poiMarkersRef.current.length);
          
          // Find markers with the matching POI name
          const markersToRemove = poiMarkersRef.current.filter(marker => {
            const element = marker.getElement();
            const markerName = element.getAttribute('data-poi-name');
            console.log('Checking marker:', markerName, 'against POI:', selection);
            return markerName === selection;
          });
          
          console.log('Found', markersToRemove.length, 'markers to remove');
          
          // Remove the markers from the map
          markersToRemove.forEach(marker => {
            console.log('Removing marker from map');
            marker.remove();
          });
          
          // Update the markers reference array
          poiMarkersRef.current = poiMarkersRef.current.filter(marker => {
            const element = marker.getElement();
            return element.getAttribute('data-poi-name') !== selection;
          });
        }
        
        // Use the brute force approach to remove all POI-related layers
        // This is more reliable than trying to match specific layers
        removeAllPOILayers();
        
        // Remove POI circle layers
        if (map.current && poiCircleLayersRef && poiCircleLayersRef.current) {
          console.log('Looking for POI circle layers with name:', selection);
          console.log('Current circle layers:', poiCircleLayersRef.current.map(c => ({ name: c.poiName, layerId: c.layerId })));
          
          // Find circle layers with the matching POI name
          // Try multiple approaches to find the layers
          const sanitizedSelection = selection.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          
          // First try exact match by name
          let circlesToRemove = poiCircleLayersRef.current.filter(circle => circle.poiName === selection);
          
          // If no matches, try matching by sanitized name or by layerId containing the name
          if (circlesToRemove.length === 0) {
            circlesToRemove = poiCircleLayersRef.current.filter(circle => 
              (circle.sanitizedName && circle.sanitizedName === sanitizedSelection) ||
              circle.layerId.includes(sanitizedSelection)
            );
          }
          
          // If still no matches, try a more lenient approach
          if (circlesToRemove.length === 0) {
            // Try to find any layer that might be related to this POI
            circlesToRemove = poiCircleLayersRef.current.filter(circle => 
              circle.layerId.includes('poi-circle-layer')
            );
            console.log('Falling back to removing all POI circle layers');
          }
          
          console.log('Found', circlesToRemove.length, 'circle layers to remove:', 
                    circlesToRemove.map(c => ({ name: c.poiName, layerId: c.layerId })));
          
          // Remove the layers and sources from the map
          circlesToRemove.forEach(({sourceId, layerId}) => {
            console.log(`Removing layer ${layerId} and source ${sourceId}`);
            try {
              if (map.current?.getLayer(layerId)) {
                map.current.removeLayer(layerId);
                console.log(`Successfully removed layer ${layerId}`);
              } else {
                console.warn(`Layer ${layerId} not found on map`);
                
                // Try to find all layers that might be related to POIs
                if (map.current) {
                  const style = map.current.getStyle();
                  if (style && style.layers) {
                    const poiLayers = style.layers
                      .filter(layer => layer.id && layer.id.includes('poi-circle-layer'))
                      .map(layer => layer.id);
                    
                    console.log('Found these POI layers on the map:', poiLayers);
                    
                    // Try to remove all POI layers
                    poiLayers.forEach(id => {
                      try {
                        if (map.current?.getLayer(id)) {
                          map.current.removeLayer(id);
                          console.log(`Removed additional layer: ${id}`);
                        }
                      } catch (e) {
                        console.error(`Error removing additional layer ${id}:`, e);
                      }
                    });
                  }
                }
              }
              
              if (map.current?.getSource(sourceId)) {
                map.current.removeSource(sourceId);
                console.log(`Successfully removed source ${sourceId}`);
              } else {
                console.warn(`Source ${sourceId} not found on map`);
                
                // Try to find all sources that might be related to POIs
                if (map.current) {
                  const style = map.current.getStyle();
                  if (style && style.sources) {
                    const poiSources = Object.keys(style.sources)
                      .filter(id => id.includes('poi-circle-source'));
                    
                    console.log('Found these POI sources on the map:', poiSources);
                    
                    // Try to remove all POI sources
                    poiSources.forEach(id => {
                      try {
                        if (map.current?.getSource(id)) {
                          map.current.removeSource(id);
                          console.log(`Removed additional source: ${id}`);
                        }
                      } catch (e) {
                        console.error(`Error removing additional source ${id}:`, e);
                      }
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Error removing layer/source for POI ${selection}:`, error);
            }
          });
          
          // Update the circle layers reference array
          const previousLength = poiCircleLayersRef.current.length;
          poiCircleLayersRef.current = poiCircleLayersRef.current.filter(circle => circle.poiName !== selection);
          console.log(`Removed ${previousLength - poiCircleLayersRef.current.length} circle layers from reference array`);
        }
      } else {
        // Clear all POI markers
        if (poiMarkersRef && poiMarkersRef.current) {
          poiMarkersRef.current.forEach(marker => marker.remove());
          poiMarkersRef.current = [];
        }
        
        // Clear all POI circle layers
        if (map.current && poiCircleLayersRef && poiCircleLayersRef.current) {
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
      }
    };
    
    // Using the handleSelectionRemoved function defined earlier
    const useExistingSelectionHandler = () => {
      // This is a placeholder function that doesn't do anything
      // The actual functionality is handled by the handleSelectionRemoved function defined above
      console.log('Using existing selection handler');
      return;
    };
    
    // Add direct layer removal event listener
    const handleDirectLayerRemoval = (event: CustomEvent) => {
      console.log('Direct layer removal event received:', event.detail);
      if (!map.current) return;
      
      const { layerId, sourceId } = event.detail;
      
      if (layerId && typeof layerId === 'string') {
        try {
          // Check if the layer exists before trying to remove it
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
            console.log(`Successfully removed layer: ${layerId}`);
          } else {
            console.log(`Layer not found: ${layerId}`);
          }
        } catch (e) {
          console.error(`Error removing layer ${layerId}:`, e);
        }
      }
      
      if (sourceId && typeof sourceId === 'string') {
        try {
          // Check if the source exists before trying to remove it
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
            console.log(`Successfully removed source: ${sourceId}`);
          } else {
            console.log(`Source not found: ${sourceId}`);
          }
        } catch (e) {
          console.error(`Error removing source ${sourceId}:`, e);
        }
      }
      
      // Clear the road layers reference if it was a road layer
      if (layerId && layerId.includes('road-layer')) {
        roadLayersRef.current = roadLayersRef.current.filter(l => l !== layerId);
        console.log('Updated roadLayersRef array after removal');
      }
    };
    
    window.addEventListener('remove-map-layer', handleDirectLayerRemoval as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('selection-removed', handleSelectionRemoved as EventListener);
      window.removeEventListener('poi-selection-removed', handleSelectionRemoved as EventListener);
      window.removeEventListener('road-selection-removed', handleSelectionRemoved as EventListener);
      window.removeEventListener('remove-map-layer', handleDirectLayerRemoval as EventListener);
    };
  }, []);
  
  // Listen for draw mode changes from LocationSelector
  useEffect(() => {
    const handleDrawModeChange = (event: CustomEvent) => {
      console.log('Draw mode change event received:', event.detail);
      if (map.current && drawRef.current) {
        const { mode } = event.detail;
        
        if (mode === 'polygon') {
          // Activate polygon drawing mode
          drawRef.current.changeMode('draw_polygon');
          setDrawModeActive(true);
        } else if (mode === 'circle') {
          // Activate circle drawing mode (not directly supported by MapboxDraw)
          // For now, we'll use polygon as a fallback
          drawRef.current.changeMode('draw_polygon');
          setDrawModeActive(true);
        } else {
          // Deactivate drawing mode
          drawRef.current.changeMode('simple_select');
          setDrawModeActive(false);
        }
      }
    };

    // Add event listener for custom draw mode change event
    window.addEventListener('location-draw-mode-change', handleDrawModeChange as EventListener);
    
    return () => {
      // Clean up event listener
      window.removeEventListener('location-draw-mode-change', handleDrawModeChange as EventListener);
    };
  }, []);
  
  // Listen for intersection requests
  useEffect(() => {
    // Store intersection layers for later removal
    const intersectionLayers: { sourceId: string; layerId: string; id: string }[] = [];
    
    // Function to fetch GeoJSON data
    const fetchGeoJSON = async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching GeoJSON from ${url}:`, error);
        return null;
      }
    };
    
    // Handle intersection request
    const handleIntersectionRequest = async (event: CustomEvent) => {
      console.log('Intersection request received:', event.detail);
      if (!map.current) return;
      
      const { roadSelections, entitySelections, roadName, entityName, entityType } = event.detail;
      
      if (!roadSelections || !entitySelections || roadSelections.length === 0 || entitySelections.length === 0) {
        console.error('Missing required selections for intersection');
        return;
      }
      
      // Extract road and entity information from selections
      const roadSelection = roadSelections[0];
      const entitySelection = entitySelections[0];
      
      if (!roadSelection || !entitySelection) {
        console.error('Missing road or entity selection');
        return;
      }
      
      // Get the road name from the selection
      const actualRoadName = typeof roadSelection.selection === 'string' ? 
        roadSelection.selection : Array.isArray(roadSelection.selection) ? 
        roadSelection.selection[0] : '';
      
      // Get the entity name from the selection
      const actualEntityName = typeof entitySelection.selection === 'string' ? 
        entitySelection.selection : Array.isArray(entitySelection.selection) ? 
        entitySelection.selection[0] : '';
      
      console.log('Using road name:', actualRoadName);
      console.log('Using entity name:', actualEntityName);
      
      if (!actualRoadName || !actualEntityName) {
        console.error('Could not determine road or entity name from selections');
        return;
      }
      
      // Determine the actual entity type from the selection
      const actualEntityType = entitySelection.type as string;
      
      // Determine the entity GeoJSON URL based on entity type
      let entityGeoJSONUrl = '';
      switch (actualEntityType) {
        case 'city':
          entityGeoJSONUrl = '/geojson/city-cleaned.geojson';
          break;
        case 'county':
          entityGeoJSONUrl = '/geojson/counties-cleaned.geojson';
          break;
        case 'district':
          entityGeoJSONUrl = '/geojson/districts-cleaned.geojson';
          break;
        case 'subdistrict':
          entityGeoJSONUrl = '/geojson/subdistricts-cleaned.geojson';
          break;
        default:
          console.error('Unknown entity type:', actualEntityType);
          return;
      }
      
      // Fetch road and entity GeoJSON data
      const roadGeoJSON = await fetchGeoJSON('/geojson/road-cleaned.geojson');
      const entityGeoJSON = await fetchGeoJSON(entityGeoJSONUrl);
      
      if (!roadGeoJSON || !entityGeoJSON) {
        console.error('Failed to fetch GeoJSON data');
        return;
      }
      
      // Find the road feature - use case-insensitive comparison
      // Handle different road name formats (e.g., 'I-69', 'I-69 (MM 0-500)', 'Road I-69')
      let roadNameClean = actualRoadName.toLowerCase().trim();
      
      // Remove 'Road ' prefix if present
      if (roadNameClean.startsWith('road ')) {
        roadNameClean = roadNameClean.substring(5).trim();
      }
      
      // Remove mile marker information if present
      if (roadNameClean.includes('(mm')) {
        roadNameClean = roadNameClean.substring(0, roadNameClean.indexOf('(mm')).trim();
      }
      
      console.log(`Looking for road with name: '${roadNameClean}'`);
      
      // First try to find an exact match
      let roadFeature = roadGeoJSON.features.find((feature: any) => {
        if (!feature.properties) return false;
        
        // Check both name and fullname properties (road GeoJSON uses fullname)
        const roadPropertyName = feature.properties.name || feature.properties.fullname || '';
        const featureName = roadPropertyName.toLowerCase().trim();
        
        return featureName === roadNameClean;
      });
      
      // If no exact match, try partial matching
      if (!roadFeature) {
        console.log('No exact match found, trying partial matching...');
        roadFeature = roadGeoJSON.features.find((feature: any) => {
          if (!feature.properties) return false;
          
          const roadPropertyName = feature.properties.name || feature.properties.fullname || '';
          const featureName = roadPropertyName.toLowerCase().trim();
          
          console.log(`Comparing with road feature: '${featureName}' (original: '${roadPropertyName}')`);
          return featureName.includes(roadNameClean) || roadNameClean.includes(featureName);
        });
      }
      
      // Find the entity feature - use case-insensitive comparison
      // Clean up entity name by removing prefixes
      let entityNameClean = actualEntityName
        .replace('Political Subdivision ', '')
        .replace('District ', '')
        .toLowerCase()
        .trim();
      
      console.log(`Looking for entity with name: '${entityNameClean}'`);
      
      // First try to find an exact match
      let entityFeature = entityGeoJSON.features.find((feature: any) => {
        if (!feature.properties) return false;
        
        // Extract entity name from different property naming conventions
        const featureName = (feature.properties.name || 
                           feature.properties.NAME || 
                           feature.properties.DISTRICT_NAME || 
                           feature.properties.SUBDIST_NAME || '').toLowerCase().trim();
        
        return featureName === entityNameClean;
      });
      
      // If no exact match, try partial matching
      if (!entityFeature) {
        console.log('No exact match found for entity, trying partial matching...');
        
        // Log all available entity names for debugging
        console.log('Available entity names:');
        entityGeoJSON.features.forEach((feature: any) => {
          if (feature.properties) {
            const name = feature.properties.name || 
                        feature.properties.NAME || 
                        feature.properties.DISTRICT_NAME || 
                        feature.properties.SUBDIST_NAME || '';
            console.log(`- ${name}`);
          }
        });
        
        entityFeature = entityGeoJSON.features.find((feature: any) => {
          if (!feature.properties) return false;
          
          const featureName = (feature.properties.name || 
                             feature.properties.NAME || 
                             feature.properties.DISTRICT_NAME || 
                             feature.properties.SUBDIST_NAME || '').toLowerCase().trim();
          
          console.log(`Comparing with entity feature: '${featureName}'`);
          return featureName.includes(entityNameClean) || entityNameClean.includes(featureName);
        });
      }
      
      // Log all available features if we couldn't find a match
      if (!roadFeature) {
        console.log('Available road features:');
        roadGeoJSON.features.forEach((feature: any) => {
          console.log(`- ${feature.properties.name}`);
        });
      }
      
      if (!entityFeature) {
        console.log('Available entity features:');
        entityGeoJSON.features.forEach((feature: any) => {
          const name = feature.properties.name || feature.properties.NAME || 
                      feature.properties.DISTRICT_NAME || feature.properties.SUBDIST_NAME;
          console.log(`- ${name}`);
        });
      }
      
      if (!roadFeature || !entityFeature) {
        console.error('Could not find road or entity feature', { roadName, entityName, roadFeature, entityFeature });
        return;
      }
      
      console.log('Found road and entity features:', { roadFeature, entityFeature });
      
      // Calculate intersection
      try {
        console.log('Processing road feature:', roadFeature);
        console.log('Processing entity feature:', entityFeature);
        
        // Process road feature (flatten MultiLineString to LineString features)
        const flattenedRoad = turf.flatten(roadFeature);
        const roadSegments = flattenedRoad.features;
        console.log(`Road has ${roadSegments.length} segments after flattening`);
        
        // Process entity feature - handle both Polygon and MultiPolygon
        const entityPolygons: any[] = [];
        
        if (entityFeature.geometry.type === 'MultiPolygon') {
          console.log('Entity is a MultiPolygon, processing each polygon');
          // Process each polygon in the MultiPolygon
          entityFeature.geometry.coordinates.forEach((polygonCoords: any) => {
            try {
              const polygon = turf.polygon(polygonCoords);
              entityPolygons.push(polygon);
            } catch (e) {
              console.error('Error creating polygon from coordinates:', e);
            }
          });
        } else if (entityFeature.geometry.type === 'Polygon') {
          console.log('Entity is a Polygon');
          entityPolygons.push(entityFeature);
        }
        
        console.log(`Entity has ${entityPolygons.length} polygons to process`);
        
        // Find segments of the road that intersect with any of the entity polygons
        const intersectingSegments: any[] = [];
        
        roadSegments.forEach((segment: any, index: number) => {
          console.log(`Processing road segment ${index + 1}/${roadSegments.length}`);
          
          // Check against each polygon in the entity
          entityPolygons.forEach((polygon: any, polyIndex: number) => {
            try {
              // Try different intersection methods
              let isIntersecting = false;
              
              // Method 1: Check if segment is within polygon
              try {
                const isWithin = turf.booleanWithin(segment, polygon);
                if (isWithin) {
                  isIntersecting = true;
                  console.log(`Segment ${index} is within polygon ${polyIndex}`);
                }
              } catch (e) {
                console.error('Error in booleanWithin check:', e);
              }
              
              // Method 2: Check for line overlap
              if (!isIntersecting) {
                try {
                  const overlaps = turf.lineOverlap(segment, polygon);
                  if (overlaps && overlaps.features.length > 0) {
                    isIntersecting = true;
                    console.log(`Segment ${index} overlaps with polygon ${polyIndex}`);
                  }
                } catch (e) {
                  console.error('Error in lineOverlap check:', e);
                }
              }
              
              // Method 3: Check for line intersection
              if (!isIntersecting) {
                try {
                  const intersection = turf.lineIntersect(segment, polygon);
                  if (intersection && intersection.features.length > 0) {
                    isIntersecting = true;
                    console.log(`Segment ${index} intersects with polygon ${polyIndex}`);
                  }
                } catch (e) {
                  console.error('Error in lineIntersect check:', e);
                }
              }
              
              if (isIntersecting && !intersectingSegments.includes(segment)) {
                intersectingSegments.push(segment);
              }
            } catch (e) {
              console.error(`Error processing intersection for segment ${index} and polygon ${polyIndex}:`, e);
            }
          });
        });
        
        console.log(`Found ${intersectingSegments.length} intersecting segments`);
        
        if (intersectingSegments.length === 0) {
          console.log('No intersection found between road and entity');
          
          // Send notification to the user that no intersection was found
          toast({
            title: "No Intersection Found",
            description: `No intersection found between ${roadName} and ${entityName}. The road and entity do not overlap on the map.`,
            variant: "destructive",
            duration: 5000
          });
          
          // Dispatch an event to notify that the intersection operation is complete
          // This allows the UI to update accordingly
          const noIntersectionEvent = new CustomEvent('intersection-not-found', {
            detail: {
              roadName,
              entityName,
              entityType
            }
          });
          window.dispatchEvent(noIntersectionEvent);
          
          return;
        }
        
        // Combine all intersecting segments into a single feature collection
        const intersectionFeatureCollection = turf.featureCollection(intersectingSegments);
        
        // Create unique IDs for the intersection source and layer
        const intersectionId = `intersection-${roadName.replace(/\s+/g, '-')}-${entityName.replace(/\s+/g, '-')}-${intersectionCounter}`;
        const sourceId = `${intersectionId}-source`;
        const layerId = `${intersectionId}-layer`;
        intersectionCounter++;
        
        // Add the intersection to the map
        if (map.current.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
        
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: intersectionFeatureCollection
        });
        
        // Add a line layer for the intersection with a distinctive color
        if (map.current.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
        
        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#6a0dad', // Purple color for intersections
            'line-width': 6,
            'line-opacity': 0.8
          }
        });
        
        // Store the intersection layer for later removal
        intersectionLayers.push({ sourceId, layerId, id: intersectionId });
        
        // Dispatch an event to notify that an intersection has been added
        const intersectionAddedEvent = new CustomEvent('intersection-added', {
          detail: {
            id: intersectionId,
            roadName,
            entityName,
            entityType,
            sourceId,
            layerId
          }
        });
        window.dispatchEvent(intersectionAddedEvent);
        
        // Fit the map to the intersection bounds
        const bounds = new mapboxgl.LngLatBounds();
        intersectingSegments.forEach((segment: any) => {
          if (segment.geometry && segment.geometry.coordinates) {
            segment.geometry.coordinates.forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
          }
        });
        
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });
        
      } catch (error) {
        console.error('Error calculating intersection:', error);
      }
    };
    
    // Add event listener for intersection requests
    window.addEventListener('intersection-requested', handleIntersectionRequest as unknown as EventListener);
    
    // Store the original road and entity names for each intersection ID
    const intersectionNameMap = new Map<string, { roadName: string, entityName: string }>();
    
    // Update the handleIntersectionRequest function to store the original names
    const handleIntersectionAdded = (event: CustomEvent) => {
      const { id, roadName, entityName } = event.detail;
      console.log('Storing original names for intersection:', id, roadName, entityName);
      
      // Store the original road and entity names for this intersection ID
      intersectionNameMap.set(id, { roadName, entityName });
    };
    
    // Add event listener for intersection added events
    window.addEventListener('intersection-added', handleIntersectionAdded as unknown as EventListener);
    
    // Add event listener for getting intersection coordinates
    const handleGetIntersectionCoordinates = (event: CustomEvent) => {
      const { id } = event.detail;
      console.log('Request for intersection coordinates received for ID:', id);
      
      if (!map.current) {
        console.error('Map not initialized');
        return;
      }
      
      // Find the intersection layer
      const intersectionLayer = intersectionLayers.find(layer => layer.id === id);
      
      if (!intersectionLayer) {
        console.error('Intersection layer not found for ID:', id);
        return;
      }
      
      const { sourceId } = intersectionLayer;
      
      // Get the source data from the map
      const source = map.current.getSource(sourceId) as mapboxgl.GeoJSONSource;
      
      if (!source) {
        console.error('Source not found for ID:', sourceId);
        return;
      }
      
      // Get the GeoJSON data from the source
      // We need to extract this from the map's internal representation
      try {
        // Get the source data using _data which is an internal property
        // This is a bit hacky but necessary to access the GeoJSON data
        const sourceData = (source as any)._data;
        
        if (!sourceData || !sourceData.features || sourceData.features.length === 0) {
          console.error('No features found in source data');
          return;
        }
        
        // Extract all coordinates from the features
        const allCoordinates: number[][] = [];
        
        sourceData.features.forEach((feature: any) => {
          if (feature.geometry && feature.geometry.coordinates) {
            if (feature.geometry.type === 'LineString') {
              // LineString coordinates are already in the format we want
              allCoordinates.push(...feature.geometry.coordinates);
            } else if (feature.geometry.type === 'MultiLineString') {
              // MultiLineString coordinates need to be flattened
              feature.geometry.coordinates.forEach((lineCoords: number[][]) => {
                allCoordinates.push(...lineCoords);
              });
            }
          }
        });
        
        if (allCoordinates.length === 0) {
          console.error('No coordinates found in features');
          return;
        }
        
        console.log(`Found ${allCoordinates.length} coordinates for intersection`);
        
        // Get the original road and entity names from the map
        let roadName = '';
        let entityName = '';
        
        // Try to get the original names from the map
        const originalNames = intersectionNameMap.get(id);
        
        if (originalNames) {
          roadName = originalNames.roadName;
          entityName = originalNames.entityName;
          console.log('Using stored original names:', roadName, entityName);
        } else {
          // Fallback to extracting names from the ID if we don't have the original names
          const parts = id.split('-');
          
          if (parts.length >= 4) {
            // The last part is the counter
            const counter = parts[parts.length - 1];
            
            // The parts in between 'intersection' and the counter are the road and entity names
            const middleParts = parts.slice(1, parts.length - 1);
            
            roadName = middleParts[0];
            entityName = middleParts.slice(1).join('-');
            
            console.log('Extracted fallback names from ID:', roadName, entityName);
          }
        }
        
        // Send the coordinates back to the location selector
        const coordinatesEvent = new CustomEvent('intersection-coordinates', {
          detail: {
            id,
            coordinates: allCoordinates,
            roadName,
            entityName
          }
        });
        
        window.dispatchEvent(coordinatesEvent);
        
      } catch (error) {
        console.error('Error getting intersection coordinates:', error);
      }
    };
    
    window.addEventListener('get-intersection-coordinates', handleGetIntersectionCoordinates as unknown as EventListener);
    
    // Add event listener for intersection removal
    const handleIntersectionRemoved = (event: CustomEvent) => {
      const { id } = event.detail;
      console.log('Handling intersection removal for ID:', id);
      console.log('Current intersection layers:', JSON.stringify(intersectionLayers));
      
      // Find the intersection layer to remove
      const intersectionLayer = intersectionLayers.find(layer => layer.id === id);
      console.log('Found intersection layer:', intersectionLayer);
      
      if (intersectionLayer && map.current) {
        const { sourceId, layerId } = intersectionLayer;
        console.log('Removing layer:', layerId, 'and source:', sourceId);
        
        try {
          // Remove the layer and source from the map
          if (map.current.getLayer(layerId)) {
            map.current.removeLayer(layerId);
            console.log('Successfully removed layer:', layerId);
          } else {
            console.log('Layer not found:', layerId);
            
            // Try to find any layers that might match our intersection
            const mapStyle = map.current?.getStyle();
            const allLayers = mapStyle?.layers || [];
            const possibleLayers = allLayers.filter(layer => 
              layer.id.includes('intersection') || 
              (layer.id.includes(id.split('-')[1]) && layer.id.includes(id.split('-')[2]))
            );
            console.log('Possible matching layers:', possibleLayers.map(l => l.id));
            
            // Try to remove these layers as a fallback
            possibleLayers.forEach(layer => {
              try {
                if (map.current) {
                  map.current.removeLayer(layer.id);
                  console.log('Removed possible matching layer:', layer.id);
                }
              } catch (e) {
                console.error('Error removing possible layer:', e);
              }
            });
          }
          
          if (map.current.getSource(sourceId)) {
            map.current.removeSource(sourceId);
            console.log('Successfully removed source:', sourceId);
          } else {
            console.log('Source not found:', sourceId);
            
            // Try to find any sources that might match our intersection
            const mapStyle = map.current?.getStyle();
            const allSources = mapStyle?.sources ? Object.keys(mapStyle.sources) : [];
            const possibleSources = allSources.filter(source => 
              source.includes('intersection') || 
              (source.includes(id.split('-')[1]) && source.includes(id.split('-')[2]))
            );
            console.log('Possible matching sources:', possibleSources);
            
            // Try to remove these sources as a fallback
            possibleSources.forEach(source => {
              try {
                if (map.current) {
                  map.current.removeSource(source);
                  console.log('Removed possible matching source:', source);
                }
              } catch (e) {
                console.error('Error removing possible source:', e);
              }
            });
          }
        } catch (e) {
          console.error('Error during intersection removal:', e);
        }
        
        // Remove the layer from the array
        const index = intersectionLayers.findIndex(layer => layer.id === id);
        if (index !== -1) {
          intersectionLayers.splice(index, 1);
          console.log('Removed layer from intersectionLayers array');
        } else {
          console.log('Layer not found in intersectionLayers array');
        }
      } else {
        console.log('Intersection layer not found or map not initialized');
        
        // As a fallback, try to remove any layers/sources that might match this intersection
        if (map.current) {
          // Get all layers and sources from the map
          const mapStyle = map.current?.getStyle();
          const allLayers = mapStyle?.layers || [];
          const allSources = mapStyle?.sources ? Object.keys(mapStyle.sources) : [];
          
          console.log('Looking for any intersection layers/sources to remove as fallback');
          
          // Find and remove any layers that might be related to this intersection
          const intersectionLayerIds = allLayers
            .filter(layer => layer.id.includes('intersection'))
            .map(layer => layer.id);
          
          intersectionLayerIds.forEach(layerId => {
            try {
              if (map.current) {
                map.current.removeLayer(layerId);
                console.log('Removed intersection layer (fallback):', layerId);
              }
            } catch (e) {
              console.error('Error removing layer in fallback:', e);
            }
          });
          
          // Find and remove any sources that might be related to this intersection
          const intersectionSourceIds = allSources.filter(source => source.includes('intersection'));
          
          intersectionSourceIds.forEach(sourceId => {
            try {
              if (map.current) {
                map.current.removeSource(sourceId);
                console.log('Removed intersection source (fallback):', sourceId);
              }
            } catch (e) {
              console.error('Error removing source in fallback:', e);
            }
          });
        }
      }
    };
    
    window.addEventListener('intersection-removed', handleIntersectionRemoved as unknown as EventListener);
    
    // Handle selection removed events to also remove intersections
    const handleSelectionRemovedForIntersection = (event: CustomEvent) => {
      const { type, selection } = event.detail;
      
      // If a road or entity is removed, remove any intersections involving it
      if (['road', 'city', 'county', 'district', 'subdistrict', 'intersection'].includes(type)) {
        // For intersection type, we need to parse the selection to get road and entity names
        if (type === 'intersection') {
          // Parse the intersection name (format: "Road I-65 ∩ Entity Name")
          const parts = selection.split(' ∩ ');
          if (parts.length === 2) {
            const roadName = parts[0].trim();
            const entityName = parts[1].trim();
            
            // Create a unique ID for the intersection based on the names
            const intersectionId = `intersection-${roadName.replace(/\s+/g, '-')}-${entityName.replace(/\s+/g, '-')}`;
            
            console.log('Removing intersection with ID:', intersectionId);
            
            // Create a synthetic event to remove the intersection
            const intersectionRemovedEvent = new CustomEvent('intersection-removed', {
              detail: { id: intersectionId }
            });
            window.dispatchEvent(intersectionRemovedEvent);
          } else {
            console.error('Invalid intersection name format:', selection);
          }
        }
        // For roads and entities, find all intersections involving them
        else {
          intersectionLayers.forEach(layer => {
            if (layer.id.includes(selection.replace(/\s+/g, '-'))) {
              // Create a synthetic event to remove the intersection
              const intersectionRemovedEvent = new CustomEvent('intersection-removed', {
                detail: { id: layer.id }
              });
              window.dispatchEvent(intersectionRemovedEvent);
            }
          });
        }
      }
    };
    
    window.addEventListener('selection-removed', handleSelectionRemovedForIntersection as unknown as EventListener);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('intersection-requested', handleIntersectionRequest as unknown as EventListener);
      window.removeEventListener('intersection-removed', handleIntersectionRemoved as unknown as EventListener);
      window.removeEventListener('selection-removed', handleSelectionRemovedForIntersection as unknown as EventListener);
      window.removeEventListener('get-intersection-coordinates', handleGetIntersectionCoordinates as unknown as EventListener);
      window.removeEventListener('intersection-added', handleIntersectionAdded as unknown as EventListener);
    };
  }, []);
  
  // Initialize map
  useEffect(() => {
    if (map.current) return;

    if (mapContainer.current) {
      console.log('Initializing map...');
      mapboxgl.accessToken = 'pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng';
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/navigation-day-v1",
        center: [-86.1581, 39.7684],
        zoom: 7
      });
      
      // Initialize draw control
      drawRef.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true
        },
        defaultMode: 'simple_select'
      });
      
      // Add draw control to the map
      map.current.addControl(drawRef.current, 'top-right');

      // Add event listeners to track map loading
      map.current.on('load', () => {
        console.log('Map loaded successfully!');
      });
      
      // Add draw event listeners
      map.current.on('draw.create', (e: any) => {
        console.log('Draw created:', e.features);
        
        // Capture the drawn polygon coordinates
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates;
          const featureId = feature.id;
          
          // Dispatch event with polygon data to be received by LocationSelector
          const event = new CustomEvent('location-polygon-drawn', {
            detail: {
              featureId,
              type: feature.geometry.type,
              coordinates,
              boundingBox: getBoundingBox(coordinates[0]) // For polygons, use the outer ring
            }
          });
          window.dispatchEvent(event);
        }
      });
      
      map.current.on('draw.update', (e: any) => {
        console.log('Draw updated:', e.features);
        
        // Handle updated polygon
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates;
          const featureId = feature.id;
          
          // Dispatch event with updated polygon data
          const event = new CustomEvent('location-polygon-updated', {
            detail: {
              featureId,
              type: feature.geometry.type,
              coordinates,
              boundingBox: getBoundingBox(coordinates[0]) // For polygons, use the outer ring
            }
          });
          window.dispatchEvent(event);
        }
      });
      
      map.current.on('draw.delete', (e: any) => {
        console.log('Draw deleted:', e.features);
        
        // Notify that polygons were deleted
        if (e.features && e.features.length > 0) {
          const featureIds = e.features.map((f: any) => f.id);
          
          // Dispatch event with deleted polygon IDs
          const event = new CustomEvent('location-polygon-deleted', {
            detail: {
              featureIds
            }
          });
          window.dispatchEvent(event);
        }
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right");
      
      // Create a ResizeObserver to watch for container size changes
      resizeObserverRef.current = new ResizeObserver(() => {
        if (map.current) {
          // Slight delay to ensure the container has fully resized
          setTimeout(() => {
            if (map.current) {
              map.current.resize();
            }
          }, 0);
        }
      });
      
      // Start observing the map container
      resizeObserverRef.current.observe(mapContainer.current);
    }

    return () => {
      // Clean up the observer and map when component unmounts
      if (resizeObserverRef.current && mapContainer.current) {
        resizeObserverRef.current.unobserve(mapContainer.current);
        resizeObserverRef.current.disconnect();
      }
      
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);
  
  // Process and display map data when queryResults change
  useEffect(() => {
    if (!map.current || !queryResults) {
      console.log('Map or query results not available', { map: !!map.current, queryResults: !!queryResults });
      return;
    }
    
    console.log('Processing query results for map visualization');
    
    // Clear existing markers
    clearMarkers();
    
    // Reset visible datasets when clearing markers
    setVisibleDatasets(new Set());
    // Also reset selected datasets
    setSelectedDatasets(new Set());
    
    // Log the structure of the query results to help with debugging
    console.log('Query results structure:', {
      isArray: Array.isArray(queryResults.results),
      length: Array.isArray(queryResults.results) ? queryResults.results.length : 'N/A',
      keys: typeof queryResults.results === 'object' ? Object.keys(queryResults.results) : 'N/A'
    });
    
    // Track all datasets we've processed to avoid duplicates
    const processedDatasets = new Set<string>();
    
    // First, try to process as array format (results[0][tableName])
    if (queryResults.results && Array.isArray(queryResults.results) && queryResults.results.length > 0) {
      console.log('Processing results in array format');
      
      for (let i = 0; i < queryResults.results.length; i++) {
        const resultsObj = queryResults.results[i];
        
        if (resultsObj && typeof resultsObj === 'object') {
          // Process each dataset's results
          Object.entries(resultsObj).forEach(([tableName, items]) => {
            // Skip if we've already processed this dataset
            if (processedDatasets.has(tableName)) {
              console.log(`Skipping duplicate dataset: ${tableName}`);
              return;
            }
            
            processedDatasets.add(tableName);
            
            // Add to selected datasets if it has items, regardless of visibility
            if (Array.isArray(items) && items.length > 0) {
              setSelectedDatasets(prev => {
                const newSet = new Set(prev);
                newSet.add(tableName);
                return newSet;
              });
            }
            
            // Skip processing for map if not visible or not an array
            if (!Array.isArray(items) || !visibleLayers[tableName]) {
              console.log(`Skipping ${tableName}: Array check: ${Array.isArray(items)}, Visible: ${!!visibleLayers[tableName]}`);
              return;
            }
            
            console.log(`Processing ${items.length} items from dataset ${tableName}`);
            
            // Process each item in the dataset
            items.forEach((item: any) => {
              try {
                // Add the tableName to the item for reference
                const mapItem: MapData = {
                  ...item,
                  datasource_tablename: tableName
                };
                
                // Parse the readable_coordinates
                if (mapItem.readable_coordinates) {
                  try {
                    // Try to parse the coordinates
                    let coordinates;
                    
                    // Handle different coordinate formats
                    if (typeof mapItem.readable_coordinates === 'string') {
                      try {
                        // Try to parse as JSON
                        coordinates = JSON.parse(mapItem.readable_coordinates);
                        console.log('Successfully parsed coordinates as JSON:', coordinates);
                      } catch (jsonError) {
                        // If JSON parsing fails, try to handle as a string format
                        console.log('Failed to parse as JSON, trying alternative formats');
                        
                        // Check if it's a simple coordinate pair like "39.7684,-86.1581"
                        const coordMatch = mapItem.readable_coordinates.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
                        if (coordMatch) {
                          const lat = parseFloat(coordMatch[1]);
                          const lng = parseFloat(coordMatch[2]);
                          coordinates = {
                            type: 'Point',
                            coordinates: [lng, lat]
                          };
                          console.log('Parsed as simple coordinate pair:', coordinates);
                        } else {
                          console.error('Unrecognized coordinate format:', mapItem.readable_coordinates);
                          return;
                        }
                      }
                    } else if (typeof mapItem.readable_coordinates === 'object') {
                      // It's already an object, use it directly
                      coordinates = mapItem.readable_coordinates;
                      console.log('Coordinates already in object format:', coordinates);
                    }
                    
                    // Add marker to map if we have valid coordinates
                    if (coordinates) {
                      addMarkerToMap(mapItem, coordinates);
                    }
                  } catch (parseError) {
                    console.error('Error processing coordinates:', mapItem.readable_coordinates, parseError);
                  }
                } else {
                  // Check for alternative coordinate fields
                  const possibleCoordinateFields = ['coordinates', 'geometry', 'location', 'position', 'lat_long'];
                  
                  for (const field of possibleCoordinateFields) {
                    if (mapItem[field]) {
                      console.log(`Found alternative coordinate field: ${field}`, mapItem[field]);
                      try {
                        let coordinates;
                        if (typeof mapItem[field] === 'string') {
                          coordinates = JSON.parse(mapItem[field]);
                        } else {
                          coordinates = mapItem[field];
                        }
                        
                        addMarkerToMap(mapItem, coordinates);
                        break; // Exit the loop after successfully using an alternative field
                      } catch (e) {
                        console.error(`Error using alternative field ${field}:`, e);
                      }
                    }
                  }
                  
                  console.warn('Item missing coordinates:', mapItem);
                }
              } catch (error) {
                console.error('Error processing map item:', error);
              }
            });
          });
        }
      }
    }
    
    // Then, try to process as object format (results[tableName])
    if (queryResults.results && typeof queryResults.results === 'object') {
      console.log('Processing results in object format');
      
      // Alternative format: direct object with table names as keys
      Object.entries(queryResults.results).forEach(([tableName, items]) => {
        // Skip if we've already processed this dataset
        if (processedDatasets.has(tableName)) {
          console.log(`Skipping duplicate dataset: ${tableName}`);
          return;
        }
        
        processedDatasets.add(tableName);
        
        // Add to selected datasets if it has items, regardless of visibility
        if (Array.isArray(items) && items.length > 0) {
          setSelectedDatasets(prev => {
            const newSet = new Set(prev);
            newSet.add(tableName);
            return newSet;
          });
        }
        
        if (!Array.isArray(items) || !visibleLayers[tableName]) {
          console.log(`Skipping ${tableName}: Array check: ${Array.isArray(items)}, Visible: ${!!visibleLayers[tableName]}`);
          return;
        }
        
        console.log(`Processing ${items.length} items from dataset ${tableName}`);
        
        // Process each item in the dataset
        items.forEach((item: any) => {
          try {
            // Add the tableName to the item for reference
            const mapItem: MapData = {
              ...item,
              datasource_tablename: tableName
            };
            
            // Parse the readable_coordinates
            if (mapItem.readable_coordinates) {
              try {
                // Try to parse the coordinates
                let coordinates;
                
                // Handle different coordinate formats
                if (typeof mapItem.readable_coordinates === 'string') {
                  try {
                    // Try to parse as JSON
                    coordinates = JSON.parse(mapItem.readable_coordinates);
                    console.log('Successfully parsed coordinates as JSON:', coordinates);
                  } catch (jsonError) {
                    // If JSON parsing fails, try to handle as a string format
                    console.log('Failed to parse as JSON, trying alternative formats');
                    
                    // Check if it's a simple coordinate pair like "39.7684,-86.1581"
                    const coordMatch = mapItem.readable_coordinates.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
                    if (coordMatch) {
                      const lat = parseFloat(coordMatch[1]);
                      const lng = parseFloat(coordMatch[2]);
                      coordinates = {
                        type: 'Point',
                        coordinates: [lng, lat]
                      };
                      console.log('Parsed as simple coordinate pair:', coordinates);
                    } else {
                      console.error('Unrecognized coordinate format:', mapItem.readable_coordinates);
                      // Skip this item since we can't parse coordinates
                      return;
                    }
                  }
                } else if (typeof mapItem.readable_coordinates === 'object') {
                  // It's already an object, use it directly
                  coordinates = mapItem.readable_coordinates;
                  console.log('Coordinates already in object format:', coordinates);
                }
                
                // Add marker to map if we have valid coordinates
                if (coordinates) {
                  addMarkerToMap(mapItem, coordinates);
                }
              } catch (parseError) {
                console.error('Error processing coordinates:', mapItem.readable_coordinates, parseError);
              }
            } else {
              // Check for alternative coordinate fields
              const possibleCoordinateFields = ['coordinates', 'geometry', 'location', 'position', 'lat_long'];
              
              for (const field of possibleCoordinateFields) {
                if (mapItem[field]) {
                  console.log(`Found alternative coordinate field: ${field}`, mapItem[field]);
                  try {
                    let coordinates;
                    if (typeof mapItem[field] === 'string') {
                      coordinates = JSON.parse(mapItem[field]);
                    } else {
                      coordinates = mapItem[field];
                    }
                    
                    addMarkerToMap(mapItem, coordinates);
                    break; // Exit after successfully using an alternative field
                  } catch (e) {
                    console.error(`Error using alternative field ${field}:`, e);
                  }
                }
              }
              
              if (!mapItem.readable_coordinates && !possibleCoordinateFields.some(field => mapItem[field])) {
                console.warn('Item missing coordinates:', mapItem);
              }
            }
          } catch (error) {
            console.error('Error processing map item:', error);
          }
        });
      });
    } else {
      console.warn('Query results are not in the expected format:', queryResults);
    }
    
    // Fit bounds to markers if we have any
    if (markersRef.current.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      markersRef.current.forEach(marker => {
        bounds.extend(marker.getLngLat());
      });
      
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
      
      console.log(`Added ${markersRef.current.length} markers to the map`);
      // Call the onMarkerCountChange callback if provided
      if (onMarkerCountChange) {
        onMarkerCountChange(markersRef.current.length);
      }
    } else {
      console.log('No markers to display on the map');
    }
  }, [queryResults, visibleLayers]);
  
  // Function to add a marker to the map
  // Function to add a marker to the GeoJSON collection for clustering
  const addMarkerToMap = (item: MapData, coordinates: any) => {
    if (!map.current) return;
    
    console.log('Adding marker for item:', item.id, 'with coordinates:', coordinates);
    
    // Determine marker position based on geometry type or format
    let position: [number, number];
    
    if (coordinates.type === 'Point' && Array.isArray(coordinates.coordinates)) {
      // GeoJSON Point format
      position = [coordinates.coordinates[0], coordinates.coordinates[1]];
    } else if (coordinates.type === 'MultiLineString' && Array.isArray(coordinates.coordinates)) {
      // GeoJSON MultiLineString format - calculate centroid of all points
      if (coordinates.coordinates.length > 0) {
        // Collect all points from all line segments
        const allPoints: [number, number][] = [];
        coordinates.coordinates.forEach((lineString: number[][]) => {
          if (Array.isArray(lineString)) {
            lineString.forEach(point => {
              if (Array.isArray(point) && point.length >= 2) {
                allPoints.push([point[0], point[1]]);
              }
            });
          }
        });
        
        if (allPoints.length > 0) {
          // Calculate the centroid of all points
          const sumX = allPoints.reduce((sum, point) => sum + point[0], 0);
          const sumY = allPoints.reduce((sum, point) => sum + point[1], 0);
          position = [sumX / allPoints.length, sumY / allPoints.length];
          console.log('Using centroid from MultiLineString:', position);
          
          // Add the actual line geometry to the map
          if (map.current) {
            const lineId = `line-${item.id}`;
            
            // Check if this line already exists
            if (!map.current.getSource(lineId)) {
              // Add the line source
              map.current.addSource(lineId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {
                    id: item.id,
                    datasetName: item.datasource_tablename
                  },
                  geometry: {
                    type: 'MultiLineString',
                    coordinates: coordinates.coordinates
                  }
                }
              });
              
              // Add the line layer BEFORE the cluster layers to ensure it appears below the markers
              // First, get the first symbol layer ID to insert our layer before it
              const mapStyle = map.current.getStyle();
              let beforeLayerId: string | undefined;
              
              // Find the first symbol layer or cluster layer to place our line below
              if (mapStyle && mapStyle.layers) {
                // Try to find cluster layers first
                const clusterLayer = mapStyle.layers.find(layer => 
                  layer.id === CLUSTER_LAYER_ID || 
                  layer.id === CLUSTER_COUNT_LAYER_ID || 
                  layer.id === UNCLUSTERED_POINT_LAYER_ID
                );
                
                if (clusterLayer) {
                  beforeLayerId = clusterLayer.id;
                } else {
                  // Fall back to any symbol layer
                  const symbolLayer = mapStyle.layers.find(layer => layer.type === 'symbol');
                  if (symbolLayer) {
                    beforeLayerId = symbolLayer.id;
                  }
                }
              }
              
              // Get the color for this dataset
              const lineColor = getDatasetColor(
                item.datasource_tablename,
                item.event_type,
                item.priority_level
              );
              
              // Add the line layer with enhanced styling
              map.current.addLayer({
                id: lineId,
                type: 'line',
                source: lineId,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                  'visibility': 'visible'
                },
                paint: {
                  'line-color': lineColor,
                  'line-width': 4, // Slightly thicker line
                  'line-opacity': 0.8,
                  'line-dasharray': [0, 2, 3], // Add a dash pattern for emphasis
                  // Add a glow effect with line-blur
                  'line-blur': 1
                }
              }, beforeLayerId); // Insert before cluster/symbol layers to keep it below markers
              
              // Store the line ID for later removal if needed
              lineLayerIds.current.push(lineId);
            }
          }
        } else {
          console.error('No valid points found in MultiLineString:', coordinates);
          return;
        }
      } else {
        console.error('Invalid MultiLineString format:', coordinates);
        return;
      }
    } else if (Array.isArray(coordinates) && coordinates.length === 2) {
      // Simple array format [lng, lat]
      position = [coordinates[0], coordinates[1]];
    } else if (coordinates.lng !== undefined && coordinates.lat !== undefined) {
      // Object with lng/lat properties
      position = [coordinates.lng, coordinates.lat];
    } else if (coordinates.longitude !== undefined && coordinates.latitude !== undefined) {
      // Object with longitude/latitude properties
      position = [coordinates.longitude, coordinates.latitude];
    } else {
      console.error('Unsupported coordinate format:', coordinates);
      return;
    }
    
    // Get color based on dataset and event type
    const color = getDatasetColor(
      item.datasource_tablename,
      item.event_type,
      item.priority_level
    );
    
    // Get icon for the marker
    const icon = getMarkerIcon(item);
    
    // Check if this is a MultiLineString geometry
    const isMultiLineString = coordinates.type === 'MultiLineString';
    
    // For MultiLineString, adjust the color to make it distinguishable
    // Create a slightly darker shade for MultiLineString markers
    let markerColor = color;
    if (isMultiLineString) {
      // Darken the color by 15% for MultiLineString markers
      try {
        // If it's a hex color, darken it
        if (color.startsWith('#')) {
          // Convert hex to RGB
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          
          // Darken by 15%
          const darkenFactor = 0.85;
          const darkerR = Math.floor(r * darkenFactor);
          const darkerG = Math.floor(g * darkenFactor);
          const darkerB = Math.floor(b * darkenFactor);
          
          // Convert back to hex
          markerColor = `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
        }
      } catch (e) {
        console.error('Error darkening color:', e);
        // Fall back to original color if there's an error
        markerColor = color;
      }
    }
    
    // Create a GeoJSON feature for this marker
    const markerFeature = {
      type: 'Feature',
      properties: {
        markerId: item.id,
        color: markerColor,
        icon: icon,
        popupContent: createPopupContent(item),
        datasetName: item.datasource_tablename,
        // Add a special property for MultiLineString markers
        isMultiLineString: isMultiLineString,
        // Include all relevant fields for display in the clustered list
        event_type: item.event_type,
        priority_level: item.priority_level,
        event_status: item.event_status,
        event_name: item.event_name,
        event_classification_genre: item.event_classification_genre,
        event_classification_segment: item.event_classification_segment,
        device_label: item.device_label,
        rest_area_name: item.rest_area_name,
        message: item.message,
        city: item.city,
        date_start: item.date_start,
        approach_air_temp: item.approach_air_temp
        // Add any other fields that might be useful for display
      },
      geometry: {
        type: 'Point',
        coordinates: position
      }
    };
    
    // Add this feature to the GeoJSON source
    addFeatureToClusterSource(markerFeature);
    
    // Add this dataset to the visible datasets for the legend
    setVisibleDatasets(prev => {
      const newSet = new Set(prev);
      newSet.add(item.datasource_tablename);
      return newSet;
    });
  };
  
  // Function to add a feature to the cluster source
  const addFeatureToClusterSource = (feature: any) => {
    if (!map.current) return;
    
    // Get the existing source
    const source = map.current.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource;
    
    if (source) {
      // If the source exists, get its data
      const data = (source as any)._data as GeoJSON.FeatureCollection;
      
      // Check if there are already features at this coordinate
      const coords = JSON.stringify(feature.geometry.coordinates);
      const existingFeatures = data.features.filter(f => 
        f.geometry && f.geometry.type === 'Point' && JSON.stringify(f.geometry.coordinates) === coords
      );
      
      // Set the multipleEvents flag for this feature and update existing ones
      const willHaveMultiple = existingFeatures.length > 0;
      feature.properties.multipleEvents = willHaveMultiple;
      feature.properties.eventCount = existingFeatures.length + 1;
      
      if (willHaveMultiple) {
        // Update existing features to indicate multiple events
        data.features.forEach(f => {
          if (f.geometry && f.geometry.type === 'Point' && JSON.stringify(f.geometry.coordinates) === coords && f.properties) {
            f.properties.multipleEvents = true;
            f.properties.eventCount = existingFeatures.length + 1;
          }
        });
      }
      
      // Add the new feature
      data.features.push(feature);
      
      // Update the source
      source.setData(data);
    } else {
      // If the source doesn't exist yet, create it with the initial feature
      feature.properties.multipleEvents = false;
      feature.properties.eventCount = 1;
      initializeClusterSource([feature]);
    }
  };
  
  // Initialize the cluster source with features
  const initializeClusterSource = (initialFeatures: any[]) => {
    if (!map.current) return;
    
    // Group features by coordinates to identify locations with multiple events
    const coordinateGroups = new Map();
    initialFeatures.forEach(feature => {
      if (feature.geometry && feature.geometry.type === 'Point') {
        const coords = JSON.stringify(feature.geometry.coordinates);
        if (!coordinateGroups.has(coords)) {
          coordinateGroups.set(coords, []);
        }
        coordinateGroups.get(coords).push(feature);
      }
    });
    
    // Add a property to indicate multiple events at the same location
    initialFeatures.forEach(feature => {
      if (feature.geometry && feature.geometry.type === 'Point' && feature.properties) {
        const coords = JSON.stringify(feature.geometry.coordinates);
        const count = coordinateGroups.has(coords) ? coordinateGroups.get(coords).length : 1;
        feature.properties.multipleEvents = count > 1;
        feature.properties.eventCount = count;
      }
    });
    
    // Create a GeoJSON source with the initial features
    // Create a custom cluster properties function to determine the dominant dataset in each cluster
    map.current.addSource(CLUSTER_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: initialFeatures
      },
      cluster: true,
      clusterMaxZoom: 14, // Max zoom to cluster points on
      clusterRadius: 50, // Radius of each cluster when clustering points
      clusterProperties: {
        // Count occurrences of each dataset type
        'traffic_events_count': ['+', ['case', ['==', ['get', 'datasetName'], 'traffic_events'], 1, 0]],
        'lane_blockage_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'lane_blockage_info'], 1, 0]],
        'rest_area_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'rest_area_info'], 1, 0]],
        'dynamic_message_sign_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'dynamic_message_sign_info'], 1, 0]],
        'traffic_parking_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'traffic_parking_info'], 1, 0]],
        'travel_time_system_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'travel_time_system_info'], 1, 0]],
        'variable_speed_limit_sign_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'variable_speed_limit_sign_info'], 1, 0]],
        'social_events_count': ['+', ['case', ['==', ['get', 'datasetName'], 'social_events'], 1, 0]],
        'weather_info_count': ['+', ['case', ['==', ['get', 'datasetName'], 'weather_info'], 1, 0]],
        // Store a sample of each dataset type for determining the dominant dataset
        'traffic_events_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'traffic_events'], 1, 0]],
        'lane_blockage_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'lane_blockage_info'], 1, 0]],
        'rest_area_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'rest_area_info'], 1, 0]],
        'dynamic_message_sign_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'dynamic_message_sign_info'], 1, 0]],
        'traffic_parking_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'traffic_parking_info'], 1, 0]],
        'travel_time_system_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'travel_time_system_info'], 1, 0]],
        'variable_speed_limit_sign_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'variable_speed_limit_sign_info'], 1, 0]],
        'social_events_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'social_events'], 1, 0]],
        'weather_info_sample': ['max', ['case', ['==', ['get', 'datasetName'], 'weather_info'], 1, 0]]
      }
    });
    
    // Add a layer for the clusters
    map.current.addLayer({
      id: CLUSTER_LAYER_ID,
      type: 'circle',
      source: CLUSTER_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        // Determine the dominant dataset based on counts and use its color
        'circle-color': [
          'let',
          'max_count',
          // Find the maximum count among all dataset types
          ['max',
            ['get', 'traffic_events_count'],
            ['get', 'lane_blockage_info_count'],
            ['get', 'rest_area_info_count'],
            ['get', 'dynamic_message_sign_info_count'],
            ['get', 'traffic_parking_info_count'],
            ['get', 'travel_time_system_info_count'],
            ['get', 'variable_speed_limit_sign_info_count'],
            ['get', 'social_events_count'],
            ['get', 'weather_info_count']
          ],
          // Now determine which dataset has that max count
          ['case',
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'traffic_events_count']]], 
            colorBlindFriendlyColors.traffic_events,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'lane_blockage_info_count']]], 
            colorBlindFriendlyColors.lane_blockage_info,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'rest_area_info_count']]], 
            colorBlindFriendlyColors.rest_area_info,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'dynamic_message_sign_info_count']]], 
            colorBlindFriendlyColors.dynamic_message_sign_info,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'traffic_parking_info_count']]], 
            colorBlindFriendlyColors.traffic_parking_info,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'travel_time_system_info_count']]], 
            colorBlindFriendlyColors.travel_time_system_info,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'variable_speed_limit_sign_info_count']]], 
            colorBlindFriendlyColors.variable_speed_limit_sign_info,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'social_events_count']]], 
            colorBlindFriendlyColors.social_events,
            
            ['all', ['>', ['var', 'max_count'], 0], ['==', ['var', 'max_count'], ['get', 'weather_info_count']]], 
            colorBlindFriendlyColors.weather_info,
            
            // Default color if no dominant dataset is found
            colorBlindFriendlyColors.default
          ]
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,    // radius 20px for point count 0-9
          10,    // threshold
          30,    // radius 30px for point count 10-49
          50,    // threshold
          40     // radius 40px for point count 50+
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
    
    // Add a layer for the cluster counts
    map.current.addLayer({
      id: CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: CLUSTER_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 14
      },
      paint: {
        'text-color': '#ffffff'
      }
    });
    
    // Add a layer for individual points (unclustered)
    map.current.addLayer({
      id: UNCLUSTERED_POINT_LAYER_ID,
      type: 'circle',
      source: CLUSTER_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        // Use the color property from the feature
        'circle-color': ['get', 'color'],
        // Adjust radius based on whether it's a MultiLineString marker
        'circle-radius': [
          'case',
          ['get', 'isMultiLineString'],
          12,  // Larger radius for MultiLineString markers
          10   // Normal radius for regular markers
        ],
        // Adjust stroke width based on marker type
        'circle-stroke-width': [
          'case',
          ['all', ['get', 'multipleEvents'], ['get', 'isMultiLineString']],
          5,  // Thickest stroke for multiple events on MultiLineString
          ['get', 'multipleEvents'],
          4,  // Thicker stroke for multiple events
          ['get', 'isMultiLineString'],
          3,  // Medium stroke for MultiLineString
          2   // Normal stroke for single events
        ],
        // Add a distinct color for multiple events and MultiLineString
        'circle-stroke-color': [
          'case',
          ['all', ['get', 'multipleEvents'], ['get', 'isMultiLineString']],
          '#ffcc00',  // Yellow stroke for multiple events on MultiLineString
          ['get', 'multipleEvents'],
          '#ff3b30',  // Red stroke for multiple events
          ['get', 'isMultiLineString'],
          '#000000',  // Black stroke for MultiLineString
          '#ffffff'   // White stroke for regular markers
        ],
        // Adjust opacity based on marker type
        'circle-stroke-opacity': [
          'case',
          ['get', 'isMultiLineString'],
          1.0,  // Full opacity for MultiLineString
          ['get', 'multipleEvents'],
          0.9,  // High opacity for multiple events
          0.8   // Normal opacity for single events
        ]
      }
    });
    
    // Add a layer for point counts (to show the count for all points)
    map.current.addLayer({
      id: 'single-point-count',
      type: 'symbol',
      source: CLUSTER_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      layout: {
        // Use eventCount if available, otherwise show '1'
        'text-field': [
          'case',
          ['has', 'eventCount'],
          ['get', 'eventCount'],
          '1'
        ],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 14
      },
      paint: {
        'text-color': '#ffffff'
      }
    });
    
    // Add click event for clusters
    map.current.on('click', CLUSTER_LAYER_ID, (e) => {
      const features = map.current?.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER_ID] });
      if (!features || features.length === 0) return;
      
      const clusterId = features[0].properties?.cluster_id;
      if (!clusterId) return;
      
      const source = map.current?.getSource(CLUSTER_SOURCE_ID) as mapboxgl.GeoJSONSource;
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || !map.current) return;
        
        // Ensure zoom is a number
        const safeZoom = typeof zoom === 'number' ? zoom : map.current.getZoom() + 1;
        
        map.current.easeTo({
          center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
          zoom: safeZoom
        });
      });
    });
    
    // Add click event for individual points - handle multiple points at same location
    map.current.on('click', UNCLUSTERED_POINT_LAYER_ID, (e) => {
      const features = map.current?.queryRenderedFeatures(e.point, { layers: [UNCLUSTERED_POINT_LAYER_ID] });
      if (!features || features.length === 0) return;
      
      // Get coordinates from the first feature
      const coordinates = (features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];
      
      if (features.length === 1) {
        // If only one feature, show its popup directly
        const popupContent = features[0].properties?.popupContent;
        
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(popupContent)
          .addTo(map.current!);
      } else {
        // Multiple features at the same location - create a list popup
        let listContent = `
          <div class="popup-container" style="font-family: system-ui, -apple-system, sans-serif; max-width: 350px;">
            <style>
              .mapboxgl-popup-close-button {
                font-size: 22px !important;
                font-weight: bold !important;
                color: #4a5568 !important;
                right: 8px !important;
                top: 8px !important;
                padding: 4px 8px !important;
                border-radius: 50% !important;
                line-height: 22px !important;
                width: 30px !important;
                height: 30px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                background: rgba(237, 242, 247, 0.8) !important;
                transition: all 0.2s ease !important;
              }
              .mapboxgl-popup-close-button:hover {
                background: rgba(226, 232, 240, 1) !important;
                color: #1a202c !important;
              }
              .multi-popup-header {
                padding: 12px 16px;
                background-color: #f8f9fa;
                border-bottom: 1px solid #e2e8f0;
                border-radius: 8px 8px 0 0;
                position: sticky;
                top: 0;
                z-index: 10;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
              }
              .multi-popup-content {
                padding: 16px;
                max-height: 300px;
                overflow-y: auto;
              }
              .marker-list {
                list-style: none;
                padding: 0;
                margin: 0;
              }
              .marker-list-item {
                display: flex;
                align-items: flex-start;
                padding: 10px 12px;
                border-radius: 6px;
                margin-bottom: 8px;
                background-color: #f8f9fa;
                cursor: pointer;
                transition: all 0.2s ease;
              }
              .marker-list-item:hover {
                background-color: #f7fafc;
                border-color: #cbd5e0;
              }
              .marker-icon {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 10px;
                color: white;
                font-size: 14px;
                flex-shrink: 0;
              }
              .marker-title {
                font-weight: 600;
                color: #2d3748;
                font-size: 14px;
                line-height: 1.3;
              }
              .marker-subtitle {
                color: #4a5568;
                font-size: 12px;
                margin-top: 2px;
                line-height: 1.3;
              }
              .marker-date {
                color: #4a5568;
                font-size: 11px;
                margin-top: 2px;
                line-height: 1.3;
                font-style: italic;
              }
              .marker-multiple-indicator {
                font-size: 11px;
                color: #e53e3e;
                margin-top: 2px;
                font-weight: 600;
                background-color: #fff5f5;
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid #fed7d7;
              }
              .marker-dataset {
                font-size: 11px;
                color: #718096;
                margin-top: 3px;
                background-color: #edf2f7;
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 14px;
                color: #2d3748;
              }
              .marker-subtitle {
                font-size: 12px;
                color: #718096;
                margin-top: 2px;
              }
            </style>
            <div class="multi-popup-header">
              <div style="display: flex; align-items: center;">
                <div style="font-size: 24px; margin-right: 10px;">📍</div>
                <div style="font-size: 18px; font-weight: bold; color: #2d3748;">${features.length} Items at this Location</div>
              </div>
            </div>
            <div class="multi-popup-content">
              <div style="margin-bottom: 12px; font-size: 14px; color: #4a5568;">Select an item to view details:</div>
              <ul class="marker-list">
        `;
        
        // Add each feature as a list item
        features.forEach((feature, index) => {
          const props = feature.properties || {};
          const datasetName = props.datasetName || 'Unknown';
          
          // Determine what to show as the primary title
          let title = '';
          // First try to use specific event fields based on dataset type
          if (props.event_name) title = props.event_name;
          else if (props.event_type) title = props.event_type;
          else if (props.device_label) title = props.device_label;
          else if (props.rest_area_name) title = props.rest_area_name;
          else if (props.message) title = props.message;
          else title = datasetName;
          
          // If the title is too long, truncate it
          if (title.length > 40) {
            title = title.substring(0, 37) + '...';
          }
          
          // Determine what to show as subtitle
          let subtitle = '';
          // First try to use specific fields based on dataset type
          if (props.event_classification_genre) subtitle = props.event_classification_genre;
          else if (props.event_status) subtitle = `Status: ${props.event_status}`;
          else if (props.city) subtitle = props.city;
          else if (props.approach_air_temp) subtitle = `${props.approach_air_temp}\u00b0F`;
          else if (props.priority_level) subtitle = `Priority: ${props.priority_level}`;
          
          // Format date if available
          let dateString = '';
          if (props.date_start) {
            try {
              const date = new Date(props.date_start);
              dateString = date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            } catch (e) {
              dateString = props.date_start;
            }
          }
          
          // Get the color for the icon
          const color = props.color || '#3b82f6';
          
          // Create a data attribute to store the popup content
          const popupContentAttr = `data-popup-content-${index}`;
          
          // Get a dataset-specific icon
          let icon = '📌';
          if (datasetName.toLowerCase().includes('weather')) icon = '🌤️';
          else if (datasetName.toLowerCase().includes('traffic')) icon = '🚗';
          else if (datasetName.toLowerCase().includes('social')) icon = '🎭';
          else if (datasetName.toLowerCase().includes('rest')) icon = '🛌';
          else if (datasetName.toLowerCase().includes('truck')) icon = '🚚';
          else if (datasetName.toLowerCase().includes('lane')) icon = '🚧';
          else if (datasetName.toLowerCase().includes('speed')) icon = '⚠️';
          else if (datasetName.toLowerCase().includes('dms')) icon = '📋';
          
          // Get a human-readable dataset name
          let readableDatasetName = datasetName;
          if (datasetName.includes('_')) {
            // Convert snake_case to Title Case
            readableDatasetName = datasetName
              .split('_')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');
          }
          
          // Add the list item
          listContent += `
            <li class="marker-list-item" id="marker-item-${index}">
              <div class="marker-icon" style="background-color: ${color};">${icon}</div>
              <div style="width: 100%;">
                <div class="marker-title">${title}</div>
                ${subtitle ? `<div class="marker-subtitle">${subtitle}</div>` : ''}
                ${dateString ? `<div class="marker-date">${dateString}</div>` : ''}
                <div class="marker-dataset">${readableDatasetName}</div>
              </div>
            </li>
            <div id="${popupContentAttr}" style="display:none;">${props.popupContent}</div>
          `;
        });
        
        listContent += `
              </ul>
            </div>
          </div>
        `;
        
        // Create a single popup that we'll reuse for all content
        // Remove any existing popup first
        if (activePopup) {
          activePopup.remove();
        }
        
        // Create a new popup and store the reference
        activePopup = new mapboxgl.Popup({
          maxWidth: '350px',
          className: 'list-popup',
          anchor: 'top'
        })
          .setLngLat(coordinates)
          .setHTML(listContent)
          .addTo(map.current!);
          
        // When the popup is closed, clear the reference
        activePopup.on('close', () => {
          activePopup = null;
        });
        
        // Add click event listeners to the list items after the popup is added to the DOM
        // We need to do this after the popup is created because we need the elements to exist in the DOM
        setTimeout(() => {
          features.forEach((feature, index) => {
            const element = document.getElementById(`marker-item-${index}`);
            if (element) {
              element.addEventListener('click', () => {
                // Get the popup content
                const popupContentEl = document.getElementById(`data-popup-content-${index}`);
                if (!popupContentEl) return;
                
                const popupContent = popupContentEl.innerHTML;
                
                // Store the list content for back navigation
                const originalListContent = listContent;
                
                // Add back button to the popup content
                const enhancedPopupContent = `
                  <div class="popup-container" style="font-family: system-ui, -apple-system, sans-serif; max-width: 350px;">
                    <style>
                      .back-button {
                        position: absolute;
                        top: 16px;
                        left: 16px;
                        background: rgba(237, 242, 247, 0.95);
                        border: none;
                        border-radius: 50%;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        font-size: 20px;
                        font-weight: 500;
                        color: #2d3748;
                        z-index: 20;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                      }
                      .back-button:hover {
                        background: rgba(226, 232, 240, 1);
                        color: #1a202c;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                      }
                      .popup-with-back-button {
                        padding-left: 12px;
                        margin-top: 4px;
                      }
                    </style>
                    <button class="back-button" id="back-to-list-button">&larr;</button>
                    <div class="popup-with-back-button">
                      ${popupContent}
                    </div>
                  </div>
                `;
                
                // Update the existing popup content instead of creating a new one
                if (activePopup && map.current) {
                  // Change the class name to reflect the content type
                  const popupElement = activePopup.getElement();
                  if (popupElement) {
                    popupElement.classList.remove('list-popup');
                    popupElement.classList.add('detail-popup');
                  }
                  
                  // Update the HTML content
                  activePopup.setHTML(enhancedPopupContent);
                  
                  // Add event listener for the back button after content is updated
                  setTimeout(() => {
                    const backButton = document.getElementById('back-to-list-button');
                    if (backButton) {
                      backButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Update popup content back to list view
                        if (activePopup) {
                          // Change class back to list popup
                          const popupElement = activePopup.getElement();
                          if (popupElement) {
                            popupElement.classList.remove('detail-popup');
                            popupElement.classList.add('list-popup');
                          }
                          
                          // Set the HTML back to the list content
                          activePopup.setHTML(originalListContent);
                          
                          // Re-add the click event listeners to the list items
                          setTimeout(() => {
                            features.forEach((feature, idx) => {
                              const element = document.getElementById(`marker-item-${idx}`);
                              if (element) {
                                element.addEventListener('click', function() {
                                  const popupContentEl = document.getElementById(`data-popup-content-${idx}`);
                                  if (!popupContentEl) return;
                                  
                                  const itemPopupContent = popupContentEl.innerHTML;
                                  
                                  // Update popup with item detail content
                                  if (activePopup) {
                                    // Add detail class
                                    const popupElement = activePopup.getElement();
                                    if (popupElement) {
                                      popupElement.classList.remove('list-popup');
                                      popupElement.classList.add('detail-popup');
                                    }
                                    
                                    // Create the enhanced content with back button
                                    const enhancedItemPopupContent = `
                                      <div class="popup-container" style="font-family: system-ui, -apple-system, sans-serif; max-width: 350px;">
                                        <style>
                                          .back-button {
                                            position: absolute;
                                            top: 16px;
                                            left: 16px;
                                            background: rgba(237, 242, 247, 0.95);
                                            border: none;
                                            border-radius: 50%;
                                            width: 36px;
                                            height: 36px;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            cursor: pointer;
                                            font-size: 20px;
                                            font-weight: 500;
                                            color: #2d3748;
                                            z-index: 20;
                                            transition: all 0.2s ease;
                                            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                                          }
                                          .back-button:hover {
                                            background: rgba(226, 232, 240, 1);
                                            color: #1a202c;
                                            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                                          }
                                          .popup-with-back-button {
                                            padding-left: 12px;
                                            margin-top: 4px;
                                          }
                                        </style>
                                        <button class="back-button" id="back-to-list-button-inner">&larr;</button>
                                        <div class="popup-with-back-button">
                                          ${itemPopupContent}
                                        </div>
                                      </div>
                                    `;
                                    
                                    // Update the HTML content
                                    activePopup.setHTML(enhancedItemPopupContent);
                                    
                                    // Add event listener for the back button
                                    setTimeout(() => {
                                      const innerBackButton = document.getElementById('back-to-list-button-inner');
                                      if (innerBackButton) {
                                        innerBackButton.addEventListener('click', (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          
                                          // Update popup content back to list view
                                          if (activePopup) {
                                            // Change class back to list popup
                                            const popupElement = activePopup.getElement();
                                            if (popupElement) {
                                              popupElement.classList.remove('detail-popup');
                                              popupElement.classList.add('list-popup');
                                              activePopup.setHTML(originalListContent);
                                            }
                                          }
                                          
                                          // Re-add click handlers to list items
                                          // This is recursive but in a real app would be refactored
                                          setTimeout(() => {
                                            features.forEach((feature, j) => {
                                              const listItem = document.getElementById(`marker-item-${j}`);
                                              if (listItem) {
                                                // Add click handler again
                                                // This is getting deep in recursion and would be refactored
                                                // in a production environment
                                                listItem.addEventListener('click', function() {
                                                  // Implementation omitted to avoid excessive nesting
                                                  // In a real app, this would use a better pattern
                                                });
                                              }
                                            });
                                          }, 100);
                                        });
                                      }
                                    }, 100);
                                  }
                                });
                              }
                            });
                          }, 100);
                        }
                      });
                    }
                  }, 100);
                }
              });
            }
          });
        }, 100); // Small delay to ensure the DOM is ready
        
        // The popup is created above after the listContent is fully constructed
      }
    });
    
    // Listen for custom event to show individual item popups
    window.addEventListener('show-item-popup', ((event: CustomEvent) => {
      if (!map.current) return;
      
      const { coordinates, content } = event.detail;
      
      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(content)
        .addTo(map.current);
    }) as EventListener);
    
    // Change cursor when hovering over clusters or points
    map.current.on('mouseenter', CLUSTER_LAYER_ID, () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', CLUSTER_LAYER_ID, () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
    
    map.current.on('mouseenter', UNCLUSTERED_POINT_LAYER_ID, () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', UNCLUSTERED_POINT_LAYER_ID, () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
  };
  
  // Function to add a road line to the map
  const addRoadToMap = (name: string, coordinates: number[][][]) => {
    if (!map.current) return;
    
    console.log('Adding road line for:', name, 'with coordinates:', coordinates);
    
    // Create unique IDs for this road's source and layer
    const sourceId = `road-source-${roadSourceCounter}`;
    const layerId = `road-layer-${roadSourceCounter}`;
    roadSourceCounter++;
    
    // Create a GeoJSON source for the road
    const source: mapboxgl.AnySourceData = {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {
          name: name
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: coordinates
        }
      }
    };
    
    // Add the source to the map
    map.current.addSource(sourceId, source);
    
    // Add a line layer to display the road
    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#FF6B6B', // Distinct color for roads
        'line-width': 5,
        'line-opacity': 0.8
      }
    });
    
    // Store reference to the layer and source for later cleanup
    roadLayersRef.current.push({sourceId, layerId});
    
    // Add a popup when clicking on the road
    map.current.on('click', layerId, (e) => {
      if (e.features && e.features.length > 0) {
        const coordinates = e.lngLat;
        
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(`
            <div class="p-3">
              <h3 class="text-lg font-bold mb-2">${name}</h3>
              <div class="text-sm">
                <p>Road</p>
              </div>
            </div>
          `)
          .addTo(map.current!);
      }
    });
    
    // Change cursor to pointer when hovering over the road
    map.current.on('mouseenter', layerId, () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    
    map.current.on('mouseleave', layerId, () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
    
    // Fit the map to the road's coordinates
    const bounds = new mapboxgl.LngLatBounds();
    
    // Add all coordinates to the bounds
    coordinates.forEach(lineString => {
      lineString.forEach(point => {
        bounds.extend([point[0], point[1]]);
      });
    });
    
    // Fit the map to the bounds with padding
    map.current.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15
    });
  };
  
  // Function to add a POI marker to the map
  const addPOIMarkerToMap = (name: string, coordinates: {lat: number, lng: number}, radiusMiles?: number) => {
    if (!map.current) return;
    
    console.log('Adding POI marker for:', name, 'at coordinates:', coordinates, 'with radius:', radiusMiles);
    
    // Create marker element with special styling for POIs
    const markerEl = document.createElement('div');
    markerEl.className = 'poi-marker';
    markerEl.setAttribute('data-poi-name', name); // Store the POI name directly on the element
    markerEl.setAttribute('data-poi-type', 'selection'); // Mark as selection marker
    markerEl.style.backgroundColor = '#4A6FE3'; // Distinct blue color for POIs
    markerEl.style.width = '28px';
    markerEl.style.height = '28px';
    markerEl.style.borderRadius = '50%';
    markerEl.style.display = 'flex';
    markerEl.style.alignItems = 'center';
    markerEl.style.justifyContent = 'center';
    markerEl.style.border = '3px solid white';
    markerEl.style.boxShadow = '0 3px 6px rgba(0,0,0,0.4)';
    
    // Add icon or label for POI
    const iconEl = document.createElement('div');
    iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
    iconEl.style.color = 'white';
    markerEl.appendChild(iconEl);
    
    // Create popup with POI information
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px'
    }).setHTML(`
      <div class="p-3">
        <h3 class="text-lg font-bold mb-2">${name}</h3>
        <div class="text-sm">
          <p>Point of Interest</p>
          <p>Coordinates: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}</p>
        </div>
      </div>
    `);
    
    // Add marker to map
    const marker = new mapboxgl.Marker(markerEl)
      .setLngLat([coordinates.lng, coordinates.lat])
      .setPopup(popup);
    
    if (map.current) {
      marker.addTo(map.current);
      
      // Store reference for later cleanup
      poiMarkersRef.current.push(marker);
      
      // Fly to the marker location
      map.current.flyTo({
        center: [coordinates.lng, coordinates.lat],
        zoom: 14
      });
      
      // If radius is provided, add a circle around the POI
      if (radiusMiles && radiusMiles > 0) {
        // Create a point using Turf.js
        const point = turf.point([coordinates.lng, coordinates.lat]);
        
        // Create a circle with the specified radius in miles
        // Note: turf.buffer takes radius in kilometers, so convert miles to km
        const radiusKm = radiusMiles * 1.60934;
        const circle = turf.buffer(point, radiusKm, { units: 'kilometers' });
        
        // Create unique IDs for this circle's source and layer
        // Include the POI name in the IDs to make them easier to find later
        const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const sourceId = `poi-circle-source-${sanitizedName}-${poiCircleCounter}`;
        const layerId = `poi-circle-layer-${sanitizedName}-${poiCircleCounter}`;
        poiCircleCounter++;
        
        console.log(`Creating circle layer ${layerId} for POI: ${name}`);
        
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
            'fill-color': '#4A6FE3',
            'fill-opacity': 0.2,
            'fill-outline-color': '#4A6FE3'
          }
        });
        
        // Store reference to the layer and source for later cleanup
        poiCircleLayersRef.current.push({
          sourceId, 
          layerId, 
          poiName: name,
          sanitizedName: sanitizedName
        });
        
        console.log(`Added circle layer reference: ${layerId} for POI: ${name}`);
        console.log('Current circle layers:', poiCircleLayersRef.current.map(c => ({ 
          name: c.poiName, 
          layerId: c.layerId, 
          sanitizedName: c.sanitizedName 
        })));
        
        // Add a popup when hovering over the circle
        map.current.on('mouseenter', layerId, () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = 'pointer';
          }
        });
        
        map.current.on('mouseleave', layerId, () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = '';
          }
        });
      }
    }
  };
  
  // Color-blind friendly color scheme
  // Based on ColorBrewer and Okabe-Ito color schemes which are designed to be distinguishable by those with color vision deficiencies
  const colorBlindFriendlyColors: Record<string, string> = {
    // Main colors for datasets
    'traffic_events': '#0072B2',       // Blue
    'lane_blockage_info': '#E69F00',   // Orange
    'rest_area_info': '#009E73',       // Green
    'dynamic_message_sign_info': '#CC79A7', // Pink
    'traffic_parking_info': '#56B4E9',  // Light blue
    'travel_time_system_info': '#D55E00', // Red-orange
    'variable_speed_limit_sign_info': '#F0E442', // Yellow
    'social_events': '#CC6677',       // Rose
    'weather_info': '#882255',        // Purple
    'default': '#999999'              // Gray
  };
  
  // Function to get dataset color
  const getDatasetColor = (tableName: string, eventType?: string, priorityLevel?: number): string => {
    // If we have a color defined for this table, use it
    if (colorBlindFriendlyColors[tableName]) {
      return colorBlindFriendlyColors[tableName];
    }
    
    // Special case for traffic events - color by event type if available
    if (tableName === 'traffic_events' && eventType) {
      const eventColors: Record<string, string> = {
        'ACCIDENT': '#D55E00',         // Red-orange
        'VEHICLE FIRE': '#CC79A7',     // Pink
        'CONSTRUCTION': '#E69F00',     // Orange
        'CONGESTION': '#56B4E9',       // Light blue
        'SPECIAL EVENT': '#009E73',    // Green
        'WEATHER': '#0072B2',          // Blue
        'default': colorBlindFriendlyColors.traffic_events
      };
      
      const normalizedEventType = eventType.toUpperCase();
      return eventColors[normalizedEventType] || eventColors.default;
    }
    
    // Fall back to default color for dataset
    return colorBlindFriendlyColors.default;
  };
  
  // Track which datasets are currently visible on the map for the legend
  const [visibleDatasets, setVisibleDatasets] = useState<Set<string>>(new Set());
  
  // Track which datasets are selected (regardless of visibility)
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  
  // Function to get marker icon based on dataset type
  const getMarkerIcon = (item: MapData): string => {
    const { datasource_tablename, event_type } = item;
    
    // Custom icons for each dataset type
    switch (datasource_tablename) {
      case 'traffic_events':
        // Different icons based on event type
        if (event_type) {
          const normalizedEventType = event_type.toUpperCase();
          
          switch (normalizedEventType) {
            case 'ACCIDENT':
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>';
            case 'VEHICLE FIRE':
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
            case 'CONSTRUCTION':
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="8" rx="1"></rect><path d="M17 14v7"></path><path d="M7 14v7"></path><path d="M17 3v3"></path><path d="M7 3v3"></path><path d="M10 14 2.3 6.3"></path><path d="m14 6 7.7 7.7"></path><path d="m8 6 8 8"></path></svg>';
            case 'CONGESTION':
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>';
            case 'SPECIAL EVENT':
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Z"></path><path d="M2 8h20"></path><path d="M20 8v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"></path><path d="M8 12h8"></path><path d="M8 16h4"></path></svg>';
            case 'WEATHER':
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>';
            default:
              return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
          }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        
      case 'lane_blockage_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M8 21V5"></path><path d="M12 21V5"></path><path d="M16 21V5"></path></svg>';
        
      case 'rest_area_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"></path><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"></path><path d="M12 12h.01"></path></svg>';
        
      case 'dynamic_message_sign_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>';
        
      case 'traffic_parking_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path></svg>';
        
      case 'travel_time_system_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
        
      case 'variable_speed_limit_sign_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 10-10 10-10-10Z"></path></svg>';
        
      case 'social_events':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V8.5a4.5 4.5 0 0 0-9 0v11.5"></path><path d="M2 19v-4a6 6 0 0 1 6-6h8a6 6 0 0 1 6 6v4"></path><path d="m9 8 3-3 3 3"></path></svg>';
        
      case 'weather_info':
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"></path><path d="M12 16v6"></path></svg>';
        
      default:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }
  };
  
  // Function to create popup content
  const createPopupContent = (item: MapData): string => {
    const { datasource_tablename } = item;
    
    // Get display name for the dataset
    let datasetDisplayName = datasource_tablename;
    let datasetIcon = '📍'; // Default icon
    
    // Use a more user-friendly name and assign appropriate icons
    switch(datasource_tablename) {
      case 'traffic_events': 
        datasetDisplayName = 'Traffic Events'; 
        datasetIcon = '🚧';
        break;
      case 'lane_blockage_info': 
        datasetDisplayName = 'Lane Blockages'; 
        datasetIcon = '🚫';
        break;
      case 'rest_area_info': 
        datasetDisplayName = 'Rest Areas'; 
        datasetIcon = '🅿️';
        break;
      case 'dynamic_message_sign_info': 
        datasetDisplayName = 'Dynamic Message Signs'; 
        datasetIcon = '📢';
        break;
      case 'truck_parking_info': 
        datasetDisplayName = 'Truck Parking'; 
        datasetIcon = '🚚';
        break;
      case 'travel_time_system_info': 
        datasetDisplayName = 'Travel Time Signs'; 
        datasetIcon = '⏱️';
        break;
      case 'variable_speed_limit_sign_info': 
        datasetDisplayName = 'Variable Speed Limit Signs'; 
        datasetIcon = '🚦';
        break;
      case 'social_events': 
        datasetDisplayName = 'Social Events'; 
        datasetIcon = '🎭';
        break;
      case 'weather_info': 
        datasetDisplayName = 'Weather Information'; 
        datasetIcon = '🌦️';
        break;
    }
    
    // Helper function to format dates nicely
    const formatDate = (dateString: string) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        return dateString;
      }
    };
    
    // Helper function to format values nicely
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) return 'N/A';
      
      // Format based on type
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      } else if (typeof value === 'number') {
        // Format numbers with 2 decimal places if they have decimals
        return Number.isInteger(value) ? value.toString() : value.toFixed(2);
      } else if (typeof value === 'string') {
        // Check if it's a date string
        if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
          return formatDate(value);
        }
        return value;
      } else if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (e) {
          return '[Complex Object]';
        }
      }
      
      return String(value);
    };
    
    // Organize fields into categories for better display
    const categories: {
      primary: string[];
      location: string[];
      time: string[];
      details: string[];
    } = {
      primary: ['event_type', 'event_name', 'priority_level', 'event_status', 'device_label'],
      location: ['route', 'start_mile_marker', 'end_mile_marker', 'city', 'county', 'district', 'subdistrict', 'region'],
      time: ['date_start', 'date_end', 'date_update', 'data_retrieval_timestamp'],
      details: [] // Will hold all other fields
    };
    
    // Excluded properties that won't be shown
    const excludedProps = [
      'id', 'datasource_metadata_id', 'datasource_tablename', 
      'readable_coordinates', 'coordinates', 'geometry',
      'origin_datasource_id' // Usually not meaningful to users
    ];
    
    // Sort remaining properties into the details category
    for (const [key, value] of Object.entries(item)) {
      if (!excludedProps.includes(key) && 
          !categories.primary.includes(key) && 
          !categories.location.includes(key) && 
          !categories.time.includes(key) && 
          value !== null && 
          value !== undefined) {
        categories.details.push(key as string);
      }
    }
    
    // Start with a styled container and header with scrollable content
    let content = `
      <div class="popup-container" style="font-family: system-ui, -apple-system, sans-serif; width: 350px;">
        <style>
          /* Custom styles for the Mapbox popup close button */
          .mapboxgl-popup-close-button {
            font-size: 22px !important;
            font-weight: bold !important;
            color: #4a5568 !important;
            right: 8px !important;
            top: 8px !important;
            padding: 4px 8px !important;
            border-radius: 50% !important;
            line-height: 22px !important;
            width: 30px !important;
            height: 30px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: rgba(237, 242, 247, 0.8) !important;
            transition: all 0.2s ease !important;
          }
          .mapboxgl-popup-close-button:hover {
            background: rgba(226, 232, 240, 1) !important;
            color: #1a202c !important;
          }
          /* Make all popups consistent in size */
          .mapboxgl-popup-content {
            width: 350px !important;
            box-sizing: border-box !important;
          }
          /* Style for list popup */
          .list-popup .mapboxgl-popup-content {
            padding: 0 !important;
          }
          /* Style for detail popup */
          .detail-popup .mapboxgl-popup-content {
            padding: 0 !important;
          }
          /* Fix for popup positioning */
          .mapboxgl-popup {
            will-change: transform;
            transition: transform 0.1s ease-out;
          }
          /* Ensure back button is more visible */
          .popup-header {
            padding-left: 48px !important;
            padding-top: 16px !important;
          }
          .popup-container {
            display: flex;
            flex-direction: column;
            max-height: 400px;
            overflow: hidden;
          }
          .popup-header {
            padding: 12px 16px;
            background-color: #f8f9fa;
            border-bottom: 1px solid #e2e8f0;
            border-radius: 8px 8px 0 0;
            position: sticky;
            top: 0;
            z-index: 10;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          .popup-content {
            padding: 16px;
            overflow-y: auto;
            max-height: 350px;
            scrollbar-width: thin;
          }
          .popup-content::-webkit-scrollbar {
            width: 6px;
          }
          .popup-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .popup-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 10px;
          }
          .popup-content::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
          .section-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            font-size: 14px;
          }
          .section-content {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #edf2f7;
          }
          .field-row {
            display: flex;
            margin-bottom: 8px;
            align-items: flex-start;
          }
          .field-label {
            width: 40%;
            font-weight: 500;
            color: #4a5568;
            font-size: 13px;
            padding-right: 8px;
          }
          .field-value {
            width: 60%;
            font-size: 13px;
            color: #1a202c;
            word-break: break-word;
          }
        </style>
        <div class="popup-header">
          <div style="display: flex; align-items: center;">
            <div style="font-size: 24px; margin-right: 10px;">${datasetIcon}</div>
            <div style="font-size: 18px; font-weight: bold; color: #2d3748;">${datasetDisplayName}</div>
          </div>
        </div>
        <div class="popup-content">
    `;
    
    // Add primary information section
    let hasPrimaryInfo = false;
    let primaryContent = '';
    
    for (const key of categories.primary) {
      if (item[key] !== undefined && item[key] !== null) {
        hasPrimaryInfo = true;
        const displayKey = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Add appropriate icons based on the field
        let fieldIcon = '';
        if (key === 'event_type') fieldIcon = '🔔 ';
        if (key === 'event_name') fieldIcon = '📋 ';
        if (key === 'priority_level') fieldIcon = '⚠️ ';
        if (key === 'event_status') fieldIcon = '🚥 ';
        if (key === 'device_label') fieldIcon = '🏷️ ';
        
        // Special formatting for priority levels
        let valueClass = '';
        if (key === 'priority_level') {
          const priority = Number(item[key]);
          if (priority <= 2) valueClass = 'text-red-600 font-bold';
          else if (priority <= 4) valueClass = 'text-orange-500 font-bold';
          else valueClass = 'text-blue-500';
        }
        
        // Special formatting for event status
        if (key === 'event_status') {
          const status = String(item[key]).toUpperCase();
          if (status === 'ACTIVE') valueClass = 'text-green-600 font-bold';
          else if (status === 'COMPLETED') valueClass = 'text-gray-500';
          else if (status.includes('PENDING')) valueClass = 'text-yellow-600';
        }
        
        primaryContent += `
          <div class="field-row">
            <div class="field-label">${fieldIcon}${displayKey}:</div>
            <div class="field-value ${valueClass}">${formatValue(item[key])}</div>
          </div>
        `;
      }
    }
    
    if (hasPrimaryInfo) {
      content += `
        <div class="section-content">
          ${primaryContent}
        </div>
      `;
    }
    
    // Add location information section
    let hasLocationInfo = false;
    let locationContent = '';
    
    for (const key of categories.location) {
      if (item[key] !== undefined && item[key] !== null) {
        hasLocationInfo = true;
        const displayKey = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Add location icons
        let fieldIcon = '';
        if (key === 'route') fieldIcon = '🛣️ ';
        if (key === 'start_mile_marker' || key === 'end_mile_marker') fieldIcon = '📏 ';
        if (key === 'city') fieldIcon = '🏙️ ';
        if (key === 'county') fieldIcon = '🏛️ ';
        if (key === 'district' || key === 'subdistrict') fieldIcon = '🏢 ';
        if (key === 'region') fieldIcon = '🗺️ ';
        
        locationContent += `
          <div class="field-row">
            <div class="field-label">${fieldIcon}${displayKey}:</div>
            <div class="field-value">${formatValue(item[key])}</div>
          </div>
        `;
      }
    }
    
    // Special case for mile markers - combine them if both exist
    if (item.start_mile_marker !== undefined && item.end_mile_marker !== undefined) {
      hasLocationInfo = true;
      locationContent += `
        <div class="field-row">
          <div class="field-label">📏 Mile Range:</div>
          <div class="field-value">${formatValue(item.start_mile_marker)} to ${formatValue(item.end_mile_marker)}</div>
        </div>
      `;
    }
    
    if (hasLocationInfo) {
      content += `
        <div class="section-content">
          <div class="section-title">📍 Location Information</div>
          ${locationContent}
        </div>
      `;
    }
    
    // Add time information section
    let hasTimeInfo = false;
    let timeContent = '';
    
    for (const key of categories.time) {
      if (item[key] !== undefined && item[key] !== null) {
        hasTimeInfo = true;
        const displayKey = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Add time icons
        let fieldIcon = '🕒 ';
        if (key === 'date_start') fieldIcon = '🟢 ';
        if (key === 'date_end') fieldIcon = '🔴 ';
        if (key === 'date_update') fieldIcon = '🔄 ';
        
        timeContent += `
          <div class="field-row">
            <div class="field-label">${fieldIcon}${displayKey}:</div>
            <div class="field-value">${formatValue(item[key])}</div>
          </div>
        `;
      }
    }
    
    if (hasTimeInfo) {
      content += `
        <div class="section-content">
          <div class="section-title">⏱️ Time Information</div>
          ${timeContent}
        </div>
      `;
    }
    
    // Add remaining details
    if (categories.details.length > 0) {
      content += `<div class="section-title">ℹ️ Additional Details</div>`;
      
      for (const key of categories.details) {
        // Format the key for display (convert snake_case to Title Case)
        const displayKey = key
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        content += `
          <div class="field-row">
            <div class="field-label">${displayKey}:</div>
            <div class="field-value">${formatValue(item[key])}</div>
          </div>
        `;
      }
    }
    
    content += '</div></div>';
    return content;
  };
  
  // Toggle layer visibility
  const toggleLayerVisibility = (tableName: string) => {
    setVisibleLayers(prev => {
      const newVisibility = { ...prev };
      newVisibility[tableName] = !prev[tableName];
      return newVisibility;
    });
    
    // Update visibleDatasets based on the new visibility state
    setVisibleDatasets(prev => {
      const newVisibleDatasets = new Set(prev);
      if (visibleLayers[tableName]) {
        // If it was visible and now being hidden, remove from visible datasets
        newVisibleDatasets.delete(tableName);
      } else {
        // If it was hidden and now being shown, add to visible datasets
        newVisibleDatasets.add(tableName);
      }
      return newVisibleDatasets;
    });
  };
  
  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="h-full w-full" />
      
      {/* Dynamic Legend */}
      <Card className={`absolute right-4 top-4 p-4 w-64 bg-white/95 shadow-lg transition-all ${showLegend ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Map Legend</h3>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowLegend(false)}>
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <h4 className="text-sm font-medium mb-2">Datasets</h4>
          
          {/* Show datasets that the user has selected, regardless of visibility */}
          <div className="grid grid-cols-1 gap-2">
            {Array.from(selectedDatasets).map(tableName => {
              // Get the color for this dataset
              const color = colorBlindFriendlyColors[tableName as keyof typeof colorBlindFriendlyColors] || colorBlindFriendlyColors.default;
              
              // Get a display name for the dataset
              const displayName = (() => {
                switch(tableName) {
                  case 'traffic_events': return 'Traffic Events';
                  case 'lane_blockage_info': return 'Lane Blockages';
                  case 'rest_area_info': return 'Rest Areas';
                  case 'dynamic_message_sign_info': return 'Dynamic Message Signs';
                  case 'traffic_parking_info': return 'Truck Parking';
                  case 'travel_time_system_info': return 'Travel Time Signs';
                  case 'variable_speed_limit_sign_info': return 'Variable Speed Limit Signs';
                  case 'social_events': return 'Social Events';
                  case 'weather_info': return 'Weather Information';
                  default: return tableName;
                }
              })();
              
              return (
                <div key={tableName} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <div 
                        className="text-white" 
                        dangerouslySetInnerHTML={{ 
                          __html: getMarkerIcon({ datasource_tablename: tableName } as MapData) 
                        }} 
                      />
                    </div>
                    <span className="text-sm">{displayName}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 text-gray-500 hover:text-gray-900"
                    onClick={() => toggleLayerVisibility(tableName)}
                  >
                    {visibleLayers[tableName] ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
                        <line x1="2" x2="22" y1="2" y2="22"></line>
                      </svg>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      
      {/* Toggle button for legend when hidden */}
      {!showLegend && (
        <Button 
          variant="secondary" 
          size="sm" 
          className="absolute right-4 top-4 bg-white/95 shadow-lg"
          onClick={() => setShowLegend(true)}
        >
          <Info className="h-4 w-4 mr-1" />
          Legend
        </Button>
      )}
    </div>
  );
}