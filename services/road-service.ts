"use client"

// Road Service - Handles fetching and caching Roads data from GeoJSON

// Define interface for Road data
export interface Road {
  fullname: string;
  coordinates: number[][][]; // MultiLineString coordinates
}

// Cache for Road data to avoid repeated fetching
let roadCache: Record<string, Road> | null = null;

/**
 * Fetches Road data from GeoJSON file and caches it
 * @returns A promise that resolves to a Record of Road data by name
 */
export async function fetchRoadData(): Promise<Record<string, Road>> {
  // Return cached data if available
  if (roadCache) {
    return roadCache;
  }

  try {
    const response = await fetch('/geojson/road-cleaned.geojson');
    const data = await response.json();
    
    // Process the GeoJSON features and extract Road data
    const roads: Record<string, Road> = {};
    
    data.features.forEach((feature: any) => {
      const name = feature.properties.fullname;
      
      if (name && name.trim() !== '' && name.trim() !== ' ') {
        if (feature.geometry && feature.geometry.coordinates) {
          roads[name] = {
            fullname: name,
            coordinates: feature.geometry.coordinates
          };
        }
      }
    });
    
    // Cache the data for future use
    roadCache = roads;
    return roads;
  } catch (error) {
    console.error('Error fetching Road data:', error);
    return {};
  }
}

/**
 * Gets coordinates for a specific Road by name
 * @param roadName The name of the Road to find
 * @returns A promise that resolves to the Road coordinates or null if not found
 */
export async function getRoadCoordinates(roadName: string): Promise<number[][][] | null> {
  const roads = await fetchRoadData();
  return roads[roadName]?.coordinates || null;
}

/**
 * Gets all road names
 * @returns A promise that resolves to an array of road names
 */
export async function getAllRoadNames(): Promise<string[]> {
  const roads = await fetchRoadData();
  return Object.keys(roads).sort();
}
