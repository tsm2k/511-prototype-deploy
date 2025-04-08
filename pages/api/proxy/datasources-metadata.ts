import axios from 'axios';
import https from 'https';
import { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';

// Create HTTPS agent that trusts self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Proxy API handler for fetching datasource metadata
 * This resolves CORS issues by fetching data from the server side
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
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
    
    // Return the data
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching datasource metadata:', error);
    return res.status(500).json({ message: 'Failed to fetch datasource metadata' });
  }
}
