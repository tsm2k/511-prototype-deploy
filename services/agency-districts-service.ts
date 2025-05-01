import { Feature, FeatureCollection } from 'geojson';

// Function to fetch districts from GeoJSON file
export async function fetchDistricts(): Promise<string[]> {
  try {
    const response = await fetch('/geojson/districts-cleaned.geojson');
    const data: FeatureCollection = await response.json();
    
    // Extract district names from the GeoJSON features
    const districts = data.features
      .map(feature => feature.properties?.name as string)
      .filter(Boolean)
      .sort();
    
    return districts;
  } catch (error) {
    console.error('Error fetching districts:', error);
    return [];
  }
}

// Function to fetch subdistricts from GeoJSON file
export async function fetchSubdistricts(): Promise<string[]> {
  try {
    const response = await fetch('/geojson/subdistricts-cleaned.geojson');
    const data: FeatureCollection = await response.json();
    
    // Extract subdistrict names from the GeoJSON features
    const subdistricts = data.features
      .map(feature => feature.properties?.name as string)
      .filter(Boolean)
      .sort();
    
    return subdistricts;
  } catch (error) {
    console.error('Error fetching subdistricts:', error);
    return [];
  }
}

// Function to get district boundary from GeoJSON file
export async function getDistrictBoundary(districtName: string): Promise<Feature | null> {
  try {
    const response = await fetch('/geojson/districts-cleaned.geojson');
    const data: FeatureCollection = await response.json();
    
    // Find the district feature by name
    const districtFeature = data.features.find(
      feature => feature.properties?.name === districtName
    );
    
    return districtFeature || null;
  } catch (error) {
    console.error(`Error getting boundary for district ${districtName}:`, error);
    return null;
  }
}

// Function to get subdistrict boundary from GeoJSON file
export async function getSubdistrictBoundary(subdistrictName: string): Promise<Feature | null> {
  try {
    const response = await fetch('/geojson/subdistricts-cleaned.geojson');
    const data: FeatureCollection = await response.json();
    
    // Find the subdistrict feature by name
    const subdistrictFeature = data.features.find(
      feature => feature.properties?.name === subdistrictName
    );
    
    return subdistrictFeature || null;
  } catch (error) {
    console.error(`Error getting boundary for subdistrict ${subdistrictName}:`, error);
    return null;
  }
}
