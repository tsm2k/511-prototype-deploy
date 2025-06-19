import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

// API base URL
const API_BASE_URL = 'https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics';

// Create HTTPS agent to handle self-signed certificates
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Log data to a file for debugging
 */
const logToFile = (data: any, filename: string) => {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logDir, `${filename}_${timestamp}.json`);
    
    // Write the data to a file
    fs.writeFileSync(
      logFile,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`Data logged to: ${logFile}`);
    return logFile;
  } catch (error) {
    console.error('Error logging data:', error);
    return null;
  }
};

/**
 * Proxy API handler for fetching social events with their dates
 * This resolves the issue with the column-filter-values endpoint which returns unique values
 * and doesn't maintain the relationship between event names and dates
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Social events endpoint called');
    
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

    console.log('Sending query to API:', JSON.stringify(queryParams));

    // Forward the request to the external API
    const response = await axios.post(`${API_BASE_URL}/query/`, queryParams, {
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js Proxy Request'
      }
    });
    
    // Log the raw response for debugging
    logToFile(response.data, 'social_events_raw_response');
    
    // The API response has a nested structure: results[0].social_events is the array of events
    const socialEventsArray = response.data.results?.[0]?.social_events || [];
    
    console.log(`Received ${socialEventsArray.length} social events from API`);
    console.log('First few events:', JSON.stringify(socialEventsArray.slice(0, 3)));
    
    // Log the raw response structure to help with debugging
    console.log('Raw API response structure:', JSON.stringify(response.data.results?.[0]?.social_events?.[0] || {}, null, 2));
    
    // Instead of converting to arrays, let's pass the original structure
    // This preserves the relationship between event names, dates, and cities
    const formattedResponse = {
      results: [{
        social_events: socialEventsArray
      }]
    };
    
    // Log which events fall within the May 20-27, 2025 range
    socialEventsArray.forEach((event: any) => {
      if (event.date_start) {
        try {
          const eventDate = new Date(event.date_start);
          const startDate = new Date(2025, 4, 20); // May 20, 2025 (months are 0-indexed)
          const endDate = new Date(2025, 4, 27);   // May 27, 2025
          endDate.setDate(endDate.getDate() + 1);  // Make end date inclusive
          
          if (eventDate >= startDate && eventDate < endDate) {
            console.log(`Event in May 20-27 range: ${event.event_name} (${event.date_start}) - ${event.city || 'No city'} `);
          }
        } catch (error) {
          console.error(`Error parsing date for event ${event.event_name}:`, error);
        }
      }
    });
    
    console.log(`Processed ${socialEventsArray.length} social events`);
    
    // Log the formatted response for debugging
    logToFile(formattedResponse, 'social_events_formatted_response');
    
    console.log(`Returning ${formattedResponse.results[0].social_events.length} social events`);
    
    // Return the formatted data
    return res.status(200).json(formattedResponse);
  } catch (error: any) {
    console.error('Error fetching social events:', error.message);
    
    // Log the error for debugging
    logToFile({ error: error.message, stack: error.stack }, 'social_events_error');
    
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
      message: 'Error fetching social events',
      error: error.message
    });
  }
}
