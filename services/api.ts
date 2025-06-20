/**
 * API service for fetching data from the 511 Data Analytics API
 */

// Base URL for the external API (for reference only)
// const EXTERNAL_API_BASE_URL = 'https://127.0.0.1:5005/api/511DataAnalytics';

// Use local proxy API to avoid CORS issues
const API_PROXY_URL = '/api/proxy';

/**
 * Interface for datasource metadata
 */
export interface DataSourceMetadata {
  url: string;
  datasource_name: string;
  datasource_type: string;
  datasource_status: string;
  datasource_api_address: string;
  datasource_tablename: string;
}

/**
 * Interface for API response containing datasource metadata
 */
export interface DataSourceMetadataResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DataSourceMetadata[];
}

/**
 * Fetch all datasource metadata from the API
 * @returns Promise with datasource metadata
 */
export const fetchDataSourcesMetadata = async (): Promise<DataSourceMetadata[]> => {
  try {
    // Use the local proxy endpoint to avoid CORS issues
    const response = await fetch(`${API_PROXY_URL}/datasources-metadata`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data: DataSourceMetadataResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching datasource metadata:', error);
    return [];
  }
};

/**
 * Convert datasource metadata to ColorMultiSelectOption format
 * @param metadata Datasource metadata from API
 * @returns Formatted option for ColorMultiSelect component
 */
export const mapDataSourceToOption = (metadata: DataSourceMetadata) => {
  return {
    value: metadata.datasource_tablename,
    label: metadata.datasource_name,
    description: `${metadata.datasource_name} (${metadata.datasource_type})`,
    source: metadata.datasource_api_address,
    href: metadata.datasource_api_address
  };
};

/**
 * Interface for location data API response
 */
export interface LocationApiResponse {
  results: Array<Record<string, string[]>>
}

/**
 * Interface for location data
 */
export interface LocationData {
  city: string[]
  district: string[]
  route: string[]
}

/**
 * Interface for dataset attribute metadata
 */
export interface DatasetAttributeMetadata {
  url: string;
  datasource_metadata: string;
  attribute_json_name: string;
  attribute_json_path: string;
  attribute_column_name: string;
  attribute_ui_name: string;
  attribute_datatype: string;
  attribute_logical_datatype: string;
  attribute_logical_datatype_description: string;
  subattribute_id: number | null;
  attribute_category: string;
  attribute_category_description: string;
  attribute_ui_priority?: number; // Priority for UI display (1-4: primary, 5-8: additional, 10: hidden)
}

/**
 * Interface for dataset attribute metadata response
 */
export interface DatasetAttributeMetadataResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DatasetAttributeMetadata[];
}

/**
 * Interface for attribute filter values response
 */
export interface AttributeFilterValuesResponse {
  results: Array<Record<string, string[]>>
}

/**
 * Fetch location data from the API
 * @param tableName The table name to fetch location data from
 * @returns Promise with location data
 */
/**
 * Fetch dataset attribute metadata from the API
 * @returns Promise with dataset attribute metadata
 */
