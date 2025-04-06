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
}

export interface TimeFilter {
  startDate?: string;
  endDate?: string;
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
