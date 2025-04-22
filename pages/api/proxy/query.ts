import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';

// API base URL
const API_BASE_URL = 'http://127.0.0.1:5005/api/511DataAnalytics';
// const API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';

// Create HTTPS agent to handle self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Proxy API handler for executing queries against the 511 Data Analytics API
 * This resolves CORS issues by making requests from the server side
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Log the request body for debugging
    console.log('Query request body:', JSON.stringify(req.body, null, 2));
    
    // Forward the request to the external API
    const response = await axios.post(`${API_BASE_URL}/query/`, req.body, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js Proxy Request'
      }
    });
    
    // Log the response for debugging
    console.log('Query response status:', response.status);
    console.log('Query response data sample:', JSON.stringify(response.data).substring(0, 500) + '...');
    
    // Return the data
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error executing query:', error.message);
    
    // Return more detailed error information
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      return res.status(error.response.status).json({
        message: 'Error from external API',
        error: error.response.data
      });
    }
    
    return res.status(500).json({ 
      message: 'Error executing query',
      error: error.message
    });
  }
}