export const fetchDatasetAttributesMetadata = async (): Promise<DatasetAttributeMetadata[]> => {
  try {
    // Use the local proxy endpoint to avoid CORS issues
    const response = await fetch(`${API_PROXY_URL}/attributes-metadata`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data: DatasetAttributeMetadataResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching dataset attribute metadata:', error);
    return [];
  }
};

/**
 * Get datasource tablename from datasource name
 * @param datasourceName The datasource name to get tablename for
 * @param datasources The list of datasources
 * @returns The datasource tablename
 */
export const getDatasourceTablename = (datasourceName: string, datasources: DataSourceMetadata[]): string | undefined => {
  const datasource = datasources.find(ds => ds.datasource_name === datasourceName);
  return datasource?.datasource_tablename;
};

/**
 * Fetch attribute filter values from the API
 * @param tableName The table name to fetch filter values from
 * @param columnNames The column names to fetch filter values for
 * @returns Promise with attribute filter values
 */
export const fetchAttributeFilterValues = async (
  tableName: string,
  columnNames: string[]
): Promise<Record<string, string[]>> => {
  try {
    // Use the local proxy endpoint to avoid CORS issues
    const columnNamesParam = columnNames.join(',');
    const response = await fetch(`${API_PROXY_URL}/column-filter-values?table_name=${tableName}&column_names=${columnNamesParam}`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const apiResponse: AttributeFilterValuesResponse = await response.json();
    
    // Process the response data
    const result: Record<string, string[]> = {};
    
    // Handle special case for social_events table with date_start and event_name
    if (tableName === 'social_events' && 
        columnNames.includes('event_name') && 
        columnNames.includes('date_start')) {
      
      // Find the arrays in the response
      let eventNames: string[] = [];
      let dateStarts: string[] = [];
      
      apiResponse.results.forEach(item => {
        if (item.event_name) eventNames = item.event_name.filter(name => name !== null && name !== '');
        if (item.date_start) dateStarts = item.date_start.filter(date => date !== null && date !== '');
      });
      
      console.log(`Found ${eventNames.length} event names and ${dateStarts.length} date starts`);
      
      // Create paired arrays where we only include events that have valid dates
      const pairedEventNames: string[] = [];
      const pairedDateStarts: string[] = [];
      
      // Create a map of event names to dates
      const eventMap = new Map<string, string>();
      
      // First, pair up events with dates as far as possible
      for (let i = 0; i < Math.min(eventNames.length, dateStarts.length); i++) {
        if (eventNames[i] && dateStarts[i]) {
          eventMap.set(eventNames[i], dateStarts[i]);
          pairedEventNames.push(eventNames[i]);
          pairedDateStarts.push(dateStarts[i]);
        }
      }
      
      // Store the paired results
      result['event_name'] = pairedEventNames;
      result['date_start'] = pairedDateStarts;
      
      console.log(`Paired ${pairedEventNames.length} events with dates`);
    } else {
      // Standard processing for other tables/columns
      apiResponse.results.forEach((item) => {
        Object.entries(item).forEach(([key, values]) => {
          result[key] = values.filter(value => value !== null && value !== '');
        });
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching attribute filter values:', error);
    return {};
  }
};

/**
 * Fetch social events data with proper event name and date pairings
 * This uses a dedicated endpoint that maintains the relationship between event names and dates
 * @returns Promise with social events data
 */
export const fetchSocialEvents = async (): Promise<Record<string, string[]>> => {
  try {
    console.log('Fetching social events directly using query API');
    
    // Create a query to fetch all social events with their names, dates, and locations
    const queryParams = {
      parameters: {
        tables: [
          {
            social_events: {
              selected_columns: [
                "event_name",
                "date_start",
                "city",
                "event_location_name"
              ]
            }
          }
        ]
      }
    };
    
    // Execute the query
    const queryResponse = await executeQuery(queryParams);
    
    // The API response has a nested structure: results[0].social_events is the array of events
    const socialEventsArray = queryResponse.results?.[0]?.social_events || [];
    console.log(`Received ${socialEventsArray.length} social events from direct query`);
    

    
    // Create arrays for event names, dates, and locations
    const eventNames: string[] = [];
    const dateStarts: string[] = [];
    const cities: string[] = [];
    const venues: string[] = [];
    
    // Process each social event and log Taylor Swift events immediately
    socialEventsArray.forEach((event: any) => {

      
      // Continue with normal processing
      if (event.event_name) {
        eventNames.push(event.event_name);
      }
      // Always push the date_start value, even if null, to maintain array alignment
      dateStarts.push(event.date_start || null);
      // Add city information
      if (event.city) {
        cities.push(event.city);
      } else {
        cities.push(''); // Add empty string to maintain array alignment
      }
      // Add venue information
      if (event.event_location_name) {
        venues.push(event.event_location_name);
      } else {
        venues.push(''); // Add empty string to maintain array alignment
      }
    });
    
    console.log(`Processed ${eventNames.length} event names and ${dateStarts.length} dates from direct query`);
    
    return {
      'event_name': eventNames,
      'date_start': dateStarts,
      'city': cities,
      'event_location_name': venues
    };
  } catch (error) {
    console.error('Error in fallback social events fetch:', error);
    return { 'event_name': [], 'date_start': [], 'city': [], 'event_location_name': [] };
  }
};

/**
 * Execute a query against the 511 Data Analytics API
 * @param queryParams The query parameters to send to the API
 * @returns Promise with the query results
 */
export const executeQuery = async (queryParams: any): Promise<any> => {
  try {
    console.log('Executing query with params:', JSON.stringify(queryParams, null, 2));
    
    // Use the local proxy endpoint to avoid CORS issues
    const response = await fetch(`${API_PROXY_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryParams),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response not OK:', response.status, errorText);
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    // Log the structure of the response
    console.log('API response structure:', {
      hasResults: !!data.results,
      resultKeys: data.results ? Object.keys(data.results) : [],
      sampleData: data.results ? Object.entries(data.results).map(([key, value]) => {
        const items = Array.isArray(value) ? value : [];
        return {
          dataset: key,
          count: items.length,
          sampleKeys: items.length > 0 ? Object.keys(items[0]) : [],
          hasCoordinates: items.length > 0 ? !!items[0].readable_coordinates : false
        };
      }) : []
    });
    
    return data;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

export const fetchLocationData = async (tableName: string = 'event_location_info'): Promise<LocationData> => {
  try {
    // Use the local proxy endpoint to avoid CORS issues
    const response = await fetch(`${API_PROXY_URL}/column-filter-values?table_name=${tableName}`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const apiResponse: LocationApiResponse = await response.json();
    
    // Process the response data
    const data: LocationData = {
      city: [],
      district: [],
      route: []
    };
    
    apiResponse.results.forEach((item) => {
      if (item.city) {
        data.city = item.city.filter(city => city !== null && city !== '');
      }
      if (item.district) {
        data.district = item.district.filter(district => district !== null && district !== '');
      }
      if (item.route) {
        data.route = item.route.filter(route => route !== null && route !== '');
      }
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching location data:', error);
    
    // Return fallback data in case of API failure
    return {
      city: [
        "Anderson", "Auburn", "Bedford", "Beech Grove", "Bloomington", "Boonville", "Brownsburg",
        "Burns Harbor", "Carlisle", "Carmel", "Clarksville", "Clear Creek", "Cloverdale", "Columbus",
        "Crawfordsville", "Crown Point", "Evansville", "Fishers", "Fort Wayne", "Franklin", "Gary",
        "Gas City", "Greenfield", "Greensburg", "Greens Fork", "Greenwood", "Grissom AFB", "Hammond",
        "Henryville", "Hobart", "Huntington", "Indianapolis", "Ingalls", "Jeffersonville", "Kokomo",
        "Lake Station", "Lawrence", "Lebanon", "Louisville", "Martinsville", "Medora", "Memphis",
        "Merrillville", "Middlebury", "Mooresville", "Munster", "New Albany", "Noblesville", "Orland",
        "Orleans", "Paoli", "Pendleton", "Pipe Creek", "Plainfield", "Plymouth", "Portage", "Porter",
        "Remington", "Roselawn", "Scottsburg", "Sellersburg", "Shelbyville", "Speedway", "Spiceland",
        "Taylorsville", "Tecumseh", "Terre Haute", "Versailles", "Wabash", "Westfield", "Whiteland",
        "Whitestown", "Wolcott", "Zionsville"
      ],
      district: [
        "CRAWFORDSVILLE", "FORT WAYNE", "GREENFIELD", "LAPORTE", "SEYMOUR", "VINCENNES"
      ],
      route: [
        "I-265", "I-275", "I-465", "I-469", "I-64", "I-65", "I-69", "I-70", "I-74", "I-80",
        "I-80 Illinois", "I-865", "I-94", "IN 1", "IN 10", "IN 114", "IN 13", "IN 135", "IN 15",
        "IN 161", "IN 2", "IN 213", "IN 235", "IN 236", "IN 250", "IN 252", "IN 256", "IN 32",
        "IN 327", "IN 337", "IN 37", "IN 38", "IN 39", "IN 42", "IN 44", "IN 45", "IN 450",
        "IN 46", "IN 56", "IN 57", "IN 61", "IN 62", "IN 63", "IN 66", "IN 67", "IN 7", "IN 70",
        "US 150", "US 20", "US 231", "US 24", "US 27", "US 30", "US 31", "US 35", "US 40",
        "US 41", "US 421", "US 50", "US 52", "US 6"
      ]
    };
  }
};
