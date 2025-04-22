"use client"

import { useEffect, useState, useRef } from "react"
import { format, parse, isValid, addDays, differenceInDays, isAfter, isBefore, isEqual } from "date-fns"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CalendarIcon, Play, Pause, ChevronLeft, ChevronRight, Clock } from "lucide-react"

export interface TimelineData {
  date: string; // ISO date string
  count: number; // Number of events on this date
}

export interface TimelineSliderProps {
  queryResults: any;
  onTimeChange: (date: string) => void;
  className?: string;
  resultCount?: number;
}

export function TimelineSlider({ queryResults, onTimeChange, className, resultCount = 0 }: TimelineSliderProps) {
  // State for timeline data
  const [timelineData, setTimelineData] = useState<TimelineData[]>([])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1000) // ms between steps
  const playInterval = useRef<NodeJS.Timeout | null>(null)
  const [totalDays, setTotalDays] = useState(0)
  const [eventsPerDay, setEventsPerDay] = useState<Record<string, number>>({})
  const [maxEventsPerDay, setMaxEventsPerDay] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Extract timeline data from query results
  useEffect(() => {
    // Handle the case when we have a result count but no date fields in the data
    if (resultCount > 0 && (!queryResults || !queryResults.results || Object.keys(queryResults.results).length === 0)) {
      console.log(`Creating timeline data for ${resultCount} results without date fields`);
      
      // Create a reasonable date range (last month)
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - 30); // Last 30 days
      const endDate = today;
      
      setStartDate(startDate);
      setEndDate(endDate);
      setCurrentDate(today);
      
      // Calculate total days in the range
      const days = differenceInDays(endDate, startDate) + 1;
      setTotalDays(days);
      
      // Create timeline data with results distributed evenly
      const timeline: TimelineData[] = [];
      const allDates: Record<string, number> = {};
      let currentDay = new Date(startDate);
      
      // Distribute results evenly across the date range
      const resultsPerDay = Math.ceil(resultCount / days);
      
      for (let i = 0; i < days; i++) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const count = i === 0 ? resultCount : 0; // Put all results on the first day for visibility
        
        timeline.push({
          date: dateStr,
          count
        });
        
        allDates[dateStr] = count;
        currentDay = addDays(currentDay, 1);
      }
      
      setTimelineData(timeline);
      setEventsPerDay(allDates);
      setMaxEventsPerDay(resultCount);
      return;
    }
    
    // Handle case with no results
    if (!queryResults || !queryResults.results) {
      // Create default timeline data when there are no results
      const today = new Date();
      const yesterday = addDays(today, -1);
      const tomorrow = addDays(today, 1);
      
      setStartDate(yesterday);
      setEndDate(tomorrow);
      setCurrentDate(today);
      setTotalDays(3);
      
      const defaultTimeline: TimelineData[] = [
        { date: format(yesterday, 'yyyy-MM-dd'), count: 0 },
        { date: format(today, 'yyyy-MM-dd'), count: 0 },
        { date: format(tomorrow, 'yyyy-MM-dd'), count: 0 }
      ];
      
      setTimelineData(defaultTimeline);
      setEventsPerDay({});
      setMaxEventsPerDay(0);
      
      // Notify parent of initial date
      const formattedDate = format(today, 'yyyy-MM-dd');
      console.log(`Setting initial date with no results: ${formattedDate}`);
      onTimeChange(formattedDate);
      
      return;
    }
    
    console.log('Timeline processing query results:', queryResults);
    
    // Collect all dates from all datasets
    const allDates: Record<string, number> = {};
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    
    // Process each dataset in the results
    Object.entries(queryResults.results).forEach(([datasetName, items]: [string, any]) => {
      console.log(`Processing dataset ${datasetName} with ${Array.isArray(items) ? items.length : 0} items`);
      
      if (Array.isArray(items)) {
        // For traffic events, use the actual date range from the filter if available
        if (items.length > 0 && !items[0].date && !items[0].timestamp && !items[0].event_date) {
          // Try to extract date range from the query if available
          let startDateValue = null;
          let endDateValue = null;
          
          if (queryResults.parameters && queryResults.parameters.time_filter) {
            startDateValue = queryResults.parameters.time_filter.startDate;
            endDateValue = queryResults.parameters.time_filter.endDate;
          }
          
          // If we have actual dates from the query, use those
          const startDate = startDateValue ? new Date(startDateValue) : new Date();
          const endDate = endDateValue ? new Date(endDateValue) : new Date();
          
          // If no dates in query, use last week as fallback
          if (!startDateValue) {
            startDate.setDate(startDate.getDate() - 7); // One week ago
          }
          
          // Create a date range
          for (let i = 0; i < 8; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateStr = format(date, 'yyyy-MM-dd');
            
            // Count events per day (distribute events evenly)
            const eventsPerDay = Math.ceil(items.length / 8);
            allDates[dateStr] = (allDates[dateStr] || 0) + eventsPerDay;
            
            // Track min and max dates
            if (!minDate || isBefore(date, minDate)) {
              minDate = date;
            }
            
            if (!maxDate || isAfter(date, maxDate)) {
              maxDate = date;
            }
          }
          
          // Skip individual item processing for this dataset
          return;
        }
        
        items.forEach(item => {
          // Check all possible date fields in the 511 Data Analytics API response
          const allDateFields = [
            'date_start', 'start_date', 'date', 'timestamp', 'event_date', 
            'created_date', 'modified_date', 'start_time', 'end_time',
            'last_update_date', 'last_update', 'updatetime', 'update_time',
            'date_end', 'end_date', 'date_update'
          ];
          
          // Find the first available date field
          let dateField = null;
          for (const field of allDateFields) {
            if (item[field] && typeof item[field] === 'string') {
              dateField = item[field];
              // Try to extract just the date part if it's in ISO format
              if (dateField.includes('T')) {
                try {
                  dateField = dateField.split('T')[0]; // Extract YYYY-MM-DD part
                } catch (e) {
                  // Keep original if extraction fails
                }
              }
              console.log(`Found date field ${field} with normalized value ${dateField}`);
              break;
            }
          }
          
          // If we didn't find a standard date field, look for any field with 'date' or 'time' in the name
          let dateValue = dateField;
          if (!dateValue) {
            const possibleDateFields = Object.keys(item).filter(key => 
              key.toLowerCase().includes('date') || key.toLowerCase().includes('time')
            );
            
            if (possibleDateFields.length > 0) {
              dateValue = item[possibleDateFields[0]];
              console.log(`Using field ${possibleDateFields[0]} with value ${dateValue} as date`);
            }
          }
          
          if (dateValue) {
            // Try to parse the date with different formats
            let date: Date | null = null;
            
            // First try to parse as ISO date (most common in the API)
            try {
              // Handle ISO format with timezone
              if (dateValue && dateValue.includes('T') && dateValue.includes('Z')) {
                date = new Date(dateValue);
                if (isValid(date)) {
                  console.log(`Parsed ${dateValue} as ISO date: ${date}`);
                }
              }
            } catch (e) {
              // Continue if ISO parsing fails
            }
            
            // If ISO parsing failed, try other formats
            if (!date || !isValid(date)) {
              const formats = [
                'yyyy-MM-dd', // Standard ISO format
                'yyyy-MM-dd HH:mm:ss', // ISO with time
                'MM/dd/yyyy', // US format
                'MM/dd/yyyy HH:mm:ss', // US format with time
                'dd/MM/yyyy', // European format
                'yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx' // Full ISO format with timezone
              ];
              
              // Try each format until we find one that works
              for (const format of formats) {
                try {
                  const parsedDate = parse(dateValue, format, new Date());
                  if (isValid(parsedDate)) {
                    date = parsedDate;
                    console.log(`Parsed ${dateValue} with format ${format}`);
                    break;
                  }
                } catch (e) {
                  // Continue to next format if parsing fails
                }
              }
            }
            
            // If all parsing failed, try as timestamp
            if (!date && !isNaN(Number(dateValue))) {
              date = new Date(Number(dateValue));
              if (isValid(date)) {
                console.log(`Parsed ${dateValue} as timestamp: ${date}`);
              }
            }
            
            if (date && isValid(date)) {
              const dateStr = format(date, 'yyyy-MM-dd');
              
              // Count events per day
              allDates[dateStr] = (allDates[dateStr] || 0) + 1;
              
              // Track min and max dates
              if (!minDate || isBefore(date, minDate)) {
                minDate = date;
              }
              
              if (!maxDate || isAfter(date, maxDate)) {
                maxDate = date;
              }
            }
          }
        });
      }
    });
    
    // If we found dates, create the timeline data
    if (minDate && maxDate) {
      setStartDate(minDate);
      setEndDate(maxDate);
      setCurrentDate(minDate);
      
      // Calculate total days in the range
      const days = differenceInDays(maxDate, minDate) + 1;
      setTotalDays(days);
      
      // Create timeline data array
      const timeline: TimelineData[] = [];
      let currentDay = minDate;
      let maxEvents = 0;
      
      for (let i = 0; i < days; i++) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');
        const count = allDates[dateStr] || 0;
        
        // Track max events per day for scaling
        if (count > maxEvents) {
          maxEvents = count;
        }
        
        timeline.push({
          date: dateStr,
          count
        });
        
        currentDay = addDays(currentDay, 1);
      }
      
      setTimelineData(timeline);
      setEventsPerDay(allDates);
      setMaxEventsPerDay(maxEvents);
      
      // Notify parent of initial date
      if (minDate) {
        const formattedDate = format(minDate, 'yyyy-MM-dd');
        console.log(`Setting initial date from results: ${formattedDate}`);
        onTimeChange(formattedDate);
      }
    }
  }, [queryResults, onTimeChange]);
  
  // Handle slider change
  const handleSliderChange = (value: number[]) => {
    const sliderPos = value[0];
    setSliderValue(sliderPos);
    
    if (startDate && totalDays > 0) {
      // Calculate the date based on slider position
      const daysToAdd = Math.floor((sliderPos / 100) * totalDays);
      const newDate = addDays(startDate, daysToAdd);
      setCurrentDate(newDate);
      
      // Notify parent component of date change
      const formattedDate = format(newDate, 'yyyy-MM-dd');
      console.log(`Slider changed to date: ${formattedDate}`);
      onTimeChange(formattedDate);
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
      
      // Calculate slider position based on date
      if (totalDays > 0) {
        const daysFromStart = differenceInDays(date, startDate);
        const newSliderValue = (daysFromStart / totalDays) * 100;
        setSliderValue(newSliderValue);
      }
      
      // Notify parent component of date change
      const formattedDate = format(date, 'yyyy-MM-dd');
      console.log(`Calendar date selected: ${formattedDate}`);
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
            // Move to next day
            stepForward();
          }
        }
      }, playbackSpeed);
    } else {
      // Stop playback
      if (playInterval.current) {
        clearInterval(playInterval.current);
        playInterval.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (playInterval.current) {
        clearInterval(playInterval.current);
      }
    };
  };
  
  return (
    <div className={cn("bg-white/90 border rounded-lg shadow-lg p-3 mx-auto mb-4 max-w-5xl", className)}>
      <Button 
        variant="ghost" 
        size="sm" 
        className="absolute top-2 right-2" 
        onClick={() => setIsCollapsed(true)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-medium">Time Explorer</h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {startDate && format(startDate, 'MMM d, yyyy')} - {endDate && format(endDate, 'MMM d, yyyy')}
            </span>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[240px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {currentDate ? format(currentDate, 'MMMM d, yyyy') : <span>Select date</span>}
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
          </div>
        </div>
        
        {/* Timeline visualization */}
        <div className="relative h-12 mb-2">
          <div className="absolute inset-0 flex items-end">
            {timelineData.map((day, index) => {
              const height = maxEventsPerDay > 0 
                ? (day.count / maxEventsPerDay) * 100 
                : 0;
              
              return (
                <div 
                  key={day.date} 
                  className="flex-1 mx-px bg-blue-200 hover:bg-blue-300 transition-all"
                  style={{ height: `${height}%` }}
                  title={`${day.date}: ${day.count} events`}
                />
              );
            })}
          </div>
          
          {/* Current position indicator */}
          {currentDate && (
            <div 
              className="absolute bottom-0 w-0.5 bg-red-500 h-full"
              style={{ 
                left: `${sliderValue}%`,
                transform: 'translateX(-50%)'
              }}
            />
          )}
        </div>
        
        {/* Slider control */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="icon"
              onClick={togglePlayback}
              className="h-6 w-6"
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={stepBackward}
              disabled={currentDate && startDate ? isEqual(currentDate, startDate) : false}
              className="h-6 w-6"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={stepForward}
              disabled={currentDate && endDate ? isEqual(currentDate, endDate) : false}
              className="h-6 w-6"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex-1">
            <Slider
              value={[sliderValue]}
              min={0}
              max={100}
              step={0.1}
              onValueChange={handleSliderChange}
              className="cursor-pointer"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium">
              {currentDate && format(currentDate, 'MMM d, yyyy')}
            </span>
            <span className="text-xs text-gray-500">
              {currentDate && (eventsPerDay[format(currentDate, 'yyyy-MM-dd')] || resultCount > 0)
                ? `${eventsPerDay[format(currentDate, 'yyyy-MM-dd')] || resultCount} results` 
                : 'No results'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
