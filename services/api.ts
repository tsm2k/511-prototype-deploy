/**
 * API service for fetching data from the 511 Data Analytics API
 */

// Base URL for the external API (for reference only)
// const EXTERNAL_API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';

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
    
    apiResponse.results.forEach((item) => {
      Object.entries(item).forEach(([key, values]) => {
        result[key] = values.filter(value => value !== null && value !== '');
      });
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching attribute filter values:', error);
    return {};
  }
};

/**
 * Execute a query against the 511 Data Analytics API
 * @param queryParams The query parameters to send to the API
 * @returns Promise with the query results
 */
export const executeQuery = async (queryParams: any): Promise<any> => {
  try {
    // Use the local proxy endpoint to avoid CORS issues
    const response = await fetch(`${API_PROXY_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryParams),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
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
