import axios from 'axios';
import https from 'https';
import { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';

// Create HTTPS agent that trusts self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Proxy API handler for fetching column filter values
 * This resolves CORS issues by fetching data from the server side
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { table_name, column_names } = req.query;

    if (!table_name || typeof table_name !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid table_name parameter' });
    }

    // Build params object
    const params: Record<string, string> = { table_name };
    
    // Add column_names if provided
    if (column_names && typeof column_names === 'string') {
      params.column_names = column_names;
    }

    console.log(`Fetching from: ${API_BASE_URL}/column_filter_values/ with params:`, params);
    // Fetch data from the external API using axios with HTTPS agent
    const response = await axios.get(`${API_BASE_URL}/column_filter_values/`, {
      params,
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Next.js Proxy Request'
      }
    });
    
    // Return the data
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching column filter values:', error);
    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorResponse = {
      message: 'Failed to fetch column filter values',
      error: errorMessage,
      details: error instanceof Error && 'response' in error ? (error as any).response?.data : null
    };
    return res.status(500).json(errorResponse);
  }
}
