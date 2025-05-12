"use client"

import { useState, useEffect } from "react"
import { Search, Check, X, Info } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { fetchAttributeFilterValues } from "@/services/api"
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
    console.log(`No date range check for: ${dateStr}`);
    return true;
  }
  
  try {
    // Parse the ISO date string from the API
    const eventDate = new Date(dateStr);
    console.log(`Checking event date: ${dateStr} (${eventDate.toISOString()})`);
    
    // Find date range selection
    const dateRangeSelection = timeframeSelections.find(s => s.type === "dateRange");
    if (dateRangeSelection && dateRangeSelection.type === "dateRange" && 'range' in dateRangeSelection) {
      // Log the raw range values for debugging
      console.log('Raw date range from selection:', {
        start: dateRangeSelection.range.start,
        end: dateRangeSelection.range.end,
        startType: typeof dateRangeSelection.range.start,
        endType: typeof dateRangeSelection.range.end,
        startIsDate: dateRangeSelection.range.start instanceof Date,
        endIsDate: dateRangeSelection.range.end instanceof Date
      });
      
      // Get start and end dates from the selection
      // Handle both Date objects and string dates
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
        
        console.log('Parsed date range:', {
          start: start.toISOString(),
          end: end.toISOString()
        });
      } catch (parseError) {
        console.error('Error parsing date range:', parseError);
        return true; // If we can't parse the date range, consider all events in range
      }
      
      // Create date objects for comparison (ignoring time)
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      // Compare dates (inclusive range)
      const isInRange = eventDateOnly >= startDateOnly && eventDateOnly <= endDateOnly;
      
      // Debug output
      console.log(`Date comparison:\n` +
                 `Event date: ${eventDateOnly.toISOString().split('T')[0]}\n` +
                 `Range: ${startDateOnly.toISOString().split('T')[0]} to ${endDateOnly.toISOString().split('T')[0]}\n` +
                 `In Range: ${isInRange}`);
      
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
        // For social events, we need to fetch both event_name and date_start
        const columnNames = tableName === "social_events" 
          ? [attributeColumnName, dateField] 
          : [attributeColumnName];
        
        const values = await fetchAttributeFilterValues(tableName, columnNames);
        
        if (values && values[attributeColumnName]) {
          // Store all values for filtering
          setAvailableValues(values[attributeColumnName]);
          console.log(`Fetched ${values[attributeColumnName].length} values for ${attributeColumnName}`);
          
          // If we have date information, create event data objects
          if (tableName === "social_events" && values[dateField]) {
            console.log(`Creating event data with ${values[dateField].length} dates`);
            const eventData: EventData[] = [];
            for (let i = 0; i < values[attributeColumnName].length; i++) {
              if (i < values[dateField].length) {
                eventData.push({
                  event_name: values[attributeColumnName][i],
                  date_start: values[dateField][i]
                });
              }
            }
            setAllEventData(eventData);
            
            // Debug the timeframe selections
            if (timeframeSelections && timeframeSelections.length > 0) {
              const dateRangeSelection = timeframeSelections.find(s => s.type === "dateRange");
              if (dateRangeSelection && dateRangeSelection.type === "dateRange") {
                console.log('Using date range for filtering:', {
                  start: new Date(dateRangeSelection.range.start).toISOString(),
                  end: new Date(dateRangeSelection.range.end).toISOString()
                });
                
                // Pre-filter events based on date range
                const inRangeEvents = eventData.filter(event => 
                  isDateInRange(event.date_start, timeframeSelections)
                );
                
                console.log(`Found ${inRangeEvents.length} events within the selected date range`);
                if (inRangeEvents.length > 0) {
                  console.log('First 5 in-range events:', inRangeEvents.slice(0, 5).map(e => e.event_name));
                }
              } else {
                console.log('No dateRange selection found in timeframeSelections');
              }
            } else {
              console.log('No timeframe selections available for filtering');
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
        console.log(`TimeframeSelection[${index}]:`, selection);
        if (selection.type === 'dateRange' && 'range' in selection) {
          console.log(`  - Date range:`, {
            start: selection.range.start instanceof Date ? 
              selection.range.start.toISOString() : 
              `Not a Date: ${JSON.stringify(selection.range.start)}`,
            end: selection.range.end instanceof Date ? 
              selection.range.end.toISOString() : 
              `Not a Date: ${JSON.stringify(selection.range.end)}`
          });
        }
      });
    } else {
      console.log('No timeframe selections available');
    }
    
    if (availableValues.length === 0) {
      console.log('No available values to filter');
      setFilteredValues([]);
      return;
    }
    
    // Debug all event data
    if (tableName === "social_events") {
      console.log(`Filtering ${availableValues.length} events with ${allEventData.length} event data records`);
      // Log a few sample events for debugging
      if (allEventData.length > 0) {
        console.log('Sample events:', allEventData.slice(0, 3));
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
    
    // If no valid timeframe selections were processed, use a default range
    if (processedTimeframeSelections.length === 0) {
      const defaultRange: DateRange = {
        start: new Date(2025, 4, 5), // May 5, 2025 (months are 0-indexed)
        end: new Date(2025, 4, 12)   // May 12, 2025
      };
      
      processedTimeframeSelections = [
        {
          type: "dateRange",
          range: defaultRange
        } as { type: "dateRange"; range: DateRange }
      ];
      
      console.log('Using default date range:', 
                defaultRange.start.toISOString(),
                'to', 
                defaultRange.end.toISOString());
    }
    
    // Update the effectiveTimeframeSelections state
    setEffectiveTimeframeSelections(processedTimeframeSelections);
    
    // Now we only filter by search query, not by date range
    // We'll show all events but gray out those outside the date range
    const newFilteredValues = availableValues.filter(value => {
      // Only filter by search query
      return value.toLowerCase().includes(searchQuery.toLowerCase());
    });
    
    console.log(`Filtered from ${availableValues.length} to ${newFilteredValues.length} values based on search`);
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
  }, [filteredValues, selected]);

  // Handle individual checkbox change
  const handleCheckboxChange = (value: string) => {
    const newSelection = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    updateParent(newSelection);
  };

  // Check if this is a small attribute set (few options)
  const isSmallAttributeSet = !isLoading && !error && filteredValues.length <= 5;
  
  // Check if this is a very small set (2-3 options) where we don't need a Select All button
  const isVerySmallSet = !isLoading && !error && filteredValues.length <= 3;
  
  // Check if this is a boolean attribute (only has true/false values)
  const isBooleanAttribute = !isLoading && !error && 
    filteredValues.length <= 2 && 
    filteredValues.every(value => value.toLowerCase() === 'true' || value.toLowerCase() === 'false');

  // Format date for display
  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
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
    if (eventInfo) {
      // Use the effective timeframe selections
      const result = !isDateInRange(eventInfo.date_start, effectiveTimeframeSelections);
      return result;
    }
    return false;
  };

  // Get date for an event
  const getEventDate = (eventName: string): string => {
    const eventInfo = allEventData.find(event => event.event_name === eventName);
    if (eventInfo && eventInfo.date_start) {
      return formatDate(eventInfo.date_start);
    }
    return '';
  };

  // Render a compact filter if it's a boolean or small attribute set
  if (isBooleanAttribute || isSmallAttributeSet) {
    return (
      <div className="space-y-2 w-full">
        
        {!isVerySmallSet && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1 text-xs h-8"
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
          </div>
        )}

        {isLoading ? (
          <div className="p-2 text-center text-muted-foreground bg-gray-50 border rounded-md">
            Loading...
          </div>
        ) : error ? (
          <div className="p-2 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
            {filteredValues.map((value) => (
              <div key={value} className="flex items-center">
                <Checkbox
                  id={`${attributeColumnName}-${value}`}
                  checked={selected.includes(value)}
                  onCheckedChange={() => handleCheckboxChange(value)}
                  className="mr-2"
                  disabled={isEventOutsideRange(value)}
                />
                <label
                  htmlFor={`${attributeColumnName}-${value}`}
                  className={`text-sm truncate flex items-center gap-1 ${isEventOutsideRange(value) ? 'text-gray-400' : ''}`}
                >
                  {value}
                  {isEventOutsideRange(value) && (
                    <span className="flex items-center gap-1 ml-1">
                      <span className="text-xs text-gray-400">(Outside date range)</span>
                      <InfoTooltip content={`This event occurs on ${getEventDate(value)}, which is outside the selected date range.`} />
                    </span>
                  )}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Standard filter for non-boolean attributes
  return (
    <div className="space-y-2 w-full flex-grow">
      
      {/* Search and Select/Deselect All */}
      <div className="space-y-2 w-full">
        <div className="relative w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find..."
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {!isVerySmallSet && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1 text-xs h-8"
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
          </div>
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
        <ScrollArea className={getScrollAreaHeight(filteredValues.length)}>
          <div className="space-y-1 p-1">
            {/* Sort events so available ones appear first */}
            {filteredValues
              .map(value => ({
                value,
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
              .map(({ value, isDisabled, eventInfo }) => {
                const eventDate = eventInfo ? new Date(eventInfo.date_start) : null;
                const formattedDate = eventDate ? format(eventDate, 'MMM d, yyyy') : '';
              
              return (
                <div key={value} className="flex items-center py-1.5 border-b border-gray-100 last:border-0">
                  <Checkbox
                    id={`${attributeColumnName}-${value}`}
                    checked={selected.includes(value)}
                    onCheckedChange={() => handleCheckboxChange(value)}
                    disabled={isDisabled}
                    className="mr-2"
                  />
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`${attributeColumnName}-${value}`}
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
                    {formattedDate && (
                      <span className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formattedDate}
                      </span>
                    )}
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
