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
  hours?: string[]; // Array of hours (0-23) to filter by
  weekdays?: string[]; // Array of weekdays (Mon, Tue, Wed, Thu, Fri, Sat, Sun) to filter by
  monthDays?: string[]; // Array of days of month (1-31, plus 'last') to filter by
  holidays?: string[]; // Array of holiday IDs to filter by
  logic?: 'AND' | 'OR'; // Logical operator to apply between time filters
  granularity?: string; // Data granularity (e.g., '1H', '1D', '30M')
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
