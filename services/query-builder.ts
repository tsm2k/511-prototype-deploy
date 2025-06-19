import { LocationFilter, TimeFilter, PolygonCoordinates, LocationSelection } from "../types/filters";
import { getRoadCoordinates } from "./road-service";
import { getCityBoundary, getCountyBoundary } from "./political-subdivisions-service";
import { getDistrictBoundary, getSubdistrictBoundary } from "./agency-districts-service";
import { getPOICoordinates } from "./poi-service";

// Define US Holidays for date filtering
interface HolidayInfo {
  date: string;
  name: string;
}

const US_HOLIDAYS: Record<string, HolidayInfo> = {
  "new-years": { date: "2025-01-01", name: "New Year's Day" },
  "mlk": { date: "2025-01-20", name: "Martin Luther King Jr. Day" },
  "presidents": { date: "2025-02-17", name: "Presidents' Day" },
  "memorial": { date: "2025-05-26", name: "Memorial Day" },
  "independence": { date: "2025-07-04", name: "Independence Day" },
  "labor": { date: "2025-09-01", name: "Labor Day" },
  "columbus": { date: "2025-10-13", name: "Columbus Day" },
  "veterans": { date: "2025-11-11", name: "Veterans Day" },
  "thanksgiving": { date: "2025-11-27", name: "Thanksgiving" },
  "christmas": { date: "2025-12-25", name: "Christmas" },
  "easter": { date: "2025-04-20", name: "Easter" },
  "halloween": { date: "2025-10-31", name: "Halloween" },
  "valentines": { date: "2025-02-14", name: "Valentine's Day" },
  "st-patricks": { date: "2025-03-17", name: "St. Patrick's Day" },
  "mothers": { date: "2025-05-11", name: "Mother's Day" },
  "fathers": { date: "2025-06-15", name: "Father's Day" }
};

// Export holiday names for use in other components
export const HOLIDAY_NAMES: Record<string, string> = Object.entries(US_HOLIDAYS).reduce(
  (acc, [id, info]) => ({ ...acc, [id]: info.name }),
  {}
);

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
  granularity?: string;
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
      // Simplify the coordinates to reduce request size
      const simplifiedCoordinates = simplifyPolygonCoordinates(polygon.coordinates);
      
      // Create a GeoJSON-compatible polygon structure
      const geoJsonPolygon = {
        type: 'Polygon',
        coordinates: simplifiedCoordinates
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
            spatial_function: 'ST_DWithin',
            value: geoJsonRoad,
            distance: '30'

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
              spatial_function: 'ST_DWithin',
              value: geoJsonIntersection,
              distance: '30'
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
  
  // All datasets now use date_start consistently
  const dateStartDatasets = [
    'traffic_events',
    'lane_blockage_info',
    'dynamic_message_sign_info',
    'travel_time_system_info',
    'traffic_parking_info',
    'social_events',
    'rest_area_info',
    'variable_speed_limit_sign_info',
    'weather_info',
    'traffic_speed_info'
  ];
  
  // No longer need to track datasets that use data_retrieval_timestamp separately
  
  // Create temporal join conditions
  const temporalJoinConditions: QueryFilter[] = [];
  
  // Process selected datasets and create temporal conditions
  const dateStartExpressions: QueryExpression[] = [];
  
  // Add expressions for date_start datasets
  if (selectedDatasets.some((dataset: string) => dateStartDatasets.includes(dataset))) {
    // Add date range expressions
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
    
    // Add hourly filter if specified
    if (timeFilters.hours && timeFilters.hours.length > 0) {
      // Convert string hours to integers
      const hourValues = timeFilters.hours.map(h => parseInt(h, 10));
      
      // Convert local hours to UTC hours
      const utcHourValues = hourValues.map(localHour => {
        // Create a date object with the local hour
        const date = new Date();
        date.setHours(localHour, 0, 0, 0);
        
        // Get the UTC hour
        const utcHour = date.getUTCHours();
        console.log(`Converting local hour ${localHour} to UTC hour ${utcHour}`);
        return utcHour;
      });
      
      // If we have a continuous range of hours, use BETWEEN
      if (utcHourValues.length >= 2 && 
          Math.max(...utcHourValues) - Math.min(...utcHourValues) + 1 === utcHourValues.length && 
          utcHourValues.every((val, i, arr) => i === 0 || val === arr[i-1] + 1)) {
        dateStartExpressions.push({
          column: 'EXTRACT(HOUR FROM date_start)',
          operator: 'BETWEEN',
          value: [Math.min(...utcHourValues), Math.max(...utcHourValues)]
        });
      } else {
        // Otherwise use IN operator with the list of hours
        dateStartExpressions.push({
          column: 'EXTRACT(HOUR FROM date_start)',
          operator: 'IN',
          value: utcHourValues
        });
      }
    }
    
    // Add weekday filter if specified
    if (timeFilters.weekdays && timeFilters.weekdays.length > 0) {
      // Map weekday names to PostgreSQL DOW values (0=Sunday, 1=Monday, ..., 6=Saturday)
      const weekdayMap: Record<string, number> = {
        'Sun': 0,
        'Mon': 1,
        'Tue': 2,
        'Wed': 3,
        'Thu': 4,
        'Fri': 5,
        'Sat': 6
      };
      
      const dowValues = timeFilters.weekdays.map(day => weekdayMap[day]).filter(val => val !== undefined);
      
      if (dowValues.length > 0) {
        dateStartExpressions.push({
          column: 'EXTRACT(DOW FROM date_start)',
          operator: 'IN',
          value: dowValues
        });
      }
    }
    
    // Add monthly filter if specified
    if (timeFilters.monthDays && timeFilters.monthDays.length > 0) {
      // Handle special case for 'last' day of month
      const hasLastDay = timeFilters.monthDays.includes('last');
      
      // Filter out 'last' and convert remaining days to integers
      const dayValues = timeFilters.monthDays
        .filter(day => day !== 'last')
        .map(day => parseInt(day, 10))
        .filter(day => !isNaN(day));
      
      // Add regular days of month filter
      if (dayValues.length > 0) {
        dateStartExpressions.push({
          column: 'EXTRACT(DAY FROM date_start)',
          operator: 'IN',
          value: dayValues
        });
      }
      
      // Add special condition for last day of month if needed
      if (hasLastDay) {
        // Use a raw SQL expression for the last day of month
        dateStartExpressions.push({
          column: "date_start",
          operator: "=",
          value: "date_trunc('month', date_start) + interval '1 month - 1 day'"
        });
      }
    }
    
    // Add holiday filter if specified
    if (timeFilters.holidays && timeFilters.holidays.length > 0) {
      // Convert holiday IDs to actual dates
      const holidayDates: string[] = [];
      
      timeFilters.holidays.forEach(holidayId => {
        if (US_HOLIDAYS[holidayId as keyof typeof US_HOLIDAYS]) {
          holidayDates.push(US_HOLIDAYS[holidayId as keyof typeof US_HOLIDAYS].date);
        }
      });
      
      if (holidayDates.length > 0) {
        console.log('Adding holiday dates to filter:', holidayDates);
        
        // For each holiday date, add a separate expression to check if the date_start falls on that day
        // This uses a simpler approach that's more compatible with PostgreSQL
        holidayDates.forEach(date => {
          dateStartExpressions.push({
            column: "date_start::date", // Cast to date to ignore time component
            operator: "=",
            value: date
          });
        });
      }
    }
  }
  
  // All datasets now use date_start consistently
  // No need to handle data_retrieval_timestamp separately anymore
    

    

    

    

  
  // Add temporal join conditions if we have expressions
  if (dateStartExpressions.length > 0) {
    temporalJoinConditions.push({
      expressions: dateStartExpressions,
      logic: temporalLogic
    });
  }
  
  // If no conditions were added (unlikely), add a default one
  if (temporalJoinConditions.length === 0) {
    const defaultExpressions: QueryExpression[] = [
      {
        column: 'date_start',
        operator: '>=',
        value: startDate
      },
      {
        column: 'date_start',
        operator: '<=',
        value: endDate
      }
    ];
    
    temporalJoinConditions.push({
      expressions: defaultExpressions,
      logic: temporalLogic
    });
  }
  
  // Log the timeFilters to debug granularity
  console.log('TimeFilters in buildQueryRequest:', timeFilters);
  
  // Build the final query request
  // Ensure granularity is a top-level parameter in the query request
  const queryRequest = {
    parameters: {
      tables,
      spatial_join_conditions: spatialJoinConditions.length > 0 ? spatialJoinConditions : undefined,
      temporal_join_conditions: temporalJoinConditions, // Always include temporal join conditions
      granularity: timeFilters.granularity || "1H" // Always include granularity, default to "1H" if not provided
    }
  };
  
  // Make sure granularity is not undefined or null
  if (!queryRequest.parameters.granularity) {
    queryRequest.parameters.granularity = "1H";
  }
  
  console.log('Final query request parameters:', queryRequest.parameters);
  
  return queryRequest;
};

