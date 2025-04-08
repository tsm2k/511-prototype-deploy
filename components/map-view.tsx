"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronUp, ChevronDown, Info, AlertTriangle, Construction, Clock, Map as MapIcon } from "lucide-react"
import { DataSourceMetadata, fetchDataSourcesMetadata } from "@/services/api"

mapboxgl.accessToken = "pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng"

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

export function MapView({ queryResults }: { queryResults?: any }) {
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
  
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupsRef = useRef<mapboxgl.Popup[]>([])
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  
  // State for dataset metadata (for display names and colors)
  const [datasetMetadata, setDatasetMetadata] = useState<Record<string, DataSourceMetadata>>({})
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({})
  const [showLegend, setShowLegend] = useState(true)

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

      // Add event listeners to track map loading
      map.current.on('load', () => {
        console.log('Map loaded successfully!');
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
    } else {
      console.log('No markers to display on the map');
    }
  }, [queryResults, visibleLayers]);
  
  // Function to add a marker to the map
  const addMarkerToMap = (item: MapData, coordinates: any) => {
    if (!map.current) return;
    
    console.log('Adding marker for item:', item.id, 'with coordinates:', coordinates);
    
    // Determine marker position based on geometry type or format
    let position: [number, number];
    
    if (coordinates.type === 'Point' && Array.isArray(coordinates.coordinates)) {
      // GeoJSON Point format
      position = [coordinates.coordinates[0], coordinates.coordinates[1]];
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
    
    // Create marker element
    const markerEl = document.createElement('div');
    markerEl.className = 'custom-marker';
    markerEl.style.backgroundColor = color;
    markerEl.style.width = '24px';
    markerEl.style.height = '24px';
    markerEl.style.borderRadius = '50%';
    markerEl.style.display = 'flex';
    markerEl.style.alignItems = 'center';
    markerEl.style.justifyContent = 'center';
    markerEl.style.border = '2px solid white';
    markerEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    
    // Add icon based on dataset type
    const iconEl = document.createElement('div');
    iconEl.innerHTML = getMarkerIcon(item);
    iconEl.style.color = 'white';
    iconEl.style.fontSize = '12px';
    markerEl.appendChild(iconEl);
    
    // Create popup with detailed information
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px'
    }).setHTML(createPopupContent(item));
    
    // Add marker to map
    const marker = new mapboxgl.Marker(markerEl)
      .setLngLat(position)
      .setPopup(popup);
    
    if (map.current) {
      marker.addTo(map.current);
      
      // Store references for later cleanup
      markersRef.current.push(marker);
      popupsRef.current.push(popup);
      
      // Add this dataset to the visible datasets for the legend
      setVisibleDatasets(prev => {
        const newSet = new Set(prev);
        newSet.add(item.datasource_tablename);
        return newSet;
      });
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
    
    // Use a more user-friendly name
    switch(datasource_tablename) {
      case 'traffic_events': datasetDisplayName = 'Traffic Events'; break;
      case 'lane_blockage_info': datasetDisplayName = 'Lane Blockages'; break;
      case 'rest_area_info': datasetDisplayName = 'Rest Areas'; break;
      case 'dynamic_message_sign_info': datasetDisplayName = 'Dynamic Message Signs'; break;
      case 'traffic_parking_info': datasetDisplayName = 'Truck Parking'; break;
      case 'travel_time_system_info': datasetDisplayName = 'Travel Time Signs'; break;
      case 'variable_speed_limit_sign_info': datasetDisplayName = 'Variable Speed Limit Signs'; break;
      case 'social_events': datasetDisplayName = 'Social Events'; break;
      case 'weather_info': datasetDisplayName = 'Weather Information'; break;
    }
    
    // Start with header
    let content = `
      <div class="p-2">
        <div class="font-bold text-lg mb-2">${datasetDisplayName}</div>
    `;
    
    // Add event-specific information
    if (datasource_tablename === 'indot_event_data') {
      const eventType = item.event_type || 'Unknown';
      const eventStatus = item.event_status || 'Unknown';
      const route = item.route || 'Unknown';
      const startMM = item.start_mile_marker !== undefined ? item.start_mile_marker : 'Unknown';
      const endMM = item.end_mile_marker !== undefined ? item.end_mile_marker : 'Unknown';
      
      content += `
        <div class="mb-2">
          <span class="font-semibold">Type:</span> ${eventType}
        </div>
        <div class="mb-2">
          <span class="font-semibold">Status:</span> ${eventStatus}
        </div>
        <div class="mb-2">
          <span class="font-semibold">Route:</span> ${route}
        </div>
        <div class="mb-2">
          <span class="font-semibold">Mile Markers:</span> ${startMM} to ${endMM}
        </div>
      `;
    }
    
    // Add generic properties (exclude some internal properties)
    const excludedProps = ['id', 'datasource_metadata_id', 'datasource_tablename', 'event_type', 
                          'event_status', 'route', 'start_mile_marker', 'end_mile_marker', 
                          'readable_coordinates', 'coordinates', 'geometry'];
    
    content += '<div class="mt-2 border-t pt-2"><span class="font-semibold">Additional Details:</span></div>';
    
    for (const [key, value] of Object.entries(item)) {
      if (!excludedProps.includes(key) && value !== null && value !== undefined) {
        // Format the value based on its type
        let formattedValue = value;
        
        if (typeof value === 'object') {
          try {
            formattedValue = JSON.stringify(value);
          } catch (e) {
            formattedValue = '[Complex Object]';
          }
        }
        
        // Format the key for display (convert snake_case to Title Case)
        const displayKey = key
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        content += `
          <div class="mb-1">
            <span class="font-semibold">${displayKey}:</span> ${formattedValue}
          </div>
        `;
      }
    }
    
    content += '</div>';
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
