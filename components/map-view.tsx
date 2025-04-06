"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ChevronUp, ChevronDown, Info } from "lucide-react"

mapboxgl.accessToken = "pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng"

export function MapView() {

  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])

  const resizeObserverRef = useRef<ResizeObserver | null>(null)


  // Initialize map
  useEffect(() => {
    if (map.current) return

    if (mapContainer.current) {
      console.log('Initializing map...');
      mapboxgl.accessToken = 'pk.eyJ1IjoidGFuYXkyayIsImEiOiJjbTJpYnltejYwbDgwMmpvbm1lNG16enV3In0.fwcdZ3I-cofnDOR9m1Hqng';
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/navigation-day-v1",
        center: [-86.1581, 39.7684],
        zoom: 7
      })

      // Add event listeners to track map loading
      map.current.on('load', () => {
        console.log('Map loaded successfully!');

      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
      });

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
  }
, []);
return <div ref={mapContainer} className="h-full w-full" />;
}