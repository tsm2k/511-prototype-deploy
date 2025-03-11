"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Card } from "./ui/card"
import { Button } from "./ui/button"
import { ChevronUp, ChevronDown, Info } from "lucide-react"

mapboxgl.accessToken = "pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng"

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

interface MapViewProps {
  carEvents?: CarEvent[]
  selectedDatasets?: {
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
  }
}

export function MapView({ carEvents = [], selectedDatasets }: MapViewProps) {
  // Track what types of data are being displayed
  const [displayedDataTypes, setDisplayedDataTypes] = useState<{
    hasCarEvents: boolean;
    hasLaneBlockages: boolean;
  }>({ hasCarEvents: false, hasLaneBlockages: false });
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const restAreaMarkersRef = useRef<mapboxgl.Marker[]>([])
  const ttsMarkersRef = useRef<mapboxgl.Marker[]>([])
  const vslMarkersRef = useRef<mapboxgl.Marker[]>([])
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [mapLayers, setMapLayers] = useState({
    dynamicMessageSigns: false,
    trafficTimingSystem: false,
    restArea: false,
  })
  
  // State for storing layer data
  const [restAreaData, setRestAreaData] = useState<any[]>([])
  const [ttsData, setTtsData] = useState<any[]>([])
  const [vslData, setVslData] = useState<any[]>([])

  // Initialize map
  useEffect(() => {
    if (map.current) return

    if (mapContainer.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/navigation-day-v1",
        center: [-86.1581, 39.7684],
        zoom: 7,
      })

      map.current.addControl(new mapboxgl.NavigationControl(), "bottom-right")
      
      // Create a ResizeObserver to watch for container size changes
      resizeObserverRef.current = new ResizeObserver(() => {
        if (map.current) {
          // Slight delay to ensure the container has fully resized
          setTimeout(() => {
            if (map.current) {
              map.current.resize()
            }
          }, 0)
        }
      })
      
      // Start observing the map container
      resizeObserverRef.current.observe(mapContainer.current)
    }

    return () => {
      // Clean up the observer and map when component unmounts
      if (resizeObserverRef.current && mapContainer.current) {
        resizeObserverRef.current.unobserve(mapContainer.current)
        resizeObserverRef.current.disconnect()
      }
      
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])
  
  // Define event type categories and their colors
  const eventCategories = [
    { 
      name: "Crashes", 
      types: ["CRASH FATAL", "CRASH PI", "CRASH PD", "CRASH SITE CLEANUP"],
      color: (intensity: number) => `rgb(${Math.round(255 * intensity)}, 0, 0)` // Red
    },
    { 
      name: "Vehicle Issues", 
      types: ["STALLED VEHICLE", "VEHICLE FIRE", "JACKKNIFED SEMI TRAILER", "OVERTURNED SEMI TRAILER", "ABANDONED VEHICLE", "ASSIST MOTORIST"],
      color: (intensity: number) => `rgb(255, ${Math.round(165 * intensity)}, 0)` // Orange
    },
    { 
      name: "Construction & Maintenance", 
      types: ["CONSTRUCTION", "MAINTENANCE", "MOBILE MAINTENANCE OPERATIONS"],
      color: (intensity: number) => `rgb(255, ${Math.round(255 * intensity)}, 0)` // Yellow
    },
    { 
      name: "Road Hazards", 
      types: ["TRAFFIC HAZARD", "DEBRIS IN THE ROAD", "HIGH WATER", "HAZARDOUS MATERIALS SPILL", "DOWNED POWER LINES", "FIRE"],
      color: (intensity: number) => `rgb(255, ${Math.round(100 * intensity)}, ${Math.round(255 * intensity)})` // Purple
    },
    { 
      name: "Traffic", 
      types: ["HEAVY TRAFFIC", "SINGLE LINE TRAFFIC: ALTERNATING DIRECTIONS", "RAMP PARTIALLY BLOCKED", "POLICE AT SCENE", "SUPERLOAD"],
      color: (intensity: number) => `rgb(0, 0, ${Math.round(255 * intensity)})` // Blue
    },
    { 
      name: "Weather & Road Conditions", 
      types: ["SLIDE OFF", "MEDICAL EMERGENCY"],
      color: (intensity: number) => `rgb(${Math.round(165 * intensity)}, ${Math.round(42 * intensity)}, ${Math.round(42 * intensity)})` // Brown
    },
    { 
      name: "Other", 
      types: ["DUPLICATE EVENT/NOT USED"], // Catch-all for other types
      color: (intensity: number) => `rgb(${Math.round(100 * intensity)}, ${Math.round(100 * intensity)}, ${Math.round(100 * intensity)})` // Gray
    }
  ];
  
  // Function to get color based on event type and priority
  const getEventColor = (eventType: string, priorityLevel: number) => {
    // Priority-based coloring (higher priority = more intense color)
    const priorityIntensity = Math.min(1, (9 - priorityLevel) / 8);
    
    // Find the category for this event type
    const category = eventCategories.find(cat => cat.types.includes(eventType)) || eventCategories[eventCategories.length - 1];
    
    // Return the color with appropriate intensity
    return category.color(priorityIntensity);
  };
  
  // Function to format date from timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Load layer data
  useEffect(() => {
    const loadLayerData = async () => {
      try {
        // Load Rest Area data
        const restAreaResponse = await fetch('./json/rest_area.json');
        if (restAreaResponse.ok) {
          const data = await restAreaResponse.json();
          setRestAreaData(data.features || []);
        }
        
        // Load Traffic Timing System data
        const ttsResponse = await fetch('./json/tts.json');
        if (ttsResponse.ok) {
          const data = await ttsResponse.json();
          setTtsData(data.features || []);
        }
        
        // Load Dynamic Message Sign data
        const vslResponse = await fetch('./json/VSL.json');
        if (vslResponse.ok) {
          const data = await vslResponse.json();
          setVslData(data || []);
        }
      } catch (err) {
        console.error('Error loading layer data:', err);
      }
    };
    
    loadLayerData();
  }, []);

  // Effect to handle car events visualization
  useEffect(() => {
    if (!map.current) {
      return;
    }
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    console.log(`Rendering ${carEvents.length} car events on the map`);
    
    // Track if we have any car events or lane blockages
    let hasRegularCarEvents = false;
    let hasLaneBlockages = false;
    
    // Check if lane blockages are selected
    const laneBlockagesSelected = selectedDatasets && (
      selectedDatasets.laneBlockages.blockType.length > 0 ||
      selectedDatasets.laneBlockages.allLanesAffected.length > 0 ||
      selectedDatasets.laneBlockages.lanesAffected.positive.length > 0 ||
      selectedDatasets.laneBlockages.lanesAffected.negative.length > 0 ||
      Object.values(selectedDatasets.laneBlockages.additionalFilters).some(arr => arr.length > 0)
    );
    
    // Check if car events are selected
    const carEventsSelected = selectedDatasets && selectedDatasets.carEvents.length > 0;
    
    // Add new markers for car events
    carEvents.forEach(event => {
      if (!event.lat || !event.lon) {
        console.warn(`Event ${event.id} missing coordinates:`, event);
        return;
      }
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'car-event-marker';
      
      // Check if this event has lane blockages
      const hasPositiveLaneBlockage = event.positiveLaneBlockageType !== 'N/A' && 
        (event.positiveLaneBlockage?.allLanesAffected || 
         (event.positiveLaneBlockage?.lanesAffected && event.positiveLaneBlockage.lanesAffected.length > 0));
         
      const hasNegativeLaneBlockage = event.negativeLaneBlockageType !== 'N/A' && 
        (event.negativeLaneBlockage?.allLanesAffected || 
         (event.negativeLaneBlockage?.lanesAffected && event.negativeLaneBlockage.lanesAffected.length > 0));
      
      // Skip lane blockage events if lane blockages are not selected
      if ((hasPositiveLaneBlockage || hasNegativeLaneBlockage) && !laneBlockagesSelected) {
        return;
      }
      
      // Skip regular car events if car events are not selected
      if (!(hasPositiveLaneBlockage || hasNegativeLaneBlockage) && !carEventsSelected) {
        return;
      }
      
      // Update tracking variables
      if (hasPositiveLaneBlockage || hasNegativeLaneBlockage) {
        hasLaneBlockages = true;
      } else {
        hasRegularCarEvents = true;
      }
      
      // Adjust marker style based on lane blockage
      if (hasPositiveLaneBlockage || hasNegativeLaneBlockage) {
        // Use a diamond for lane blockage events
        el.style.width = '22px';
        el.style.height = '22px';
        el.style.borderRadius = '4px';
        el.style.transform = 'rotate(45deg)';
        el.style.backgroundColor = hasPositiveLaneBlockage && event.positiveLaneBlockageType === 'CLOSED' ? '#ff0000' :
                                 hasNegativeLaneBlockage && event.negativeLaneBlockageType === 'CLOSED' ? '#ff0000' :
                                 hasPositiveLaneBlockage && event.positiveLaneBlockageType === 'SLOW' ? '#ffa500' :
                                 hasNegativeLaneBlockage && event.negativeLaneBlockageType === 'SLOW' ? '#ffa500' :
                                 getEventColor(event.eventType, event.priorityLevel);
      } else {
        // Use a circle for regular events
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = getEventColor(event.eventType, event.priorityLevel);
      }
      
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
      
      // Function to format lane blockage information
      const formatLaneBlockage = (direction: string, blockageType: string, blockage: LaneBlockage) => {
        if (!blockage || blockageType === 'N/A') return '';
        
        let details = [];
        
        if (blockageType !== 'N/A') {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} Blockage Type:</strong> ${blockageType}</p>`);
        }
        
        if (blockage.allLanesAffected) {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} All Lanes:</strong> Affected</p>`);
        }
        
        if (blockage.lanesAffected && blockage.lanesAffected.length > 0) {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} Lanes Affected:</strong> ${blockage.lanesAffected.join(', ')}</p>`);
        }
        
        if (blockage.insideShoulderAffected) {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} Inside Shoulder:</strong> Affected</p>`);
        }
        
        if (blockage.outsideShoulderAffected) {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} Outside Shoulder:</strong> Affected</p>`);
        }
        
        if (blockage.exitRampAffected) {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} Exit Ramp:</strong> Affected</p>`);
        }
        
        if (blockage.entranceRampAffected) {
          details.push(`<p style="margin: 0 0 3px;"><strong>${direction} Entrance Ramp:</strong> Affected</p>`);
        }
        
        return details.join('');
      };
      
      // Create popup with event details
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="max-width: 300px;">
            <h3 style="margin: 0 0 5px; font-weight: bold;">${event.eventType}</h3>
            <p style="margin: 0 0 3px;"><strong>Route:</strong> ${event.route}</p>
            <p style="margin: 0 0 3px;"><strong>Status:</strong> ${event.eventStatus}</p>
            <p style="margin: 0 0 3px;"><strong>Priority:</strong> ${event.priorityLevel}</p>
            <p style="margin: 0 0 3px;"><strong>Start:</strong> ${formatDate(event.dateStart)}</p>
            ${event.dateEnd ? `<p style="margin: 0 0 3px;"><strong>End:</strong> ${formatDate(event.dateEnd)}</p>` : ''}
            <p style="margin: 0 0 3px;"><strong>Location:</strong> ${event.locationDetails.city.join(', ') || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>County:</strong> ${event.locationDetails.county.join(', ')}</p>
            
            ${event.positiveLaneBlockageType !== 'N/A' || (event.positiveLaneBlockage && Object.values(event.positiveLaneBlockage).some(val => val === true || (Array.isArray(val) && val.length > 0))) ? 
              `<div style="margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px;">
                <h4 style="margin: 0 0 5px; font-weight: bold;">Positive Direction Lane Blockage</h4>
                ${formatLaneBlockage('Positive', event.positiveLaneBlockageType, event.positiveLaneBlockage)}
              </div>` : ''}
            
            ${event.negativeLaneBlockageType !== 'N/A' || (event.negativeLaneBlockage && Object.values(event.negativeLaneBlockage).some(val => val === true || (Array.isArray(val) && val.length > 0))) ? 
              `<div style="margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px;">
                <h4 style="margin: 0 0 5px; font-weight: bold;">Negative Direction Lane Blockage</h4>
                ${formatLaneBlockage('Negative', event.negativeLaneBlockageType, event.negativeLaneBlockage)}
              </div>` : ''}
          </div>
        `);
      
      // Create and store marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([event.lon, event.lat])
        .setPopup(popup)
        .addTo(map.current!);
      
      markersRef.current.push(marker);
    });
    
    // Update the displayed data types
    setDisplayedDataTypes({
      hasCarEvents: hasRegularCarEvents,
      hasLaneBlockages: hasLaneBlockages
    });
  }, [carEvents, map.current]);

  // Effect to handle Rest Area visualization
  useEffect(() => {
    if (!map.current || !mapLayers.restArea) {
      // Clear markers if layer is turned off
      restAreaMarkersRef.current.forEach(marker => marker.remove());
      restAreaMarkersRef.current = [];
      return;
    }
    
    // Clear existing markers
    restAreaMarkersRef.current.forEach(marker => marker.remove());
    restAreaMarkersRef.current = [];
    
    console.log(`Rendering ${restAreaData.length} rest areas on the map`);
    
    // Add new markers for rest areas
    restAreaData.forEach(feature => {
      const coordinates = feature.geometry.coordinates;
      const properties = feature.properties;
      
      if (!coordinates || !coordinates.length) {
        console.warn(`Rest area missing coordinates:`, feature);
        return;
      }
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'rest-area-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundImage = 'url("./icons/rest-area.svg")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundRepeat = 'no-repeat';
      
      // Create popup with rest area details
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="max-width: 250px;">
            <h3 style="margin: 0 0 5px; font-weight: bold;">Rest Area</h3>
            <p style="margin: 0 0 3px;"><strong>Location:</strong> ${properties.site_area_location || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Description:</strong> ${properties.site_area_description || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Status:</strong> ${properties.site_area_status || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Route:</strong> ${properties.site_route || 'N/A'}</p>
            ${properties.amenities && Array.isArray(properties.amenities) ? `<p style="margin: 0 0 3px;"><strong>Amenities:</strong> ${properties.amenities.join(', ')}</p>` : ''}
            ${properties.tpims && properties.tpims.spaces_available ? `<p style="margin: 0 0 3px;"><strong>Spaces Available:</strong> ${properties.tpims.spaces_available}</p>` : ''}
          </div>
        `);
      
      // Create and store marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([coordinates[0], coordinates[1]])
        .setPopup(popup)
        .addTo(map.current!);
      
      restAreaMarkersRef.current.push(marker);
    });
  }, [restAreaData, mapLayers.restArea, map.current]);

  // Effect to handle Traffic Timing System visualization
  useEffect(() => {
    if (!map.current || !mapLayers.trafficTimingSystem) {
      // Clear markers if layer is turned off
      ttsMarkersRef.current.forEach(marker => marker.remove());
      ttsMarkersRef.current = [];
      return;
    }
    
    // Clear existing markers
    ttsMarkersRef.current.forEach(marker => marker.remove());
    ttsMarkersRef.current = [];
    
    console.log(`Rendering ${ttsData.length} traffic timing systems on the map`);
    
    // Add new markers for traffic timing systems
    ttsData.forEach(feature => {
      const coordinates = feature.geometry.coordinates;
      const properties = feature.properties;
      
      if (!coordinates || !coordinates.length) {
        console.warn(`TTS missing coordinates:`, feature);
        return;
      }
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'tts-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundImage = 'url("./icons/tts.svg")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundRepeat = 'no-repeat';
      
      // Create popup with TTS details
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="max-width: 250px;">
            <h3 style="margin: 0 0 5px; font-weight: bold;">Traffic Timing System</h3>
            <p style="margin: 0 0 3px;"><strong>Title:</strong> ${properties.title || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Route:</strong> ${properties.route || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Direction:</strong> ${properties.travel_direction || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Mile Point:</strong> ${properties.milepoint || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Message:</strong> ${properties.message1 || ''} ${properties.message2 || ''} ${properties.message3 || ''}</p>
            <p style="margin: 0 0 3px;"><strong>On Time:</strong> ${properties.ontime || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Off Time:</strong> ${properties.offtime || 'N/A'}</p>
          </div>
        `);
      
      // Create and store marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([coordinates[0], coordinates[1]])
        .setPopup(popup)
        .addTo(map.current!);
      
      ttsMarkersRef.current.push(marker);
    });
  }, [ttsData, mapLayers.trafficTimingSystem, map.current]);

  // Effect to handle Dynamic Message Sign visualization
  useEffect(() => {
    if (!map.current || !mapLayers.dynamicMessageSigns) {
      // Clear markers if layer is turned off
      vslMarkersRef.current.forEach(marker => marker.remove());
      vslMarkersRef.current = [];
      return;
    }
    
    // Clear existing markers
    vslMarkersRef.current.forEach(marker => marker.remove());
    vslMarkersRef.current = [];
    
    console.log(`Rendering ${vslData.length} dynamic message signs on the map`);
    
    // Add new markers for dynamic message signs
    vslData.forEach(sign => {
      if (!sign.latitude || !sign.longitude) {
        console.warn(`VSL missing coordinates:`, sign);
        return;
      }
      
      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'vsl-marker';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundImage = 'url("./icons/dms.svg")';
      el.style.backgroundSize = 'cover';
      el.style.backgroundRepeat = 'no-repeat';
      
      // Create popup with VSL details
      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div style="max-width: 250px;">
            <h3 style="margin: 0 0 5px; font-weight: bold;">Dynamic Message Sign</h3>
            <p style="margin: 0 0 3px;"><strong>Name:</strong> ${sign.name || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Road:</strong> ${sign.primaryRoad || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Direction:</strong> ${sign.direction || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Mile Marker:</strong> ${sign.mileMarker || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>Cross Road:</strong> ${sign.crossRoad || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>City:</strong> ${sign.city || 'N/A'}</p>
            <p style="margin: 0 0 3px;"><strong>County:</strong> ${sign.county || 'N/A'}</p>
            ${sign.status && sign.status.message ? `<p style="margin: 0 0 3px;"><strong>Message:</strong> ${sign.status.message}</p>` : ''}
          </div>
        `);
      
      // Create and store marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([sign.longitude, sign.latitude])
        .setPopup(popup)
        .addTo(map.current!);
      
      vslMarkersRef.current.push(marker);
    });
  }, [vslData, mapLayers.dynamicMessageSigns, map.current]);

  const toggleLayer = (layer: keyof typeof mapLayers) => {
    setMapLayers({
      ...mapLayers,
      [layer]: !mapLayers[layer],
    })
  }

  // Group car events by type for summary display
  const getEventTypeCounts = () => {
    const counts: Record<string, number> = {};
    carEvents.forEach(event => {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    });
    return counts;
  };
  
  // Get lane blockage events only
  const getLaneBlockageEvents = () => {
    return carEvents.filter(event => {
      const hasPositiveLaneBlockage = event.positiveLaneBlockageType !== 'N/A' && 
        (event.positiveLaneBlockage?.allLanesAffected || 
         (event.positiveLaneBlockage?.lanesAffected && event.positiveLaneBlockage.lanesAffected.length > 0));
         
      const hasNegativeLaneBlockage = event.negativeLaneBlockageType !== 'N/A' && 
        (event.negativeLaneBlockage?.allLanesAffected || 
         (event.negativeLaneBlockage?.lanesAffected && event.negativeLaneBlockage.lanesAffected.length > 0));
      
      return hasPositiveLaneBlockage || hasNegativeLaneBlockage;
    });
  };
  
  // Get regular car events only (no lane blockages)
  const getRegularCarEvents = () => {
    return carEvents.filter(event => {
      const hasPositiveLaneBlockage = event.positiveLaneBlockageType !== 'N/A' && 
        (event.positiveLaneBlockage?.allLanesAffected || 
         (event.positiveLaneBlockage?.lanesAffected && event.positiveLaneBlockage.lanesAffected.length > 0));
         
      const hasNegativeLaneBlockage = event.negativeLaneBlockageType !== 'N/A' && 
        (event.negativeLaneBlockage?.allLanesAffected || 
         (event.negativeLaneBlockage?.lanesAffected && event.negativeLaneBlockage.lanesAffected.length > 0));
      
      return !hasPositiveLaneBlockage && !hasNegativeLaneBlockage;
    });
  };
  
  // Count lane blockage events by type
  const getLaneBlockageCounts = () => {
    const counts = {
      positive: {
        CLOSED: 0,
        SLOW: 0,
        'N/A': 0
      },
      negative: {
        CLOSED: 0,
        SLOW: 0,
        'N/A': 0
      },
      total: 0
    };
    
    const laneBlockageEvents = getLaneBlockageEvents();
    
    laneBlockageEvents.forEach(event => {
      const hasPositiveLaneBlockage = event.positiveLaneBlockageType !== 'N/A' && 
        (event.positiveLaneBlockage?.allLanesAffected || 
         (event.positiveLaneBlockage?.lanesAffected && event.positiveLaneBlockage.lanesAffected.length > 0));
         
      const hasNegativeLaneBlockage = event.negativeLaneBlockageType !== 'N/A' && 
        (event.negativeLaneBlockage?.allLanesAffected || 
         (event.negativeLaneBlockage?.lanesAffected && event.negativeLaneBlockage.lanesAffected.length > 0));
      
      if (hasPositiveLaneBlockage) {
        counts.positive[event.positiveLaneBlockageType as keyof typeof counts.positive]++;
        counts.total++;
      }
      
      if (hasNegativeLaneBlockage) {
        counts.negative[event.negativeLaneBlockageType as keyof typeof counts.negative]++;
        counts.total++;
      }
    });
    
    return counts;
  };
  
  // Group car events by priority for summary display
  const getEventPriorityCounts = () => {
    const counts: Record<string, number> = {};
    carEvents.forEach(event => {
      counts[event.priorityLevel] = (counts[event.priorityLevel] || 0) + 1;
    });
    return counts;
  };
  
  // Group car events by location for summary display
  const getEventLocationCounts = () => {
    const counts: Record<string, number> = {};
    carEvents.forEach(event => {
      if (event.locationDetails.city && event.locationDetails.city.length > 0) {
        event.locationDetails.city.forEach(city => {
          counts[city] = (counts[city] || 0) + 1;
        });
      } else {
        counts['Unspecified'] = (counts['Unspecified'] || 0) + 1;
      }
    });
    return counts;
  };
  
  const [carEventsResultsExpanded, setCarEventsResultsExpanded] = useState(false);
  const [laneBlockageResultsExpanded, setLaneBlockageResultsExpanded] = useState(false);
  
  // State for legend visibility
  const [legendVisible, setLegendVisible] = useState(false);
  
  return (
    <div className="relative h-full w-full flex flex-col">
      <div ref={mapContainer} className="h-full w-full flex-grow" />

      {/* Map Layers Control */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-3 rounded-md shadow-md">
        <div className="space-y-2">
          <p className="text-sm font-medium">Map Layers</p>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="layer-dms"
                checked={mapLayers.dynamicMessageSigns}
                onCheckedChange={() => toggleLayer("dynamicMessageSigns")}
              />
              <Label htmlFor="layer-dms">Dynamic Message Signs</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="layer-tts"
                checked={mapLayers.trafficTimingSystem}
                onCheckedChange={() => toggleLayer("trafficTimingSystem")}
              />
              <Label htmlFor="layer-tts">Traffic Timing System</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="layer-rest"
                checked={mapLayers.restArea}
                onCheckedChange={() => toggleLayer("restArea")}
              />
              <Label htmlFor="layer-rest">Rest Area</Label>
            </div>
          </div>
        </div>
      </div>
      
      {/* Map Legend - Only show when data is present */}
      {carEvents.length > 0 && (
        <div className="absolute top-4 left-4 z-[1000]">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white shadow-md flex items-center gap-1.5"
            onClick={() => setLegendVisible(!legendVisible)}
          >
            <Info className="h-4 w-4" />
            <span>Legend</span>
          </Button>
          
          {legendVisible && (
            <Card className="mt-2 p-3 shadow-lg bg-white/95 backdrop-blur-sm w-[280px]">
              <div className="space-y-3">
                {/* Car Events Legend */}
                {displayedDataTypes.hasCarEvents && (
                  <div>
                    <p className="text-sm font-medium mb-2">Car Event Types</p>
                    <div className="space-y-1">
                      {eventCategories.slice(0, -1).map((category, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-300" 
                            style={{ backgroundColor: category.color(1) }}
                          />
                          <span className="text-xs">{category.name}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Priority Levels</p>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-3 rounded-sm bg-gradient-to-r from-red-200 to-red-600" />
                          <span className="text-xs">Priority Scale</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 px-1">
                          <span>Lower</span>
                          <span>Higher</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Lane Blockage Legend */}
                {displayedDataTypes.hasLaneBlockages && (
                  <div>
                    <p className="text-sm font-medium mb-2">Lane Blockage Types</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 border border-gray-300 rotate-45" 
                          style={{ backgroundColor: '#ff0000' }}
                        />
                        <span className="text-xs">Closed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 border border-gray-300 rotate-45" 
                          style={{ backgroundColor: '#ffa500' }}
                        />
                        <span className="text-xs">Slow</span>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Direction</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20">Positive</span>
                          <span className="text-xs">Travel direction</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20">Negative</span>
                          <span className="text-xs">Opposite direction</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <p className="text-sm font-medium mb-2">Affected Areas</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20">All Lanes</span>
                          <span className="text-xs">All lanes in direction</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20">Specific Lanes</span>
                          <span className="text-xs">Only certain lane numbers</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20">Shoulders</span>
                          <span className="text-xs">Inside/outside shoulders</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20">Ramps</span>
                          <span className="text-xs">Entrance/exit ramps</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Marker Shape Legend */}
                {(displayedDataTypes.hasCarEvents && displayedDataTypes.hasLaneBlockages) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-medium mb-2">Marker Shapes</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-gray-300 bg-gray-400" />
                        <span className="text-xs">Car Event</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border border-gray-300 rotate-45 bg-gray-400" />
                        <span className="text-xs">Lane Blockage</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
      
      {/* Results Cards - Separate cards for each data type */}
      <div className="absolute bottom-4 left-4 right-4 z-[1000] flex flex-col gap-3">
        {/* Car Events Results Card */}
        {displayedDataTypes.hasCarEvents && getRegularCarEvents().length > 0 && (
          <div className={`transition-all duration-300 ${carEventsResultsExpanded ? 'max-h-[50vh]' : 'max-h-[60px]'} overflow-hidden`}>
            <Card className="p-3 shadow-lg bg-white/95 backdrop-blur-sm border-t-4 border-blue-500">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setCarEventsResultsExpanded(!carEventsResultsExpanded)}>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">Car Events Results</span>
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {getRegularCarEvents().length} {getRegularCarEvents().length === 1 ? 'event' : 'events'}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="p-1 h-auto">
                  {carEventsResultsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
              </div>
              
              {carEventsResultsExpanded && (
                <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(50vh-60px)]">
                  {/* Event Type Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Event Types</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(getEventTypeCounts()).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                          <span className="text-sm truncate">{type}</span>
                          <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Priority Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Priority Levels</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(getEventPriorityCounts())
                        .sort((a, b) => Number(a[0]) - Number(b[0]))
                        .map(([priority, count]) => (
                          <div key={priority} className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full">
                            <span className="text-sm">Priority {priority}</span>
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              {count}
                            </span>
                          </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Location Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Top Locations</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(getEventLocationCounts())
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 9)
                        .map(([location, count]) => (
                          <div key={location} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                            <span className="text-sm truncate">{location}</span>
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              {count}
                            </span>
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        
        {/* Lane Blockage Results Card */}
        {displayedDataTypes.hasLaneBlockages && getLaneBlockageEvents().length > 0 && (
          <div className={`transition-all duration-300 ${laneBlockageResultsExpanded ? 'max-h-[50vh]' : 'max-h-[60px]'} overflow-hidden`}>
            <Card className="p-3 shadow-lg bg-white/95 backdrop-blur-sm border-t-4 border-orange-500">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setLaneBlockageResultsExpanded(!laneBlockageResultsExpanded)}>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">Lane Blockage Results</span>
                  <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {getLaneBlockageEvents().length} {getLaneBlockageEvents().length === 1 ? 'event' : 'events'}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="p-1 h-auto">
                  {laneBlockageResultsExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </Button>
              </div>
              
              {laneBlockageResultsExpanded && (
                <div className="mt-4 space-y-4 overflow-y-auto max-h-[calc(50vh-60px)]">
                  {/* Lane Blockage Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Lane Blockage Types</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Positive Direction */}
                      <div>
                        <h4 className="text-xs font-medium mb-1">Positive Direction</h4>
                        <div className="space-y-1">
                          {Object.entries(getLaneBlockageCounts().positive)
                            .filter(([type, count]) => type !== 'N/A' && count > 0)
                            .map(([type, count]) => (
                              <div key={`pos-${type}`} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                <span className="text-sm truncate">{type}</span>
                                <span className="text-xs font-medium bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                  {count}
                                </span>
                              </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Negative Direction */}
                      <div>
                        <h4 className="text-xs font-medium mb-1">Negative Direction</h4>
                        <div className="space-y-1">
                          {Object.entries(getLaneBlockageCounts().negative)
                            .filter(([type, count]) => type !== 'N/A' && count > 0)
                            .map(([type, count]) => (
                              <div key={`neg-${type}`} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                <span className="text-sm truncate">{type}</span>
                                <span className="text-xs font-medium bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                  {count}
                                </span>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Routes Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Affected Routes</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {getLaneBlockageEvents().reduce((routes, event) => {
                        if (event.route && !routes.includes(event.route)) {
                          routes.push(event.route);
                        }
                        return routes;
                      }, [] as string[]).map(route => (
                        <div key={route} className="flex items-center bg-gray-50 p-2 rounded-md">
                          <span className="text-sm truncate">{route}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Location Summary */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Top Locations</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {getLaneBlockageEvents().reduce((locations, event) => {
                        if (event.locationDetails.city) {
                          event.locationDetails.city.forEach(city => {
                            const existingLocation = locations.find(loc => loc.name === city);
                            if (existingLocation) {
                              existingLocation.count++;
                            } else {
                              locations.push({ name: city, count: 1 });
                            }
                          });
                        }
                        return locations;
                      }, [] as {name: string, count: number}[])
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 9)
                      .map(location => (
                        <div key={location.name} className="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                          <span className="text-sm truncate">{location.name}</span>
                          <span className="text-xs font-medium bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                            {location.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