/**
 * Execute a query against the 511 Data Analytics API
 * 
 * @param queryRequest The query request to execute
 * @returns Promise with the query results
 */
/**
 * Simplify polygon coordinates to reduce request size
 * This helps prevent "Request Header Fields Too Large" errors (431)
 * 
 * @param coordinates The original polygon coordinates
 * @returns Simplified polygon coordinates
 */
const simplifyPolygonCoordinates = (coordinates: number[][][]): number[][][] => {
  // If the coordinates array is very large, simplify it
  if (coordinates.length > 0 && coordinates[0].length > 100) {
    // Keep only every Nth point to reduce size
    // Adjust the sampling rate based on the size of the coordinates
    const samplingRate = Math.max(Math.floor(coordinates[0].length / 100), 2);
    
    return coordinates.map(ring => {
      // Always keep first and last point to maintain the polygon shape
      const firstPoint = ring[0];
      const lastPoint = ring[ring.length - 1];
      
      // Sample points from the ring
      const sampledPoints = ring.filter((_, index) => index % samplingRate === 0);
      
      // Make sure the first and last points are included
      if (sampledPoints.length === 0 || 
          sampledPoints[0][0] !== firstPoint[0] || 
          sampledPoints[0][1] !== firstPoint[1]) {
        sampledPoints.unshift(firstPoint);
      }
      
      if (sampledPoints.length === 0 || 
          sampledPoints[sampledPoints.length - 1][0] !== lastPoint[0] || 
          sampledPoints[sampledPoints.length - 1][1] !== lastPoint[1]) {
        sampledPoints.push(lastPoint);
      }
      
      // Ensure we have at least 4 points for a valid polygon
      if (sampledPoints.length < 4) {
        // If we don't have enough points, add more from the original
        const additionalPoints = Math.min(4 - sampledPoints.length, ring.length - sampledPoints.length);
        for (let i = 0; i < additionalPoints; i++) {
          const index = Math.floor(i * ring.length / additionalPoints);
          if (!sampledPoints.some(p => p[0] === ring[index][0] && p[1] === ring[index][1])) {
            sampledPoints.push(ring[index]);
          }
        }
      }
      
      return sampledPoints;
    });
  }
  
  // If the coordinates are not too large, return them as is
  return coordinates;
};

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

