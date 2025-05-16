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

// Cache with 15-minute TTL
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
const cache: Record<string, CacheItem> = {};

/**
 * Proxy API handler for fetching datasource metadata
 * This resolves CORS issues by fetching data from the server side
 * Implements caching to reduce API calls and improve loading times
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const cacheKey = 'datasources-metadata';
  const now = Date.now();
  
  // Check if we have a valid cached response
  if (cache[cacheKey] && (now - cache[cacheKey].timestamp) < CACHE_TTL) {
    // Set cache headers
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes
    return res.status(200).json(cache[cacheKey].data);
  }

  try {
    // Fetch data from the external API using axios with HTTPS agent
    const response = await axios.get(`${API_BASE_URL}/datasources-metadata/`, {
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Next.js Proxy Request'
      }
    });
    
    // Store in cache
    cache[cacheKey] = {
      data: response.data,
      timestamp: now
    };
    
    // Set cache headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes
    
    // Return the data
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching datasource metadata:', error);
    
    // If we have stale cache data, return it rather than an error
    if (cache[cacheKey]) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache[cacheKey].data);
    }
    
    return res.status(500).json({ message: 'Failed to fetch datasource metadata' });
  }
}
