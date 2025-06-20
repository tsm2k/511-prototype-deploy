"use client"

import { useState, useEffect } from "react"
import { Search, Check, X, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { fetchAttributeFilterValues, fetchSocialEvents } from "@/services/api"
import { format, parseISO, isWithinInterval } from "date-fns"
import { TimeframeSelection } from "./timeline-selector"

// Define the DateRange interface to match the one used in timeline-selector
interface DateRange {
  start: Date;
  end: Date;
}
import { InfoTooltip } from "../ui/info-tooltip"

interface DateAwareAttributeFilterProps {
  attributeName?: string;
  attributeColumnName: string;
  tableName: string;
  onFilterChange: (columnName: string, values: string[]) => void;
  selectedValues?: string[];
  timeframeSelections?: TimeframeSelection[];
  dateField?: string;
}

// Helper function to determine appropriate height based on number of values
function getScrollAreaHeight(valueCount: number): string {
  if (valueCount <= 2) return 'h-[80px]';
  if (valueCount <= 4) return 'h-[120px]';
  if (valueCount <= 6) return 'h-[140px]';
  if (valueCount <= 10) return 'h-[180px]';
  return 'h-[200px]';
}

// Helper function to check if a date is within the selected date range
function isDateInRange(dateStr: string, timeframeSelections: TimeframeSelection[]): boolean {
  if (!dateStr || !timeframeSelections || timeframeSelections.length === 0) {
    // console.log(`No date range check for: ${dateStr}`);
    return true;
  }
  
  try {
    // Parse the ISO date string from the API
    const eventDate = new Date(dateStr);

    // Find date range selection
    const dateRangeSelection = timeframeSelections.find(s => s.type === "dateRange");
    if (dateRangeSelection && dateRangeSelection.type === "dateRange" && 'range' in dateRangeSelection) {
      let start: Date;
      let end: Date;
      
      try {
        if (dateRangeSelection.range.start instanceof Date) {
          start = dateRangeSelection.range.start;
        } else if (typeof dateRangeSelection.range.start === 'string') {
          start = new Date(dateRangeSelection.range.start);
        } else {
          // Handle case where it might be a serialized date object
          start = new Date(dateRangeSelection.range.start as any);
        }
        
        if (dateRangeSelection.range.end instanceof Date) {
          end = dateRangeSelection.range.end;
        } else if (typeof dateRangeSelection.range.end === 'string') {
          end = new Date(dateRangeSelection.range.end);
        } else {
          // Handle case where it might be a serialized date object
          end = new Date(dateRangeSelection.range.end as any);
        }
        

      } catch (parseError) {
        console.error('Error parsing date range:', parseError);
        return true; // If we can't parse the date range, consider all events in range
      }
      
      // Create date objects for comparison (ignoring time)
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      // Add one day to the end date to make it inclusive
      endDateOnly.setDate(endDateOnly.getDate() + 1);
      
      // Compare dates (inclusive range)
      const isInRange = eventDateOnly >= startDateOnly && eventDateOnly < endDateOnly;

      return isInRange;
    } else {
      console.log('No valid date range selection found in timeframeSelections:', timeframeSelections);
    }
    
    return true; // If no date range selection found, consider it in range
  } catch (error) {
    console.error("Error parsing date:", error, "for date string:", dateStr);
    return true; // If there's an error, don't filter out the event
  }
}

interface EventData {
  event_name: string;
  date_start: string;
  city?: string;
  venue?: string;
}

export function DateAwareAttributeFilter({
  attributeName,
  attributeColumnName,
  tableName,
  onFilterChange,
  selectedValues = [],
  timeframeSelections = [],
  dateField = "date_start"
}: DateAwareAttributeFilterProps) {
  const [availableValues, setAvailableValues] = useState<string[]>([]);
  const [allEventData, setAllEventData] = useState<EventData[]>([]);
  const [selected, setSelected] = useState<string[]>(selectedValues);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available values for this attribute
  useEffect(() => {
    console.log('DateAwareAttributeFilter - Fetching values with timeframe:', 
              timeframeSelections ? JSON.stringify(timeframeSelections) : 'none');
    
    const fetchValues = async () => {
      setIsLoading(true);
      try {
        let values: Record<string, string[]>;
        
        // For social events, use the dedicated endpoint that maintains event name and date pairings
        if (tableName === "social_events") {
          values = await fetchSocialEvents();
        } else {
          // For other tables, use the regular attribute filter values endpoint
          const columnNames = [attributeColumnName];
          values = await fetchAttributeFilterValues(tableName, columnNames);
        }
        
        if (values && values[attributeColumnName]) {
          // Store all values for filtering
          setAvailableValues(values[attributeColumnName]);
          // console.log(`Fetched ${values[attributeColumnName].length} values for ${attributeColumnName}`);
          
          // If we have social events data, process it
          if (tableName === "social_events") {
            // Check if we have the new response format with social_events array
            if ('social_events' in values && Array.isArray(values.social_events)) {
              // console.log(`Processing ${values.social_events.length} social events from new format`);
              
              // Group events by name to handle duplicates with different times
              const eventGroups: Record<string, any[]> = {};
              values.social_events.forEach((event: any) => {
                if (!eventGroups[event.event_name]) {
                  eventGroups[event.event_name] = [];
                }
                eventGroups[event.event_name].push(event);
              });
              
              // Log events with multiple times
              Object.entries(eventGroups).forEach(([name, events]) => {
                if (events.length > 1) {
                  console.log(`Event "${name}" has ${events.length} different times:`, 
                    events.map(e => e.date_start));
                }
              });
              
              // Extract unique event names for the filter
              const uniqueEventNames = Object.keys(eventGroups);
              // console.log(`Found ${uniqueEventNames.length} unique event names out of ${values.social_events.length} total events`);
              setAvailableValues(uniqueEventNames);
              
              // Create event data objects from the social_events array
              // Keep all instances of each event to preserve different times
              const newEventData: EventData[] = values.social_events.map((event: any) => ({
                event_name: event.event_name,
                date_start: event.date_start,
                city: event.city,
                venue: event.event_location_name
              }));
              
              // console.log('Sample event data with city:', JSON.stringify(newEventData[0], null, 2));
              setAllEventData(newEventData);
            } 
            // Fallback to old format if needed
            else if (values[dateField]) {
              // console.log(`Creating event data with ${values[dateField].length} dates (old format)`);
              const oldEventData: EventData[] = [];
              for (let i = 0; i < values[attributeColumnName].length; i++) {
                if (i < values[dateField].length) {
                  const cityValue = values.city && i < values.city.length ? values.city[i] : undefined;
                  const venueValue = values.event_location_name && i < values.event_location_name.length ? values.event_location_name[i] : undefined;
                  oldEventData.push({
                    event_name: values[attributeColumnName][i],
                    date_start: values[dateField][i],
                    city: cityValue,
                    venue: venueValue
                  });
                }
              }
              setAllEventData(oldEventData);
            }
            
            // Debug the timeframe selections
            if (timeframeSelections && timeframeSelections.length > 0) {
              const dateRangeSelection = timeframeSelections.find(s => s.type === "dateRange");
              if (dateRangeSelection && dateRangeSelection.type === "dateRange") {
                // console.log('Using date range for filtering:', {
                //   start: new Date(dateRangeSelection.range.start).toISOString(),
                //   end: new Date(dateRangeSelection.range.end).toISOString()
                // });
                
                // Pre-filter events based on date range
                const inRangeEvents = allEventData.filter((event: EventData) => 
                  isDateInRange(event.date_start, timeframeSelections)
                );
                
                // console.log(`Found ${inRangeEvents.length} events within the selected date range`);
                if (inRangeEvents.length > 0) {
                  // console.log('First 5 in-range events:', inRangeEvents.slice(0, 5).map((e: EventData) => e.event_name));
                }
              } else {
                // console.log('No dateRange selection found in timeframeSelections');
              }
            } else {
              // console.log('No timeframe selections available for filtering');
            }
          }
          
          setError(null);
        } else {
          setError("No values found for this attribute");
          setAvailableValues([]);
        }
      } catch (err) {
        setError("Failed to fetch attribute values");
        console.error(err);
        setAvailableValues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchValues();
  }, [tableName, attributeColumnName, dateField, timeframeSelections]);

  // Sync with parent component's selectedValues
  useEffect(() => {
    setSelected(selectedValues);
  }, [selectedValues]);
  
  // Update parent component when selection changes, but only if it's initiated from this component
  const updateParent = (newSelection: string[]) => {
    setSelected(newSelection);
    onFilterChange(attributeColumnName, newSelection);
  };

  // State to store filtered values
  const [filteredValues, setFilteredValues] = useState<string[]>([]);
  
  // Update filtered values when search query, available values, or timeframe selections change
  useEffect(() => {
    // Debug timeframe selections with detailed information
    console.log('DateAwareAttributeFilter - Current timeframe selections:', 
                JSON.stringify(timeframeSelections, null, 2));
    
    // Log the actual timeframe selection objects for debugging
    if (timeframeSelections && timeframeSelections.length > 0) {
      timeframeSelections.forEach((selection, index) => {
        // console.log(`TimeframeSelection[${index}]:`, selection);
        if (selection.type === 'dateRange' && 'range' in selection) {
          // console.log(`  - Date range:`, {
          //   start: selection.range.start instanceof Date ? 
          //     selection.range.start.toISOString() : 
          //     `Not a Date: ${JSON.stringify(selection.range.start)}`,
          //   end: selection.range.end instanceof Date ? 
          //     selection.range.end.toISOString() : 
          //     `Not a Date: ${JSON.stringify(selection.range.end)}`
          // });
        }
      });
    } else {
      // console.log('No timeframe selections available');
    }
    
    if (availableValues.length === 0) {
      // console.log('No available values to filter');
      setFilteredValues([]);
      return;
    }
    
    // Debug all event data
    if (tableName === "social_events") {
      // console.log(`Filtering ${availableValues.length} events with ${allEventData.length} event data records`);
      // Log a few sample events for debugging
      if (allEventData.length > 0) {
        // console.log('Sample events:', allEventData.slice(0, 3));
      }
    }
    
    // Create a properly formatted timeframe selection with Date objects
    let processedTimeframeSelections: TimeframeSelection[] = [];
    
    // Process the provided timeframe selections
    if (timeframeSelections && timeframeSelections.length > 0) {
      // Find the date range selection
      const dateRangeSelection = timeframeSelections.find(s => s.type === "dateRange");
      
      if (dateRangeSelection && dateRangeSelection.type === "dateRange" && 'range' in dateRangeSelection) {
        try {
          // Convert the range values to proper Date objects
          let startDate: Date;
          let endDate: Date;
          
          // Handle start date
          if (dateRangeSelection.range.start instanceof Date) {
            startDate = dateRangeSelection.range.start;
          } else if (typeof dateRangeSelection.range.start === 'string') {
            startDate = new Date(dateRangeSelection.range.start);
          } else {
            startDate = new Date(dateRangeSelection.range.start as any);
          }
          
          // Handle end date
          if (dateRangeSelection.range.end instanceof Date) {
            endDate = dateRangeSelection.range.end;
          } else if (typeof dateRangeSelection.range.end === 'string') {
            endDate = new Date(dateRangeSelection.range.end);
          } else {
            endDate = new Date(dateRangeSelection.range.end as any);
          }
          
          // Create a new timeframe selection with proper Date objects
          processedTimeframeSelections = [
            {
              type: "dateRange",
              range: {
                start: startDate,
                end: endDate
              }
            } as { type: "dateRange"; range: DateRange }
          ];
          
          console.log('Using provided date range:', 
                    startDate.toISOString(),
                    'to', 
                    endDate.toISOString());
        } catch (error) {
          console.error('Error processing date range:', error);
          // Fall back to default range
        }
      }
    }
    
    // If no valid timeframe selections were processed, use the current date from the UI
    if (processedTimeframeSelections.length === 0) {
      // Get the current date and create a range for the current week
      const today = new Date();
      const startOfWeek = new Date(today);
      const endOfWeek = new Date(today);
      
      // Set to start of current day
      startOfWeek.setHours(0, 0, 0, 0);
      // Set to end of current day
      endOfWeek.setHours(23, 59, 59, 999);
      
      const defaultRange: DateRange = {
        start: startOfWeek,
        end: endOfWeek
      };
      
      processedTimeframeSelections = [
        {
          type: "dateRange",
          range: defaultRange
        } as { type: "dateRange"; range: DateRange }
      ];
      
      console.log('Using current date range:', 
                defaultRange.start.toISOString(),
                'to', 
                defaultRange.end.toISOString());
    }
    
    // Update the effectiveTimeframeSelections state
    setEffectiveTimeframeSelections(processedTimeframeSelections);
    
    // Now we only filter by search query, not by date range
    // We'll show all events but gray out those outside the date range
    const newFilteredValues = availableValues.filter(value => {
      // Only filter by search query if there is a search query
      if (!searchQuery) return true;
      
      // Make sure to handle numeric searches properly
      const valueStr = String(value).toLowerCase();
      const queryStr = searchQuery.toLowerCase();
      return valueStr.includes(queryStr);
    });
    
    // console.log(`Filtered from ${availableValues.length} to ${newFilteredValues.length} values based on search`);
    setFilteredValues(newFilteredValues);
    
  }, [availableValues, searchQuery, allEventData, tableName, timeframeSelections]); // Added timeframeSelections dependency

  // Handle select/deselect all (only for filtered values that match date range)
  const handleSelectAll = () => {
    updateParent(filteredValues);
  };

  const handleDeselectAll = () => {
    updateParent([]);
  };
  
  // Determine if all filtered values are selected
  const allSelected = filteredValues.length > 0 && 
    filteredValues.every(value => selected.includes(value));
    
  // Update selected values when filtered values change to remove any that are no longer available
  useEffect(() => {
    if (selected.length > 0) {
      // Find any selected values that are no longer in the filtered values
      const validSelectedValues = selected.filter(value => 
        filteredValues.includes(value) || !isEventOutsideRange(value)
      );
      
      // If some selected values are no longer valid, update the selection
      if (validSelectedValues.length !== selected.length) {
        updateParent(validSelectedValues);
      }
    }
  }, [filteredValues, selected, updateParent]);
  
  // Handle individual checkbox change
  const handleCheckboxChange = (value: string, eventDate?: string) => {
    // For debugging - log the event date when available
    if (eventDate && tableName === "social_events") {
      // console.log(`Toggling event: ${value} with date: ${eventDate}`);
    }
    
    if (selected.includes(value)) {
      updateParent(selected.filter(v => v !== value));
    } else {
      updateParent([...selected, value]);
    }
  };
  // Check if this is a small attribute set (few options)
  const isSmallAttributeSet = !isLoading && !error && filteredValues.length <= 5;
  
  // Check if this is a very small set (2-3 options) where we don't need a Select All button
  // Note: We now handle the search bar visibility separately
  const isVerySmallSet = !isLoading && !error && filteredValues.length <= 3;
  
  // Always show search if there's an active search query or more than 5 options
  const shouldShowSearch = searchQuery || (!isLoading && !error && availableValues.length > 5);
  
  // Check if this is a boolean attribute (only has true/false values)
  const isBooleanAttribute = !isLoading && !error && 
    filteredValues.length <= 2 && 
    filteredValues.every(value => value.toLowerCase() === 'true' || value.toLowerCase() === 'false');

  // Format date for display
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) {
      return 'No date available';
    }
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'No date available';
    }
  };

  // Store the effective timeframe selections in state so it can be used by isEventOutsideRange
  const [effectiveTimeframeSelections, setEffectiveTimeframeSelections] = useState<TimeframeSelection[]>([]);
  
  // Check if an event is outside the date range
  const isEventOutsideRange = (eventName: string): boolean => {
    if (tableName !== "social_events") return false;
    
    // If no effective timeframe selections, consider all events in range
    if (!effectiveTimeframeSelections || effectiveTimeframeSelections.length === 0) return false;
    
    const eventInfo = allEventData.find(event => event.event_name === eventName);
    
    // If event has no date_start, consider it outside the range (ineligible for selection)
    if (!eventInfo || !eventInfo.date_start) {
      // console.log(`Event ${eventName} has no date_start, marking as outside range`);
      return true;
    }
    
    // Use the effective timeframe selections
    const result = !isDateInRange(eventInfo.date_start, effectiveTimeframeSelections);
    return result;
  };

  // Get date for an event
  const getEventDate = (eventName: string): string => {
    const eventInfo = allEventData.find(event => event.event_name === eventName);
    if (eventInfo && eventInfo.date_start) {
      return formatDate(eventInfo.date_start);
    }
    return 'No date available';
  };
  
  // Get city information for an event
  const getEventLocation = (eventName: string): string => {
    const eventInfo = allEventData.find(event => event.event_name === eventName);
    if (eventInfo && eventInfo.city) {
      return eventInfo.city;
    }
    return '';
  };

  // Get venue information for an event
  const getEventVenue = (eventName: string): string => {
    const eventInfo = allEventData.find(event => event.event_name === eventName);
    if (eventInfo && eventInfo.venue) {
      return eventInfo.venue;
    }
    return '';
  };
  
  // Standard filter for non-boolean attributes
  return (
    <div className="space-y-2 w-full flex-grow">
      
      {/* Search and Select/Deselect All */}
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-grow">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find..."
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
      </div>

  {!isVerySmallSet && (
    <Button 
      variant="outline" 
      size="sm" 
      className="flex items-center gap-1 text-xs h-8 whitespace-nowrap"
      onClick={allSelected ? handleDeselectAll : handleSelectAll}
    >
      {allSelected ? (
        <>
          <X className="h-3 w-3" /> Deselect All
        </>
      ) : (
        <>
          <Check className="h-3 w-3" /> Select All
        </>
      )}
    </Button>
  )}
</div>

      
      {/* Checkbox list */}
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
          Loading...
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      ) : filteredValues.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
          No matching values found
        </div>
      ) : (
        <ScrollArea className={`${getScrollAreaHeight(filteredValues.length)} border rounded-md p-1 w-full`}>
          <div className="space-y-1">
            {/* Remove any duplicates from filteredValues */}
            {[...new Set(filteredValues)]
              .map((value, index) => ({
                value,
                index,
                isDisabled: isEventOutsideRange(value),
                eventInfo: allEventData.find(event => event.event_name === value)
              }))
              .sort((a, b) => {
                // Sort by availability first (available events first)
                if (a.isDisabled !== b.isDisabled) {
                  return a.isDisabled ? 1 : -1; // Available events come first
                }
                // Then sort by date (if both are available or both unavailable)
                if (a.eventInfo && b.eventInfo) {
                  const dateA = new Date(a.eventInfo.date_start);
                  const dateB = new Date(b.eventInfo.date_start);
                  return dateA.getTime() - dateB.getTime(); // Sort by date ascending
                }
                return 0;
              })
              .map(({ value, index, isDisabled, eventInfo }) => {
                // Find all instances of this event (could have multiple times)
                const allEventInstances = allEventData.filter(event => event.event_name === value);
                
                // Sort instances by date
                allEventInstances.sort((a, b) => {
                  const dateA = new Date(a.date_start);
                  const dateB = new Date(b.date_start);
                  return dateA.getTime() - dateB.getTime();
                });
                
                // Format dates for all instances
                const formattedDates = allEventInstances.map(instance => {
                  if (!instance.date_start) {
                    return 'No date available';
                  }
                  try {
                    const date = new Date(instance.date_start);
                    return format(date, 'MMM d, yyyy h:mm a');
                  } catch (error) {
                    console.error(`Error formatting date for ${instance.event_name}:`, error);
                    return 'No date available';
                  }
                });
                
                // For backward compatibility, keep the single date format too
                let formattedDate = 'No date available';
                if (eventInfo && eventInfo.date_start) {
                  try {
                    const eventDate = new Date(eventInfo.date_start);
                    formattedDate = format(eventDate, 'MMM d, yyyy h:mm a');
                  } catch (error) {
                    console.error(`Error formatting single date for ${value}:`, error);
                  }
                }
                
                return (
                  <div key={`event-${value.replace(/\s+/g, '-')}-${index}`} className="flex items-center py-1 border-b border-gray-100 last:border-0">
                    <Checkbox
                      id={`${attributeColumnName}-${value}-${index}`}
                      checked={selected.includes(value)}
                      onCheckedChange={() => handleCheckboxChange(value, eventInfo?.date_start)}
                      disabled={isDisabled}
                      className="mr-2"
                    />
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`${attributeColumnName}-${value}-${index}`}
                          className={`text-sm font-medium cursor-pointer ${isDisabled ? 'text-gray-400' : 'text-gray-800'}`}
                        >
                          {value}
                          {isDisabled && (
                            <InfoTooltip
                              content={`This event is not available during the selected date range`}
                              className="ml-1"
                            />
                          )}
                        </label>
                      </div>
                      <div className="flex flex-col">
                        {/* If there are multiple times for this event, show all of them */}
                        {allEventInstances.length > 1 ? (
                          <div className="flex flex-col">
                            {formattedDates.map((date, dateIndex) => (
                              <div key={dateIndex} className="flex items-center">
                                <span className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {date}
                                </span>
                                {dateIndex === 0 && (
                                  <span className="ml-1 text-xs px-1 bg-blue-100 text-blue-800 rounded">
                                    +{allEventInstances.length - 1} more
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formattedDate}
                          </span>
                        )}
                        {/* Show venue information */}
                        {eventInfo?.venue && (
                          <span className={`text-xs block mt-1 ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                            {eventInfo.venue}
                          </span>
                        )}
                        {/* Show city information */}
                        {eventInfo?.city && (
                          <span className={`text-xs block ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                            {eventInfo.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
  
}
