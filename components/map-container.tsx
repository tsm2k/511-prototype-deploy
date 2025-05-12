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

  // Reference to track the actual marker count from MapView
  const [actualMarkerCount, setActualMarkerCount] = useState<number>(0);
  
  // Update filtered results when query results change
  useEffect(() => {
    // By default, show all markers (unfiltered results)
    setFilteredResults(queryResults);
    
    // Reset user interaction flag when query results change
    setUserHasInteracted(false);
    
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
  }, [queryResults]);

  // Track whether the user has interacted with the timeline slider
  const [userHasInteracted, setUserHasInteracted] = useState<boolean>(false);
  
  // Handle time change from timeline slider
  const handleTimeChange = (date: string) => {
    console.log(`Timeline date changed to: ${date}`);
    
    // Special case: 'all' means show all markers
    if (date === 'all') {
      console.log('Showing all markers');
      setUserHasInteracted(false); // Reset user interaction flag
      setFilteredResults(queryResults);
      return;
    }
    
    setCurrentDate(date);
    
    // If no date is selected or no query results, don't filter
    if (!date || !queryResults || !queryResults.results) {
      setFilteredResults(queryResults);
      return;
    }
    
    // Set user interaction flag to true to enable the "Show All" button
    setUserHasInteracted(true);
    
    // Always filter by date when the timeline changes
    // This ensures we only show markers for the selected date
    
    // Create a new filtered results object
    // Make sure to create a deep copy to avoid reference issues
    // IMPORTANT: Preserve the exact same structure as the original query results
    const filtered: any = { 
      results: Array.isArray(queryResults.results) ? [] : {},
      // Preserve any other properties from the original results
      ...(queryResults.parameters && { parameters: { ...queryResults.parameters } }),
      ...(queryResults.metadata && { metadata: { ...queryResults.metadata } })
    };
    
    console.log('Created new filtered results object:', filtered);
    
    // Helper function to filter items by date
    const filterItemsByDate = (items: any[], filterDate: string) => {
      return items.filter((item: any) => {
        // Check if the item has any date field that matches or falls within the selected date
        // First, try the primary date fields
        const primaryDateFields = ['date_start', 'start_date', 'date', 'timestamp', 'event_date', 'data_retrieval_timestamp'];
        
        // Then check update and end date fields
        const secondaryDateFields = [
          'date_update', 'date_end', 'last_update_date', 'last_update', 
          'updatetime', 'update_time', 'modified_date', 'created_date'
        ];
        
        // Try all primary date fields first
        for (const field of primaryDateFields) {
          if (item[field] && typeof item[field] === 'string') {
            try {
              // Extract YYYY-MM-DD part from the ISO date string
              const itemDate = item[field].split('T')[0];
              if (itemDate === filterDate) {
                return true;
              }
            } catch (e) {
              // If we can't parse the date, try a simple includes check
              if (item[field].includes(filterDate)) {
                return true;
              }
            }
          }
        }
        
        // If no match in primary fields, check secondary fields
        for (const field of secondaryDateFields) {
          if (item[field] && typeof item[field] === 'string') {
            try {
              const itemDate = item[field].split('T')[0];
              if (itemDate === filterDate) {
                return true;
              }
            } catch (e) {
              // If we can't parse the date, try a simple includes check
              if (item[field].includes(filterDate)) {
                return true;
              }
            }
          }
        }
        
        // Check for date ranges (items that span multiple days)
        if (item.date_start && item.date_end && 
            typeof item.date_start === 'string' && 
            typeof item.date_end === 'string') {
          try {
            const startDate = item.date_start.split('T')[0];
            const endDate = item.date_end.split('T')[0];
            
            // If the selected date falls between start and end dates, include it
            if (startDate <= filterDate && endDate >= filterDate) {
              return true;
            }
          } catch (e) {
            console.error(`Error parsing date range for item:`, e);
          }
        }
        
        return false;
      });
    };
    
    // Log a sample of the query results structure
    console.log('Query results structure:', {
      isArray: Array.isArray(queryResults.results),
      length: Array.isArray(queryResults.results) ? queryResults.results.length : 'N/A',
      keys: typeof queryResults.results === 'object' ? Object.keys(queryResults.results) : 'N/A'
    });
    
    // Handle different result structures (array vs object)
    if (Array.isArray(queryResults.results)) {
      // Array format: Create a new array with the same structure
      const resultsArray: any[] = [];
      
      // Process each results object in the array
      queryResults.results.forEach((resultsObj: any, index: number) => {
        const filteredObj: any = {};
        
        // Process each dataset in this results object
        Object.entries(resultsObj).forEach(([datasetName, items]: [string, any]) => {
          if (Array.isArray(items)) {
            console.log(`Filtering ${datasetName} dataset with ${items.length} items for date ${date}`);
            
            // Filter items for the current date
            const filteredItems = filterItemsByDate(items, date);
            
            // Include all datasets, even if empty (to maintain structure)
            filteredObj[datasetName] = filteredItems;
            console.log(`Filtered ${items.length} items to ${filteredItems.length} for date ${date}`);
          } else {
            // Preserve non-array properties
            filteredObj[datasetName] = items;
          }
        });
        
        // Add the filtered object to the results array
        resultsArray.push(filteredObj);
      });
      
      // Set the filtered results array
      filtered.results = resultsArray;
    } else {
      // Object format: Process each dataset
      Object.entries(queryResults.results).forEach(([datasetName, items]: [string, any]) => {
        if (Array.isArray(items)) {
          console.log(`Filtering ${datasetName} dataset with ${items.length} items for date ${date}`);
          
          // Filter items for the current date
          const filteredItems = filterItemsByDate(items, date);
          
          // Include all datasets, even if empty (to maintain structure)
          filtered.results[datasetName] = filteredItems;
          console.log(`Filtered ${items.length} items to ${filteredItems.length} for date ${date}`);
        } else {
          // Preserve non-array properties
          filtered.results[datasetName] = items;
        }
      });
    }
    
    // Update the filtered results
    // Make sure to update the filtered results state with the new filtered data
    console.log('Setting filtered results:', filtered);
    setFilteredResults({...filtered});
  };

  return (
    <div className="relative h-full">
      <MapView 
        queryResults={filteredResults} 
        onMarkerCountChange={(count) => {
          console.log(`Map reported ${count} markers`);
          setActualMarkerCount(count);
        }}
      />
      
      {/* Always render the timeline slider */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <TimelineSliderNew 
          queryResults={queryResults} // Don't provide a default value to ensure proper empty state
          onTimeChange={handleTimeChange}
          resultCount={actualMarkerCount || resultCount}
          className="w-full"
        />
      </div>
    </div>
  )
}
