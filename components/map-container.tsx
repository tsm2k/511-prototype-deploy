"use client"

import { useState, useEffect } from "react"
import { MapView } from "@/components/map-view"
import { TimelineSliderNew } from "@/components/timeline-slider-new"
import { format } from "date-fns"

interface MapContainerProps {
  queryResults: any;
  className?: string;
}

export function MapContainer({ queryResults, className }: MapContainerProps) {
  // State to manage filtered results based on timeline selection
  const [filteredResults, setFilteredResults] = useState<any>(queryResults);
  const [showTimeline, setShowTimeline] = useState<boolean>(true);
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState<number>(0);

  console.log('MapContainer rendered with query results:', queryResults);

  // Update filtered results when query results change
  useEffect(() => {
    setFilteredResults(queryResults);
    
    // Always show timeline, but update the result count
    setShowTimeline(true);
    
    // Calculate total result count if we have results
    if (queryResults && queryResults.results) {
      let count = 0;
      Object.entries(queryResults.results).forEach(([datasetName, items]: [string, any]) => {
        if (Array.isArray(items)) {
          count += items.length;
          console.log(`Counting ${items.length} items from ${datasetName}, total now: ${count}`);
          
          // Log sample dates from the first few items to help debug timeline issues
          if (items.length > 0 && datasetName === 'traffic_events') {
            console.log('Sample traffic event dates:');
            for (let i = 0; i < Math.min(3, items.length); i++) {
              const item = items[i];
              if (item.date_start) {
                try {
                  const dateStr = item.date_start.split('T')[0];
                  console.log(`Event ${i} date_start: ${dateStr} (original: ${item.date_start})`);
                } catch (e) {
                  console.log(`Event ${i} date_start parsing error: ${item.date_start}`);
                }
              }
            }
          }
        }
      });
      setResultCount(count);
      
      // Log the total count for debugging
      console.log(`Total result count set to: ${count}`);
      
      // Create a default current date if none exists
      if (!currentDate) {
        // Try to use the start date from the query if available
        if (queryResults.parameters && queryResults.parameters.time_filter && queryResults.parameters.time_filter.startDate) {
          setCurrentDate(queryResults.parameters.time_filter.startDate);
        } else {
          setCurrentDate(format(new Date(), 'yyyy-MM-dd'));
        }
      }
    } else {
      // Even with no results, we still show the timeline but with zero count
      setResultCount(0);
      if (!currentDate) {
        setCurrentDate(format(new Date(), 'yyyy-MM-dd'));
      }
    }
  }, [queryResults, currentDate]);

  // Handle time change from timeline slider
  const handleTimeChange = (date: string) => {
    console.log(`Timeline date changed to: ${date}`);
    setCurrentDate(date);
    
    // If no date is selected or no query results, don't filter
    if (!date || !queryResults || !queryResults.results) {
      setFilteredResults(queryResults);
      return;
    }
    
    // Create a new filtered results object
    const filtered: any = { 
      results: {},
      // Preserve any other properties from the original results
      ...(queryResults.parameters && { parameters: queryResults.parameters }),
      ...(queryResults.metadata && { metadata: queryResults.metadata })
    };
    
    // Special handling for traffic_events which is the main dataset
    // Support both array and object forms for backward compatibility
    let trafficEvents: any[] = [];
    if (Array.isArray(queryResults.results)) {
      trafficEvents = queryResults.results[0]?.traffic_events || [];
    } else if (queryResults.results.traffic_events && Array.isArray(queryResults.results.traffic_events)) {
      trafficEvents = queryResults.results.traffic_events;
    }
    if (trafficEvents.length > 0) {
      console.log(`Filtering ${trafficEvents.length} traffic events for date ${date}`);
      
      // Log a sample event to see its structure
      if (trafficEvents.length > 0) {
        const sampleEvent = trafficEvents[0];
        console.log('Sample traffic event for filtering:', JSON.stringify({
          id: sampleEvent.id,
          date_start: sampleEvent.date_start,
          date_update: sampleEvent.date_update,
          date_end: sampleEvent.date_end
        }, null, 2));
      }
      
      // Filter traffic events by date
      const filteredTrafficEvents = trafficEvents.filter((event: any) => {
        // For traffic events, date_start is the most reliable field
        if (event.date_start && typeof event.date_start === 'string') {
          try {
            // Extract YYYY-MM-DD part from the ISO date string
            const eventDate = event.date_start.split('T')[0];
            const matches = eventDate === date;
            if (matches) {
              console.log(`Found matching event ${event.id} with date ${eventDate}`);
            }
            return matches;
          } catch (e) {
            // If we can't parse the date, try a simple includes check
            return event.date_start.includes(date);
          }
        }
        
        // If no date_start, check other date fields
        const dateFields = [
          'date_update', 'date_end', 'last_update_date', 'last_update', 
          'updatetime', 'update_time', 'timestamp'
        ];
        
        for (const field of dateFields) {
          if (event[field] && typeof event[field] === 'string') {
            try {
              const eventDate = event[field].split('T')[0];
              return eventDate === date;
            } catch (e) {
              // If we can't parse the date, try a simple includes check
              return event[field].includes(date);
            }
          }
        }
        
        return false;
      });
      
      // Add filtered traffic events to the result
      filtered.results.traffic_events = filteredTrafficEvents;
      console.log(`Filtered ${trafficEvents.length} traffic events to ${filteredTrafficEvents.length} for date ${date}`);
      
      // If no events match the selected date, show all events
      if (filteredTrafficEvents.length === 0 && trafficEvents.length > 0) {
        console.log(`No events match date ${date}, showing all events`);
        filtered.results.traffic_events = trafficEvents;
      }
    }
    
    // Process other datasets if any
    Object.entries(queryResults.results).forEach(([datasetName, items]: [string, any]) => {
      // Skip traffic_events as we've already handled it
      if (datasetName === 'traffic_events') {
        return;
      }
      
      if (Array.isArray(items)) {
        console.log(`Filtering ${datasetName} dataset with ${items.length} items for date ${date}`);
        
        // Filter items for the current date
        const filteredItems = items.filter((item: any) => {
          // Check all possible date fields
          const dateFields = [
            'date_start', 'start_date', 'date', 'timestamp', 'event_date', 
            'created_date', 'modified_date', 'start_time', 'end_time',
            'last_update_date', 'last_update', 'updatetime', 'update_time',
            'date_end', 'end_date', 'date_update'
          ];
          
          // Try to find a matching date field
          for (const field of dateFields) {
            if (item[field] && typeof item[field] === 'string') {
              try {
                // Extract YYYY-MM-DD part from the ISO date string
                const itemDate = item[field].split('T')[0];
                if (itemDate === date) {
                  return true;
                }
              } catch (e) {
                // If we can't parse the date, try a simple includes check
                if (item[field].includes(date)) {
                  return true;
                }
              }
            }
          }
          
          return false;
        });
        
        // Include all datasets, even if empty (to maintain structure)
        filtered.results[datasetName] = filteredItems;
        console.log(`Filtered ${items.length} items to ${filteredItems.length} for date ${date}`);
      }
    });
    
    // Update the filtered results
    setFilteredResults(filtered);
  };

  return (
    <div className="relative h-full">
      <MapView queryResults={filteredResults} />
      
      {/* Always render the timeline slider */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <TimelineSliderNew 
          queryResults={queryResults || {
            results: {
              traffic_events: []
            }
          }}
          onTimeChange={handleTimeChange}
          resultCount={resultCount}
          className="w-full"
        />
      </div>
    </div>
  )
}
