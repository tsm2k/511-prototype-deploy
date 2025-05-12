/**
 * Types for filter components
 */

// Define the interface for polygon coordinates
export interface PolygonCoordinates {
  featureId: string;
  type: string;
  name?: string; // Name property for intersections and other named polygons
  coordinates: number[][][];
  boundingBox: {
    southwest: number[];
    northeast: number[];
  } | null;
}

// Define the location selection type
export type LocationSelectionType = "road" | "city" | "district" | "subdistrict" | "polygon" | "county" | "intersection" | "poi";

// Define the mile marker range type
export interface MileMarkerRange {
  min: number;
  max: number;
}

// Define the location selection interface
export interface LocationSelection {
  type: LocationSelectionType;
  selection: string | string[] | PolygonCoordinates;
  operator: "AND" | "OR";
  mileMarkerRange?: MileMarkerRange;
  poiRadius?: number; // Radius in miles for Points of Interest
  coordinates?: number[][]; // Coordinates for intersections and other geometries
}

export interface LocationFilter {
  route?: string[];
  region?: string[];
  county?: string[];
  district?: string[];
  city?: string[];
  eventLocationCategory?: string[];
  polygons?: PolygonCoordinates[];
  locationSelections?: LocationSelection[]; // New field for location selections
  logic?: 'AND' | 'OR'; // Logical operator to apply between location filters
}

export interface TimeFilter {
  startDate?: string;
  endDate?: string;
  logic?: 'AND' | 'OR'; // Logical operator to apply between time filters
}

export interface DatasetFilter {
  [datasetId: string]: {
    [attributeName: string]: string[];
  };
}

export interface FilterState {
  location: LocationFilter;
  time: TimeFilter;
  datasets: string[];
  datasetAttributes: DatasetFilter;
}
