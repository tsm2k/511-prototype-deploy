import { LocationFilter, TimeFilter } from "@/types/filters";

// API proxy URL
const API_PROXY_URL = '/api/proxy';

// Types for query construction
export interface QueryExpression {
  column: string;
  operator: string;
  value: string | string[] | number | null;
}

export interface QueryFilter {
  expressions: QueryExpression[];
  logic: 'AND' | 'OR';
}

export interface TableQuery {
  [tableName: string]: {
    selected_columns: string[];
    filters?: QueryFilter;
  };
}

export interface QueryParameters {
  tables: { [key: string]: any }[];
  spatial_join_conditions?: QueryFilter[];
  temporal_join_conditions?: QueryFilter[];
}

export interface QueryRequest {
  parameters: QueryParameters;
}

export interface QueryResponse {
  results: Record<string, any[]>;
}

/**
 * Build a query request based on selected datasets, filters, and columns
 * 
 * @param selectedDatasets Array of selected dataset IDs
 * @param datasetFilters Dataset-specific attribute filters
 * @param locationFilters Location filters (route, region, etc.)
 * @param timeFilters Time filters (start date, end date)
 * @param columnsToInclude Optional specific columns to include (if not provided, includes all)
 * @returns A query request object ready to be sent to the API
 */
export const buildQueryRequest = (
  selectedDatasets: string[],
  datasetFilters: Record<string, Record<string, string[]>>,
  locationFilters: LocationFilter,
  timeFilters: TimeFilter,
  columnsToInclude?: Record<string, string[]>
): QueryRequest => {
  // Build tables array with selected datasets
  const tables = selectedDatasets.map(datasetId => {
    const tableQuery: TableQuery = {};
    
    // Determine columns to include
    let selectedColumns = columnsToInclude?.[datasetId] || ['*']; // Default to all columns
    
    // Ensure readable_coordinates is included for map visualization
    if (selectedColumns.length > 0 && !selectedColumns.includes('*') && !selectedColumns.includes('readable_coordinates')) {
      selectedColumns = [...selectedColumns, 'readable_coordinates'];
    }
    
    // Build dataset-specific filters
    const datasetFilterExpressions: QueryExpression[] = [];
    
    if (datasetFilters[datasetId]) {
      Object.entries(datasetFilters[datasetId]).forEach(([attributeName, values]) => {
        if (values.length > 0) {
          datasetFilterExpressions.push({
            column: attributeName,
            operator: values.length === 1 ? '=' : 'IN',
            value: values.length === 1 ? values[0] : values
          });
        }
      });
    }
    
    // Create table query object
    tableQuery[datasetId] = {
      selected_columns: selectedColumns,
    };
    
    // Add filters if we have any
    if (datasetFilterExpressions.length > 0) {
      tableQuery[datasetId].filters = {
        expressions: datasetFilterExpressions,
        logic: 'AND'
      };
    }
    
    return tableQuery;
  });
  
  // Build spatial join conditions from location filters
  // We'll create a single filter with all expressions and the correct logic between them
  const spatialExpressions: QueryExpression[] = [];
  let spatialLogic: 'AND' | 'OR' = locationFilters.logic || 'AND';
  
  // Add route expressions if any
  if (locationFilters.route && locationFilters.route.length > 0) {
    spatialExpressions.push({
      column: 'route',
      operator: locationFilters.route.length === 1 ? '=' : 'IN',
      value: locationFilters.route.length === 1 ? locationFilters.route[0] : locationFilters.route
    });
  }
  
  // Add region expressions if any
  if (locationFilters.region && locationFilters.region.length > 0) {
    spatialExpressions.push({
      column: 'region',
      operator: locationFilters.region.length === 1 ? '=' : 'IN',
      value: locationFilters.region.length === 1 ? locationFilters.region[0] : locationFilters.region
    });
  }
  
  // Add county expressions if any
  if (locationFilters.county && locationFilters.county.length > 0) {
    spatialExpressions.push({
      column: 'county',
      operator: locationFilters.county.length === 1 ? '=' : 'IN',
      value: locationFilters.county.length === 1 ? locationFilters.county[0] : locationFilters.county
    });
  }
  
  // Add city expressions if any
  if (locationFilters.city && locationFilters.city.length > 0) {
    spatialExpressions.push({
      column: 'city',
      operator: locationFilters.city.length === 1 ? '=' : 'IN',
      value: locationFilters.city.length === 1 ? locationFilters.city[0] : locationFilters.city
    });
  }
  
  // Create a single spatial join condition with all expressions and the correct logic
  const spatialJoinConditions: QueryFilter[] = [];
  if (spatialExpressions.length > 0) {
    spatialJoinConditions.push({
      expressions: spatialExpressions,
      logic: spatialLogic
    });
  }
  
  // Build temporal join conditions from time filters
  // We'll create a single filter with all time expressions and the correct logic between them
  const temporalExpressions: QueryExpression[] = [];
  let temporalLogic: 'AND' | 'OR' = timeFilters.logic || 'AND';
  
  // Add start date expression if available
  if (timeFilters.startDate) {
    temporalExpressions.push({
      column: 'date_start',
      operator: '>=',
      value: timeFilters.startDate
    });
  }
  
  // Add end date expression if available
  if (timeFilters.endDate) {
    temporalExpressions.push({
      column: 'date_start',
      operator: '<=',
      value: timeFilters.endDate
    });
  }
  
  // Create a single temporal join condition with all expressions and the correct logic
  const temporalJoinConditions: QueryFilter[] = [];
  if (temporalExpressions.length > 0) {
    temporalJoinConditions.push({
      expressions: temporalExpressions,
      logic: temporalLogic
    });
  }
  
  // Build the complete query request
  const queryRequest: QueryRequest = {
    parameters: {
      tables
    }
  };
  
  // Add spatial join conditions if we have any
  if (spatialJoinConditions.length > 0) {
    queryRequest.parameters.spatial_join_conditions = spatialJoinConditions;
  }
  
  // Add temporal join conditions if we have any
  if (temporalJoinConditions.length > 0) {
    queryRequest.parameters.temporal_join_conditions = temporalJoinConditions;
  }
  
  return queryRequest;
};

