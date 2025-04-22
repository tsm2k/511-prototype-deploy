import axios from 'axios';
import https from 'https';
import { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = 'http://127.0.0.1:5005/api/511DataAnalytics';
// const API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';


// Create HTTPS agent that trusts self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Proxy API handler for fetching attribute metadata
 * This resolves CORS issues by fetching data from the server side
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log(`Fetching from: ${API_BASE_URL}/information-attributes-metadata/`);
    // Fetch data from the external API using axios with HTTPS agent
    const response = await axios.get(`${API_BASE_URL}/information-attributes-metadata/`, {
      httpsAgent,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Next.js Proxy Request'
      }
    });
    
    // Return the data
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching attribute metadata:', error);
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
