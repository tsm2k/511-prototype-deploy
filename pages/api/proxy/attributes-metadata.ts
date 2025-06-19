import axios from 'axios';
import https from 'https';
import { NextApiRequest, NextApiResponse } from 'next';

// const API_BASE_URL = 'http://127.0.0.1:5005/api/511DataAnalytics';
const API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';

// Create HTTPS agent that trusts self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// In-memory cache
interface CacheItem {
  data: any;
  timestamp: number;
}

// Cache with 30-minute TTL (attributes change less frequently than datasources)
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
const cache: Record<string, CacheItem> = {};

// Interface for paginated API response
interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: any[];
}

/**
 * Fetches all pages of data from a paginated API endpoint
 * @param baseUrl The base URL of the API
 * @param limit Optional limit parameter for each request
 * @returns Promise with all results combined
 */
async function fetchAllPages(baseUrl: string, limit: number = 1000): Promise<any[]> {
  let allResults: any[] = [];
  let nextUrl: string | null = `${baseUrl}?limit=${limit}`;
  
  while (nextUrl) {
    const response = await axios.get(nextUrl, {
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Next.js Proxy Request'
      }
    });
    
    const data = response.data as PaginatedResponse;
    allResults = [...allResults, ...data.results];
    
    // Update nextUrl for pagination
    nextUrl = data.next;
  }
  
  return allResults;
}

/**
 * Proxy API handler for fetching attribute metadata
 * This resolves CORS issues by fetching data from the server side
 * Implements caching to reduce API calls and improve loading times
 * Handles pagination to ensure all attributes are fetched
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const cacheKey = 'attributes-metadata';
  const now = Date.now();
  
  // Check if we have a valid cached response
  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_TTL) {
    // Set cache headers
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes
    return res.status(200).json(cache[cacheKey].data);
  }

  try {
    // Fetch all pages of data from the external API
    const allResults = await fetchAllPages(`${API_BASE_URL}/information-attributes-metadata`);
    
    // Create a response object that matches the expected format
    const responseData = {
      count: allResults.length,
      next: null,
      previous: null,
      results: allResults
    };
    
    // Store in cache
    cache[cacheKey] = {
      data: responseData,
      timestamp: now
    };
    
    // Set cache headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes
    
    // Return the data
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching attribute metadata:', error);
    
    // If we have stale cache data, return it rather than an error
    if (cache[cacheKey]) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache[cacheKey].data);
    }
    
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = {
      message: 'Failed to fetch attribute metadata',
      error: errorMessage,
      details: error instanceof Error && 'response' in error ? (error as any).response?.data : null
    };
    return res.status(500).json(errorResponse);
  }
}
