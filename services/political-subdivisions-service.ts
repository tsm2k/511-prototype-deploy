// Service for handling political subdivisions (cities and counties)
import { getBasePath } from "../utils/path-utils";

/**
 * Get the GeoJSON coordinates for a specific city
 * @param cityName Name of the city to get coordinates for
 * @returns GeoJSON feature for the city
 */
export const getCityBoundary = async (cityName: string): Promise<any> => {
  try {
    const basePath = getBasePath();
    const response = await fetch(`${basePath}/geojson/city-cleaned.geojson`);
    if (!response.ok) {
      throw new Error(`Failed to fetch city data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Find the feature with the matching city name
    const cityFeature = data.features.find(
      (feature: any) => feature.properties.name === cityName
    );
    
    if (!cityFeature) {
      console.warn(`City not found: ${cityName}`);
      return null;
    }
    
    return cityFeature;
  } catch (error) {
    console.error('Error fetching city boundary:', error);
    return null;
  }
};

/**
 * Get the GeoJSON coordinates for a specific county
 * @param countyName Name of the county to get coordinates for
 * @returns GeoJSON feature for the county
 */
export const getCountyBoundary = async (countyName: string): Promise<any> => {
  try {
    const basePath = getBasePath();
    const response = await fetch(`${basePath}/geojson/counties-cleaned.geojson`);
    if (!response.ok) {
      throw new Error(`Failed to fetch county data: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Find the feature with the matching county name
    const countyFeature = data.features.find(
      (feature: any) => feature.properties.name === countyName
    );
    
    if (!countyFeature) {
      console.warn(`County not found: ${countyName}`);
      return null;
    }
    
    return countyFeature;
  } catch (error) {
    console.error('Error fetching county boundary:', error);
    return null;
  }
};
