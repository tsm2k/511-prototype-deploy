"use client"

// POI Service - Handles fetching and caching Points of Interest data
import { getBasePath } from "../utils/path-utils";

// Define interface for POI data
export interface PointOfInterest {
  fullname: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

// Cache for POI data to avoid repeated fetching
let poiCache: Record<string, PointOfInterest> | null = null;

/**
 * Fetches POI data from GeoJSON file and caches it
 * @returns A promise that resolves to a Record of POI data by name
 */
export async function fetchPOIData(): Promise<Record<string, PointOfInterest>> {
  // Return cached data if available
  if (poiCache) {
    return poiCache;
  }

  try {
    const basePath = getBasePath();
    const response = await fetch(`${basePath}/geojson/point-of-interest-cleaned.geojson`);
    const data = await response.json();
    
    // Process the GeoJSON features and extract POI data
    const pois: Record<string, PointOfInterest> = {};
    
    data.features.forEach((feature: any) => {
      const name = feature.attributes.fullname;
      
      if (name && name.trim() !== '' && name.trim() !== ' ') {
        // Use intptlat/intptlon for the center point if available
        if (feature.attributes.intptlat && feature.attributes.intptlon) {
          pois[name] = {
            fullname: name,
            coordinates: {
              // Convert from string to number and handle the + prefix in latitude
              lat: parseFloat(feature.attributes.intptlat.replace('+', '')),
              lng: parseFloat(feature.attributes.intptlon)
            }
          };
        } 
        // Fallback to using the first coordinate from the geometry if available
        else if (feature.geometry && feature.geometry.rings && feature.geometry.rings[0] && feature.geometry.rings[0][0]) {
          const firstCoord = feature.geometry.rings[0][0];
          pois[name] = {
            fullname: name,
            coordinates: {
              lng: firstCoord[0],
              lat: firstCoord[1]
            }
          };
        }
      }
    });
    
    // Cache the data for future use
    poiCache = pois;
    return pois;
  } catch (error) {
    console.error('Error fetching POI data:', error);
    return {};
  }
}

/**
 * Gets coordinates for a specific POI by name
 * @param poiName The name of the POI to find
 * @returns A promise that resolves to the POI coordinates or null if not found
 */
export async function getPOICoordinates(poiName: string): Promise<{lat: number, lng: number} | null> {
  const pois = await fetchPOIData();
  return pois[poiName]?.coordinates || null;
}


