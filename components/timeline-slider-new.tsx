"use client"

import { useEffect, useState, useRef } from "react"
import { format, parse, isValid, addDays, differenceInDays, isAfter, isBefore, isEqual } from "date-fns"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CalendarIcon, Play, Pause, ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp, Layers } from "lucide-react"

export interface TimelineData {
  date: string; // ISO date string
  count: number; // Number of items on this date
}

export interface TimelineSliderProps {
  queryResults: any;
  onTimeChange: (date: string) => void;
  className?: string;
  resultCount?: number;
}

export function TimelineSliderNew({ queryResults, onTimeChange, className, resultCount = 0 }: TimelineSliderProps) {
  // State for timeline data
  const [timelineData, setTimelineData] = useState<TimelineData[]>([])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [userHasInteracted, setUserHasInteracted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState(false)
  const [totalDays, setTotalDays] = useState(0)
  const [eventsPerDay, setEventsPerDay] = useState<Record<string, number>>({})
  const [maxEventsPerDay, setMaxEventsPerDay] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const playInterval = useRef<NodeJS.Timeout | null>(null)
  const prevQueryResultsRef = useRef<any>(null);
  
  // State to track the actual count of events for the current date
  const [currentDateEventCount, setCurrentDateEventCount] = useState<number>(0);

  // Extract timeline data from query results
  useEffect(() => {
    console.log('Timeline processing query results:', queryResults);
    console.log('Current result count:', resultCount);

    // Default dates if no data is available
    const today = new Date();
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);

    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    let allDates: Record<string, number> = {};

    // If no query results, create empty timeline
    if (!queryResults || !queryResults.results || Object.keys(queryResults.results).length === 0) {
      setStartDate(null);
      setEndDate(null);
      setCurrentDate(null);
      setTotalDays(0);
      setTimelineData([]);
      setEventsPerDay({});
      setMaxEventsPerDay(0);
      return;
    }

    // Check if there's a user-selected date range in the query parameters
    const userStartDate = queryResults.query?.parameters?.temporal_join_conditions?.[0]?.expressions?.find(
      (expr: any) => expr.operator === '>='
    )?.value;
    
    const userEndDate = queryResults.query?.parameters?.temporal_join_conditions?.[0]?.expressions?.find(
      (expr: any) => expr.operator === '<='
    )?.value;
    
    console.log('User selected date range:', userStartDate, 'to', userEndDate);
    
    // If user has selected a date range, use that instead of the data's date range
    if (userStartDate && userEndDate) {
      try {
        minDate = parse(userStartDate, 'yyyy-MM-dd', new Date());
        maxDate = parse(userEndDate, 'yyyy-MM-dd', new Date());
        console.log('Using user-selected date range:', format(minDate, 'yyyy-MM-dd'), 'to', format(maxDate, 'yyyy-MM-dd'));
      } catch (error) {
        console.error('Error parsing user date range:', error);
      }
    }

    // Process all datasets to extract dates
    // Define possible date field names across all datasets
    const dateFields = [
      // Primary date fields (start dates)
      'date_start', 'start_date', 'date', 'timestamp', 'event_date', 'data_retrieval_timestamp',
      // Update date fields
      'date_update', 'last_update_date', 'last_update', 'updatetime', 'update_time', 'modified_date',
      // End date fields
      'date_end', 'end_date', 'precipitation_date_start',
      // Other possible date fields
      'created_date', 'start_time', 'end_time'
    ];

    // Process all datasets in the results
    if (queryResults.results) {
      // Handle both array and object response formats
      const datasets = Array.isArray(queryResults.results) 
        ? queryResults.results 
        : [queryResults.results];
      
      datasets.forEach((dataset: Record<string, any>) => {
        // Process each dataset type (traffic_events, rest_area_info, etc.)
        Object.entries(dataset).forEach(([datasetName, items]: [string, any]) => {
          if (Array.isArray(items) && items.length > 0) {
            // Determine which date field to use for this dataset type
            let primaryDateField = '';
            
            // Check the first item to determine which date fields exist
            const sampleItem = items[0];
            for (const field of dateFields) {
              if (sampleItem[field] && typeof sampleItem[field] === 'string') {
                primaryDateField = field;
                console.log(`Using ${primaryDateField} for dataset ${datasetName}`);
                break;
              }
            }
            
            if (primaryDateField) {
              // Extract dates from all items using the identified date field
              items.forEach(item => {
                if (item[primaryDateField] && typeof item[primaryDateField] === 'string') {
                  const dateValue = item[primaryDateField].includes('T') 
                    ? item[primaryDateField].split('T')[0] 
                    : item[primaryDateField];
                  
                  try {
                    const date = parse(dateValue, 'yyyy-MM-dd', new Date());
                    if (isValid(date)) {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      
                      // Count items per day
                      allDates[dateStr] = (allDates[dateStr] || 0) + 1;
                      
                      // Track min and max dates
                      if (!minDate || isBefore(date, minDate)) {
                        minDate = date;
                      }
                      
                      if (!maxDate || isAfter(date, maxDate)) {
                        maxDate = date;
                      }
                    }
                  } catch (error) {
                    console.error(`Error parsing date ${dateValue}:`, error);
                  }
                }
              });
            }
          }
        });
      });
    }
    
    // If we couldn't extract any dates, use default range
    if (!minDate || !maxDate) {
      console.log('No valid dates found, using default range');
      
      // Use yesterday, today, tomorrow as default range
      minDate = yesterday;
      maxDate = tomorrow;
      
      // If we have results but no dates, put all results on today
      if (resultCount > 0) {
        allDates[format(today, 'yyyy-MM-dd')] = resultCount;
      }
    }
    
    console.log('Final date range:', {
      minDate: minDate ? format(minDate, 'yyyy-MM-dd') : 'none',
      maxDate: maxDate ? format(maxDate, 'yyyy-MM-dd') : 'none',
      allDates: JSON.stringify(allDates)
    });
    
    setStartDate(minDate);
    setEndDate(maxDate);
    
    // If no current date is set, use the start date
    if (!currentDate) {
      setCurrentDate(minDate);
    }
    
    // Calculate total days in the range
    const days = differenceInDays(maxDate, minDate) + 1;
    setTotalDays(days);
    console.log(`Total days in range: ${days}`);
    
    // Create timeline data array
    const timeline: TimelineData[] = [];
    let currentDay = new Date(minDate);
    let maxItems = 0;
    
    for (let i = 0; i < days; i++) {
      const dateStr = format(currentDay, 'yyyy-MM-dd');
      const count = allDates[dateStr] || 0;
      
      // Track max items per day for scaling
      if (count > maxItems) {
        maxItems = count;
      }
      
      timeline.push({
        date: dateStr,
        count
      });
      
      currentDay = addDays(currentDay, 1);
    
    }
    
    console.log(`Created timeline with ${timeline.length} days, max items: ${maxItems}`);
    console.log('Timeline data:', JSON.stringify(timeline));
    
    setTimelineData(timeline);
    setEventsPerDay(allDates);
    setMaxEventsPerDay(maxItems);
  }, [queryResults, resultCount]);
  
  // Update current date event count whenever the current date or events per day changes
  useEffect(() => {
    if (currentDate) {
      const formattedDate = format(currentDate, 'yyyy-MM-dd');
      const eventsOnThisDay = eventsPerDay[formattedDate] || 0;
      setCurrentDateEventCount(eventsOnThisDay);
      console.log(`Updated event count for ${formattedDate}: ${eventsOnThisDay}`);
    } else {
      setCurrentDateEventCount(0);
    }
  }, [currentDate, eventsPerDay]);
  
  // Reset to show all when the query results change
  useEffect(() => {
    // When query results change, reset user interaction state
    if (queryResults && queryResults !== prevQueryResultsRef.current) {
      setUserHasInteracted(false);
      prevQueryResultsRef.current = queryResults;
    }
  }, [queryResults]);
  
  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    const sliderPos = value[0];
    setSliderValue(sliderPos);
    
    // Mark that the user has interacted with the timeline
    setUserHasInteracted(true);
    
    if (startDate && totalDays > 0 && timelineData.length > 0) {
      // Use the slider position to find the appropriate date from the timeline data
      // This ensures we only select dates that actually exist in our dataset
      const index = Math.min(
        Math.floor((sliderPos / 100) * timelineData.length),
        timelineData.length - 1 // Ensure we don't exceed the array bounds
      );
      
      // Get the date from the timeline data
      const dateStr = timelineData[index].date;
      const newDate = parse(dateStr, 'yyyy-MM-dd', new Date());
      
      if (isValid(newDate)) {
        setCurrentDate(newDate);
        
        // Update the event count for this specific date
        const eventsOnThisDay = eventsPerDay[dateStr] || 0;
        setCurrentDateEventCount(eventsOnThisDay);
        
        // Notify parent component of date change
        console.log(`Slider changed to date: ${dateStr}, events: ${eventsOnThisDay}`);
        onTimeChange(dateStr);
      }
    }
  };
  
  // Handle date selection from calendar
  const handleDateSelect = (date: Date | undefined) => {
    if (date && startDate && endDate) {
      // Ensure date is within range
      if (isBefore(date, startDate)) {
        date = startDate;
      } else if (isAfter(date, endDate)) {
        date = endDate;
      }
      
      setCurrentDate(date);
      
      // Mark that the user has interacted with the timeline
      setUserHasInteracted(true);
      
      // Calculate slider position based on date
      if (totalDays > 0) {
        const daysFromStart = differenceInDays(date, startDate);
        const newSliderValue = (daysFromStart / totalDays) * 100;
        setSliderValue(newSliderValue);
      }
      
      // Update the event count for this specific date
      const formattedDate = format(date, 'yyyy-MM-dd');
      const eventsOnThisDay = eventsPerDay[formattedDate] || 0;
      setCurrentDateEventCount(eventsOnThisDay);
      
      // Notify parent component of date change
      console.log(`Calendar date selected: ${formattedDate}, events: ${eventsOnThisDay}`);
      onTimeChange(formattedDate);
    }
  };
  
  // Handle play/pause
  const togglePlayback = () => {
    setIsPlaying(prev => !prev);
  };
  
  // Step forward one day
  const stepForward = () => {
    if (currentDate && endDate && !isEqual(currentDate, endDate)) {
      const nextDate = addDays(currentDate, 1);
      console.log(`Stepping forward to: ${format(nextDate, 'yyyy-MM-dd')}`);
      handleDateSelect(nextDate);
    }
  };
  
  // Step backward one day
  const stepBackward = () => {
    if (currentDate && startDate && !isEqual(currentDate, startDate)) {
      const prevDate = addDays(currentDate, -1);
      console.log(`Stepping backward to: ${format(prevDate, 'yyyy-MM-dd')}`);
      handleDateSelect(prevDate);
    }
  };
  
  // Handle playback
  useEffect(() => {
    if (isPlaying) {
      // Start playback
      playInterval.current = setInterval(() => {
        if (currentDate && endDate) {
          if (isEqual(currentDate, endDate) || isAfter(currentDate, endDate)) {
            // Reset to start date when we reach the end
            if (startDate) {
              handleDateSelect(startDate);
            }
          } else {
            // Advance to next day
            const nextDate = addDays(currentDate, 1);
            handleDateSelect(nextDate);
          }
        }
      }, 1300); // 1 second between steps
    } else {
      // Stop playback
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    }
    
    // Clean up on unmount
    return () => {
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    };
  }, [isPlaying, currentDate, startDate, endDate]);
  
  // Render the timeline slider
  if (isCollapsed) {
    return (
      <div className={cn("bg-white/90 border rounded-lg shadow-lg p-2", className)}>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center space-x-1" 
          onClick={() => setIsCollapsed(false)}
        >
          <Clock className="h-4 w-4" />
          <span className="text-xs">Show Timeline</span>
          <ChevronUp className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }
  
  return (
    <div className={cn("bg-white/90 border rounded-lg shadow-lg p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium">Time Explorer</h3>
          <span className="text-xs text-gray-500 font-semibold">
            {/* {!startDate ? '-' : `${resultCount} ${resultCount === 1 ? 'item' : 'items'}`} */}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {startDate && endDate && (
            <span className="text-xs text-gray-500">
              Range: {`${totalDays} days`} ({format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')})
            </span>
          )}
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start text-left font-normal"
                disabled={!startDate || !endDate}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {currentDate ? format(currentDate, 'MMM d, yyyy') : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={currentDate || undefined}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  if (!date) return false;
                  if (startDate && isBefore(date, startDate)) return true;
                  if (endDate && isAfter(date, endDate)) return true;
                  return false;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0" 
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        {/* Main container with controls on left, histogram/slider on right */}
        <div className="flex gap-2">
          {/* Left side controls */}
          <div className="flex flex-col gap-2 w-[120px]">
            {/* Show All button - takes full width */}
            <Button
              variant={userHasInteracted ? "outline" : "secondary"}
              size="sm"
              className={`h-12 text-xs transition-all shadow-sm w-full ${!userHasInteracted ? 'ring-2 ring-blue-500 bg-blue-100 font-medium' : ''}`}
              onClick={() => {
                console.log('Show All Dates clicked, setting userHasInteracted to false');
                onTimeChange('all');
                setUserHasInteracted(false);
              }}
            >
              Show All Dates
            </Button>
            
            {/* Playback controls - takes full width */}
            <div className="flex bg-white rounded-md shadow-sm overflow-hidden border h-12">
              <Button
                variant="ghost"
                size="icon"
                className="flex-1 rounded-none border-r"
                onClick={togglePlayback}
                disabled={!startDate || !endDate}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="flex-1 rounded-none border-r"
                onClick={stepBackward}
                disabled={!startDate || !currentDate || !startDate || isEqual(currentDate, startDate)}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="flex-1 rounded-none"
                onClick={stepForward}
                disabled={!startDate || !currentDate || !endDate || isEqual(currentDate, endDate)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {/* Right side with histogram and slider */}
          <div className="flex-1">
            {/* Timeline visualization container */}
            <div className="relative">
              {/* Histogram bars */}
              <div className="relative h-8 bg-gray-100 rounded-t-md overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 h-6 flex items-end px-0">
                  {timelineData.map((day, index) => {
                    // Calculate height based on event count
                    const height = maxEventsPerDay > 0 
                      ? (day.count / maxEventsPerDay) * 100 
                      : 0;
                    
                    // Ensure the bar is visible even with low counts
                    const minHeight = height > 0 ? Math.max(height, 10) : 0;
                    
                    // Calculate width based on number of days
                    const barWidth = 100 / timelineData.length;
                    
                    // Check if this is the current date
                    const isCurrentDate = currentDate && format(currentDate, 'yyyy-MM-dd') === day.date;
                    
                    return (
                      <div 
                        key={day.date}
                        className="relative flex flex-col items-center justify-end h-full"
                        style={{ width: `${barWidth}%` }}
                      >
                        {/* Add a red line indicator for the current date */}
                        {isCurrentDate && (
                          <div 
                            className="absolute top-0 bottom-0 bg-red-500 z-10"
                            style={{
                              left: '50%',
                              width: '3px',
                              marginLeft: '-1px' // Center the line
                            }}
                          />
                        )}
                        
                        <div
                          className={`rounded-t-sm ${isCurrentDate ? 'bg-blue-600' : 'bg-blue-400'}`}
                          style={{
                            height: `${minHeight}%`,
                            width: '80%',
                            transition: 'height 0.2s ease-in-out'
                          }}
                          title={`${format(parse(day.date, 'yyyy-MM-dd', new Date()), 'MMM d')}: ${day.count} items`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Date labels below histogram */}
              <div className="relative h-8">
                {/* Date label that moves with slider thumb - positioned directly below histogram */}
                {currentDate && timelineData.length > 0 && (
                  <div 
                    className="absolute top-0 transform -translate-x-1/2"
                    style={{
                      // Find the exact position based on the day index in the timeline data
                      left: (() => {
                        const currentDateStr = format(currentDate, 'yyyy-MM-dd');
                        const dayIndex = timelineData.findIndex(day => day.date === currentDateStr);
                        if (dayIndex >= 0) {
                          // Position exactly at the center of the bar
                          // Add half of the bar width percentage to get to the center of the first bar
                          // and then add the appropriate percentage for each subsequent bar
                          const barWidth = 100 / timelineData.length;
                          const barCenter = barWidth / 2;
                          return `calc(${barCenter}% + ${dayIndex * barWidth}%)`;
                        }
                        // Fallback
                        return '50%';
                      })(),
                      transition: 'left 0.1s ease-out',
                      zIndex: 20
                    }}
                  >
                    <div className="bg-blue-600 text-white text-[13px] px-2 py-0.5 rounded-md whitespace-nowrap flex flex-col items-center">
                      <div>{format(currentDate, 'MMM d, yyyy')}</div>
                      <div className="text-[11px] text-blue-100">
                        {eventsPerDay[format(currentDate, 'yyyy-MM-dd')] || 0} {(eventsPerDay[format(currentDate, 'yyyy-MM-dd')] || 0) === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Slider with date indicator */}
              <div className="relative bg-gray-50 rounded-b-md px-0 py-1 h-10 flex items-center">
                <Slider
                  value={[sliderValue]}
                  onValueChange={handleSliderChange}
                  className="timeline-slider-custom"
                  disabled={totalDays === 0 || !startDate}
                />
                
                {/* Date ticks below slider */}
                {timelineData.length > 0 && (() => {
                  // Determine how many labels to show based on timeline length
                  const maxLabels = timelineData.length <= 14 ? timelineData.length : 7;
                  const labelIndices = [];
                  
                  if (timelineData.length <= maxLabels) {
                    // Show all dates if there are few enough
                    for (let i = 0; i < timelineData.length; i++) {
                      labelIndices.push(i);
                    }
                  } else {
                    // Show evenly spaced dates
                    // Always include first and last date
                    labelIndices.push(0);
                    
                    // Calculate step size to distribute remaining labels evenly
                    const step = (timelineData.length - 1) / (maxLabels - 1);
                    
                    // Add evenly spaced indices
                    for (let i = 1; i < maxLabels - 1; i++) {
                      labelIndices.push(Math.round(i * step));
                    }
                    
                    // Add the last date
                    if (timelineData.length > 1) {
                      labelIndices.push(timelineData.length - 1);
                    }
                  }
                  
                  // Render the labels at calculated indices
                  return labelIndices.map(index => {
                    const day = timelineData[index];
                    
                    // Calculate position to match histogram bars
                    const barWidth = 100 / timelineData.length;
                    const barCenter = barWidth / 2;
                    const position = barCenter + (index * barWidth);
                    
                    return (
                      <div 
                        key={`tick-${day.date}`}
                        className="absolute top-6 transform -translate-x-1/2"
                        style={{ left: `${position}%` }}
                      >
                        <div className="text-[11px] text-gray-500">
                          {format(parse(day.date, 'yyyy-MM-dd', new Date()), 'M/d')}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
        
        {/* Custom CSS for the slider thumb */}
        <style jsx global>{`
          .timeline-slider-custom {
            height: 28px;
          }
          .timeline-slider-custom [role="slider"] {
            height: 28px !important;
            width: 28px !important;
            background-color: #2563eb !important;
            border: 3px solid white !important;
            box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
            top: 50% !important;
          }
          .timeline-slider-custom [data-orientation="horizontal"] {
            height: 8px !important;
          }
        `}</style>
      </div>
    </div>
  );
}
