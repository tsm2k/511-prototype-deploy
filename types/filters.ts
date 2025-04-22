/**
 * Types for filter components
 */

// Define the interface for polygon coordinates
export interface PolygonCoordinates {
  featureId: string;
  type: string;
  coordinates: number[][][];
  boundingBox: {
    southwest: number[];
    northeast: number[];
  } | null;
}

export interface LocationFilter {
  route?: string[];
  region?: string[];
  county?: string[];
  district?: string[];
  city?: string[];
  eventLocationCategory?: string[];
  polygons?: PolygonCoordinates[];
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
