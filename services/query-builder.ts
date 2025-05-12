import { LocationFilter, TimeFilter, PolygonCoordinates, LocationSelection } from "../types/filters";
import { getRoadCoordinates } from "./road-service";
import { getCityBoundary, getCountyBoundary } from "./political-subdivisions-service";
import { getDistrictBoundary, getSubdistrictBoundary } from "./agency-districts-service";
import { getPOICoordinates } from "./poi-service";

// API proxy URL
const API_PROXY_URL = '/api/proxy';

// Types for query construction
export interface QueryExpression {
  column?: string;
  operator?: string;
  value?: string | string[] | number | null | Record<string, any>;
  spatial_function?: string;
  distance?: string; // For ST_DWithin spatial function
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
export const buildQueryRequest = async (
  selectedDatasets: string[],
  datasetFilters: Record<string, Record<string, string[]>>,
  locationFilters: LocationFilter,
  timeFilters: TimeFilter,
  columnsToInclude?: Record<string, string[]>
): Promise<QueryRequest> => {
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
  
  // Create a single spatial join condition with all expressions and the correct logic
  const spatialJoinConditions: QueryFilter[] = [];
  let spatialLogic: 'AND' | 'OR' = locationFilters.logic || 'AND';
  
  // Handle polygon spatial conditions (from polygons array)
  if (locationFilters.polygons && locationFilters.polygons.length > 0) {
    // Create a new spatial filter if we don't have one yet
    if (spatialJoinConditions.length === 0) {
      spatialJoinConditions.push({
        expressions: [],
        logic: spatialLogic
      });
    }
    
    // Add each polygon as a spatial expression
    locationFilters.polygons.forEach(polygon => {
      // Create a GeoJSON-compatible polygon structure
      const geoJsonPolygon = {
        type: 'Polygon',
        coordinates: polygon.coordinates
      };
      
      // Create a spatial expression for this polygon
      const polygonExpression: QueryExpression = {
        spatial_function: 'ST_Intersects',
        value: geoJsonPolygon
      };
      
      // Add to the spatial join condition
      spatialJoinConditions[0].expressions.push(polygonExpression);
    });
  }
  
  // Now handle the locationSelections structure
  if (locationFilters.locationSelections && locationFilters.locationSelections.length > 0) {
    // Create a new spatial filter if we don't have one yet
    if (spatialJoinConditions.length === 0) {
      spatialJoinConditions.push({
        expressions: [],
        logic: spatialLogic
      });
    }
    
    for (const selection of locationFilters.locationSelections) {
      // Handle POIs (locations with radius)
      if ((selection.type === "poi" || (selection.poiRadius !== undefined && selection.poiRadius > 0)) && typeof selection.selection === 'string') {
        // This is a Point of Interest - use ST_DWithin with coordinates and radius
        const poiName = selection.selection;
        
        // Get the actual POI coordinates from the service
        const poiCoordinatesData = await getPOICoordinates(poiName);
        
        if (poiCoordinatesData) {
          // Create the GeoJSON Point object for the POI using the actual coordinates
          const poiCoordinates = {
            type: 'Point',
            coordinates: [poiCoordinatesData.lng, poiCoordinatesData.lat]
          };
          
          // Convert radius from miles to meters (approximate)
          // Default to 0 if poiRadius is undefined
          const radiusInMeters = (selection.poiRadius || 0) * 1609.34;
          
          // Create a spatial expression using ST_DWithin
          const poiExpression: QueryExpression = {
            spatial_function: 'ST_DWithin',
            value: poiCoordinates,
            distance: radiusInMeters.toString()
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(poiExpression);
        } else {
          console.error(`Could not find coordinates for POI: ${poiName}`);
        }
      }
      // Handle roads using coordinates
      else if (selection.type === 'road' && typeof selection.selection === 'string') {
        // Get road coordinates from the road service
        const roadName = selection.selection;
        const roadCoordinates = await getRoadCoordinates(roadName);
        
        if (roadCoordinates) {
          // Create a GeoJSON-compatible LineString structure
          const geoJsonRoad = {
            type: 'MultiLineString',
            coordinates: roadCoordinates
          };
          
          // Create a spatial expression for this road using ST_Intersects
          const roadExpression: QueryExpression = {
            spatial_function: 'ST_Intersects',
            value: geoJsonRoad
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(roadExpression);
        }
      }
      // Handle cities using coordinates
      else if (selection.type === 'city' && typeof selection.selection === 'string') {
        // Get city boundary from the political subdivisions service
        const cityName = selection.selection;
        const cityFeature = await getCityBoundary(cityName);
        
        if (cityFeature && cityFeature.geometry) {
          // Create a spatial expression for this city using ST_Intersects
          const cityExpression: QueryExpression = {
            spatial_function: 'ST_Intersects',
            value: cityFeature.geometry
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(cityExpression);
        }
      }
      // Handle counties using coordinates
      else if (selection.type === 'county' && typeof selection.selection === 'string') {
        // Get county boundary from the political subdivisions service
        const countyName = selection.selection;
        const countyFeature = await getCountyBoundary(countyName);
        
        if (countyFeature && countyFeature.geometry) {
          // Create a spatial expression for this county using ST_Intersects
          const countyExpression: QueryExpression = {
            spatial_function: 'ST_Intersects',
            value: countyFeature.geometry
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(countyExpression);
        }
      }
      // Handle districts using coordinates
      else if (selection.type === 'district' && typeof selection.selection === 'string') {
        // Get district boundary from the agency districts service
        const districtName = selection.selection;
        const districtFeature = await getDistrictBoundary(districtName);
        
        if (districtFeature && districtFeature.geometry) {
          // Create a spatial expression for this district using ST_Intersects
          const districtExpression: QueryExpression = {
            spatial_function: 'ST_Intersects',
            value: districtFeature.geometry
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(districtExpression);
        }
      }
      // Handle subdistricts using coordinates
      else if (selection.type === 'subdistrict' && typeof selection.selection === 'string') {
        // Get subdistrict boundary from the agency districts service
        const subdistrictName = selection.selection;
        const subdistrictFeature = await getSubdistrictBoundary(subdistrictName);
        
        if (subdistrictFeature && subdistrictFeature.geometry) {
          // Create a spatial expression for this subdistrict using ST_Intersects
          const subdistrictExpression: QueryExpression = {
            spatial_function: 'ST_Intersects',
            value: subdistrictFeature.geometry
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(subdistrictExpression);
        }
      }
      // Handle polygons and intersections
      else if (selection.type === 'polygon' && 
               typeof selection.selection === 'object' && selection.selection !== null) {
        const polygonData = selection.selection as PolygonCoordinates;
        
        if (polygonData.coordinates) {
          // Create a GeoJSON-compatible polygon structure
          const geoJsonPolygon = {
            type: 'Polygon',
            coordinates: polygonData.coordinates
          };
          
          // Create a spatial expression for this polygon
          const polygonExpression: QueryExpression = {
            spatial_function: 'ST_Intersects',
            value: geoJsonPolygon
          };
          
          // Add to the spatial join condition
          spatialJoinConditions[0].expressions.push(polygonExpression);
        }
      }
      // Handle road-subdivision intersections
      else if (selection.type === 'intersection' && 
               typeof selection.selection === 'string') {
        // Format is typically "RoadName ∩ SubdivisionName"
        const intersectionName = selection.selection as string;
        const parts = intersectionName.split(' ∩ ');
        
        if (parts.length === 2) {
          const roadName = parts[0].trim();
          const subdivisionName = parts[1].trim();
          
          console.log(`Processing API query for intersection between ${roadName} and ${subdivisionName}`);
          
          // Check if we have actual intersection coordinates in the selection
          if (selection.coordinates) {
            // Use the actual intersection coordinates calculated by Turf.js
            console.log('Using pre-calculated intersection coordinates');
            
            // Create a GeoJSON LineString from the intersection coordinates
            const geoJsonIntersection = {
              type: 'LineString',
              coordinates: selection.coordinates
            };
            
            // Create a spatial expression using the intersection coordinates
            const intersectionExpression: QueryExpression = {
              spatial_function: 'ST_Intersects',
              value: geoJsonIntersection
            };
            
            // Add the intersection expression to the spatial join conditions
            spatialJoinConditions[0].expressions.push(intersectionExpression);
          } else {
            // Fallback to the old approach if no intersection coordinates are available
            console.log('No pre-calculated intersection coordinates found, using fallback method');
            
            // Get road coordinates
            const roadCoordinates = await getRoadCoordinates(roadName);
            
            // Determine the subdivision type and get its boundary
            // We'll try each type in sequence
            let subdivisionFeature = null;
            
            // Try city first
            subdivisionFeature = await getCityBoundary(subdivisionName);
            
            // If not a city, try county
            if (!subdivisionFeature) {
              subdivisionFeature = await getCountyBoundary(subdivisionName);
            }
            
            // If not a county, try district
            if (!subdivisionFeature) {
              subdivisionFeature = await getDistrictBoundary(subdivisionName);
            }
            
            // If not a district, try subdistrict
            if (!subdivisionFeature) {
              subdivisionFeature = await getSubdistrictBoundary(subdivisionName);
            }
            
            if (roadCoordinates && subdivisionFeature && subdivisionFeature.geometry) {
              // Create a GeoJSON-compatible LineString structure for the road
              const geoJsonRoad = {
                type: 'MultiLineString',
                coordinates: roadCoordinates
              };
              
              // Create a spatial expression for the road
              const roadExpression: QueryExpression = {
                spatial_function: 'ST_Intersects',
                value: geoJsonRoad
              };
              
              // Create a spatial expression for the subdivision
              const subdivisionExpression: QueryExpression = {
                spatial_function: 'ST_Intersects',
                value: subdivisionFeature.geometry
              };
              
              // Add both expressions to create an intersection (AND logic)
              spatialJoinConditions[0].expressions.push(roadExpression);
              spatialJoinConditions[0].expressions.push(subdivisionExpression);
              
              // Ensure the logic is AND for this specific intersection
              spatialJoinConditions[0].logic = 'AND';
            }
          }
        }
      }
      // For all other location types, we'll implement spatial functions in the future
      // Currently, we're not adding any column-based filters
    }
  }
  
  // Build temporal join conditions from time filters
  let temporalLogic: 'AND' | 'OR' = timeFilters.logic || 'AND';
  
  // Get current date for default end date if needed
  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Get default start date (7 days ago) if needed
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 7);
  const formattedDefaultStart = defaultStartDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Get the start and end dates (use defaults if not provided)
  const startDate = timeFilters.startDate || formattedDefaultStart;
  const endDate = timeFilters.endDate || formattedToday;
  
  console.log(`Using date range: ${startDate} to ${endDate}`);
  
  // Define datasets that use date_start instead of data_retrieval_timestamp
  const dateStartDatasets = [
    'traffic_events',
    'lane_blockage_info',
    'dynamic_message_sign_info',
    'travel_time_system_info',
    'traffic_parking_info',
    'social_events'
  ];
  
  // Define datasets that use data_retrieval_timestamp
  const dataRetrievalTimestampDatasets = [
    'rest_area_info',
    'variable_speed_limit_sign_info',
    'weather_info'
  ];
  
  // Create temporal join conditions for each dataset type
  const temporalJoinConditions: QueryFilter[] = [];
  
  // Process selected datasets and create appropriate temporal conditions
  const dateStartExpressions: QueryExpression[] = [];
  const dataRetrievalExpressions: QueryExpression[] = [];
  
  // Add expressions for date_start datasets
  if (selectedDatasets.some((dataset: string) => dateStartDatasets.includes(dataset))) {
    dateStartExpressions.push({
      column: 'date_start',
      operator: '>=',
      value: startDate
    });
    dateStartExpressions.push({
      column: 'date_start',
      operator: '<=',
      value: endDate
    });
  }
  
  // Add expressions for data_retrieval_timestamp datasets
  if (selectedDatasets.some((dataset: string) => dataRetrievalTimestampDatasets.includes(dataset)) ||
      selectedDatasets.some((dataset: string) => !dateStartDatasets.includes(dataset) && !dataRetrievalTimestampDatasets.includes(dataset))) {
    dataRetrievalExpressions.push({
      column: 'data_retrieval_timestamp',
      operator: '>=',
      value: startDate
    });
    dataRetrievalExpressions.push({
      column: 'data_retrieval_timestamp',
      operator: '<=',
      value: endDate
    });
  }
  
  // Add temporal join conditions if we have expressions
  if (dateStartExpressions.length > 0) {
    temporalJoinConditions.push({
      expressions: dateStartExpressions,
      logic: temporalLogic
    });
  }
  
  if (dataRetrievalExpressions.length > 0) {
    temporalJoinConditions.push({
      expressions: dataRetrievalExpressions,
      logic: temporalLogic
    });
  }
  
  // If no conditions were added (unlikely), add a default one
  if (temporalJoinConditions.length === 0) {
    const defaultExpressions: QueryExpression[] = [
      {
        column: 'data_retrieval_timestamp',
        operator: '>=',
        value: startDate
      },
      {
        column: 'data_retrieval_timestamp',
        operator: '<=',
        value: endDate
      }
    ];
    
    temporalJoinConditions.push({
      expressions: defaultExpressions,
      logic: temporalLogic
    });
  }
  
  // Build the final query request
  return {
    parameters: {
      tables,
      spatial_join_conditions: spatialJoinConditions.length > 0 ? spatialJoinConditions : undefined,
      temporal_join_conditions: temporalJoinConditions // Always include temporal join conditions
    }
  };
};

/**
 * Execute a query against the 511 Data Analytics API
 * 
 * @param queryRequest The query request to execute
 * @returns Promise with the query results
 */
export const executeQuery = async (queryRequest: QueryRequest): Promise<QueryResponse> => {
  try {
    const response = await fetch(API_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryRequest),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data as QueryResponse;
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
export const extractMapMarkers = (queryResponse: QueryResponse): any[] => {
  const markers: any[] = [];

  if (!queryResponse || !queryResponse.results) {
    return markers;
  }

  // Process each dataset in the results
  Object.entries(queryResponse.results).forEach(([datasetName, datasetResults]) => {
    if (!Array.isArray(datasetResults) || datasetResults.length === 0) {
      return;
    }

    // Process each result in the dataset
    datasetResults.forEach(result => {
      if (!result.readable_coordinates) {
        return;
      }
      
      try {
        // Parse the readable coordinates
        const coordinates = JSON.parse(result.readable_coordinates);
        
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
          return;
        }
        
        // Create a marker with the coordinates and properties
        markers.push({
          ...result,
          coordinates,
          datasetName
        });
      } catch (error) {
        console.error(`Error parsing coordinates for ${datasetName}:`, error);
      }
    });
  });
  
  return markers;
};