/**
 * Execute a query against the 511 Data Analytics API
 * 
 * @param queryRequest The query request to execute
 * @returns Promise with the query results
 */
export const executeQuery = async (queryRequest: QueryRequest): Promise<QueryResponse> => {
  try {
    const response = await fetch(`${API_PROXY_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryRequest),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

/**
 * Extract coordinates from query results for map visualization
 * 
 * @param queryResponse The query response from the API
 * @returns Array of map markers with coordinates and properties
 */
export const extractMapMarkers = (queryResponse: QueryResponse) => {
  const markers: any[] = [];
  
  // Check if results exist and is an object
  if (!queryResponse.results || typeof queryResponse.results !== 'object') {
    console.error('Invalid query response structure:', queryResponse);
    return markers;
  }
  
  // Process each dataset's results
  Object.entries(queryResponse.results).forEach(([datasetName, datasetResults]) => {
    // Check if datasetResults is an array before using forEach
    if (Array.isArray(datasetResults)) {
      datasetResults.forEach(result => {
        // Check if the result has coordinates
        if (result.readable_coordinates) {
          try {
            // Parse the coordinates from the POINT(lng lat) format
            const coordsMatch = result.readable_coordinates.match(/POINT\(([^ ]+) ([^)]+)\)/);
            
            if (coordsMatch && coordsMatch.length === 3) {
              const lng = parseFloat(coordsMatch[1]);
              const lat = parseFloat(coordsMatch[2]);
              
              if (!isNaN(lng) && !isNaN(lat)) {
                markers.push({
                  id: result.id,
                  datasetName,
                  position: [lat, lng], // Leaflet uses [lat, lng] format
                  properties: result,
                });
              }
            } else {
              // Try to parse MULTILINESTRING format
              const multiLineMatch = result.readable_coordinates.match(/MULTILINESTRING\(\(([^)]+)\)\)/);
              if (multiLineMatch && multiLineMatch.length > 1) {
                // Take the first point from the multiline string
                const points = multiLineMatch[1].split(',');
                if (points.length > 0) {
                  const firstPoint = points[0].split(' ');
                  if (firstPoint.length === 2) {
                    const lng = parseFloat(firstPoint[0]);
                    const lat = parseFloat(firstPoint[1]);
                    
                    if (!isNaN(lng) && !isNaN(lat)) {
                      markers.push({
                        id: result.id,
                        datasetName,
                        position: [lat, lng], // Leaflet uses [lat, lng] format
                        properties: result,
                      });
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error parsing coordinates:', error);
          }
        }
      });
    } else {
      console.warn(`Dataset results for ${datasetName} is not an array:`, datasetResults);
    }
  });
  
  return markers;
};
