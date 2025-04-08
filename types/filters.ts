/**
 * Types for filter components
 */

export interface LocationFilter {
  route?: string[];
  region?: string[];
  county?: string[];
  district?: string[];
  city?: string[];
  eventLocationCategory?: string[];
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
