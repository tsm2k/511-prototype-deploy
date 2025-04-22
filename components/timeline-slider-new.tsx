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
import { CalendarIcon, Play, Pause, ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp } from "lucide-react"

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

export function TimelineSliderNew({ queryResults, onTimeChange, className, resultCount = 0 }: TimelineSliderProps) {
  // State for timeline data
  const [timelineData, setTimelineData] = useState<TimelineData[]>([])
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [totalDays, setTotalDays] = useState(0)
  const [eventsPerDay, setEventsPerDay] = useState<Record<string, number>>({})
  const [maxEventsPerDay, setMaxEventsPerDay] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const playInterval = useRef<NodeJS.Timeout | null>(null)
  
  // Extract timeline data from query results
  useEffect(() => {
    console.log('Timeline processing query results:', queryResults);

    // Default dates if no data is available
    const today = new Date();
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);

    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    let allDates: Record<string, number> = {};

    // If no query results, create default timeline
    if (!queryResults || !queryResults.results || Object.keys(queryResults.results).length === 0) {
      setStartDate(yesterday);
      setEndDate(tomorrow);
      setCurrentDate(today);
      setTotalDays(3);
      setTimelineData([
        { date: format(yesterday, 'yyyy-MM-dd'), count: 0 },
        { date: format(today, 'yyyy-MM-dd'), count: resultCount },
        { date: format(tomorrow, 'yyyy-MM-dd'), count: 0 }
      ]);
      setEventsPerDay({});
      setMaxEventsPerDay(0);
      return;
    }

    // Support both array and object forms for backward compatibility
    let trafficEvents: any[] = [];
    if (Array.isArray(queryResults.results)) {
      trafficEvents = queryResults.results[0]?.traffic_events || [];
    } else if (queryResults.results.traffic_events && Array.isArray(queryResults.results.traffic_events)) {
      trafficEvents = queryResults.results.traffic_events;
    }

    // Extract all event dates
    const eventDates = trafficEvents
      .map((event) => event.date_start && typeof event.date_start === 'string' ? event.date_start.split('T')[0] : null)
      .filter((date): date is string => !!date);
    eventDates.forEach(date => {
      allDates[date] = (allDates[date] || 0) + 1;
    });
    if (eventDates.length > 0) {
      minDate = parse(eventDates.reduce((min, d) => d < min ? d : min, eventDates[0]), 'yyyy-MM-dd', new Date());
      maxDate = parse(eventDates.reduce((max, d) => d > max ? d : max, eventDates[0]), 'yyyy-MM-dd', new Date());
    }

    // Fallback: scan all datasets for date fields if no traffic_events
    if (eventDates.length === 0) {
      Object.entries(queryResults.results).forEach(([datasetName, items]: [string, any]) => {
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(item => {
            const dateFields = [
              'date_start', 'start_date', 'date', 'timestamp', 'event_date', 
              'created_date', 'modified_date', 'start_time', 'end_time',
              'last_update_date', 'last_update', 'updatetime', 'update_time',
              'date_end', 'end_date', 'date_update'
            ];
            let dateValue: string | null = null;
            for (const field of dateFields) {
              if (item[field] && typeof item[field] === 'string') {
                dateValue = item[field].includes('T') ? item[field].split('T')[0] : item[field];
                break;
              }
            }
            if (dateValue) {
              const date = parse(dateValue, 'yyyy-MM-dd', new Date());
              if (isValid(date)) {
                const dateStr = format(date, 'yyyy-MM-dd');
                allDates[dateStr] = (allDates[dateStr] || 0) + 1;
                if (!minDate || isBefore(date, minDate)) minDate = date;
                if (!maxDate || isAfter(date, maxDate)) maxDate = date;
                
                if (isValid(date)) {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  console.log(`Valid date parsed: ${dateStr}`);
                  
                  // Count events per day
                  allDates[dateStr] = (allDates[dateStr] || 0) + 1;
                  
                  // Track min and max dates
                  if (!minDate || isBefore(date, minDate)) {
                    minDate = date;
                    console.log(`New min date: ${format(minDate, 'yyyy-MM-dd')}`);
                  }
                  
                  if (!maxDate || isAfter(date, maxDate)) {
                    maxDate = date;
                    console.log(`New max date: ${format(maxDate, 'yyyy-MM-dd')}`);
                  }
                }
              }
            }
          });
        }
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
    
    console.log(`Created timeline with ${timeline.length} days, max events: ${maxEvents}`);
    console.log('Timeline data:', JSON.stringify(timeline));
    
    
    setTimelineData(timeline);
    setEventsPerDay(allDates);
    setMaxEventsPerDay(maxEvents);
    
    // Notify parent of initial date
    onTimeChange(format(minDate, 'yyyy-MM-dd'));
  }, [queryResults, resultCount]);
  
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
            // Advance to next day
            const nextDate = addDays(currentDate, 1);
            handleDateSelect(nextDate);
          }
        }
      }, 1000); // 1 second between steps
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
          <span className="text-xs text-gray-500">
            {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {startDate && format(startDate, 'MMM d, yyyy')} - {endDate && format(endDate, 'MMM d, yyyy')}
          </span>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start text-left font-normal"
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
      
      <div className="space-y-4">
        {/* Timeline visualization */}
        <div className="relative h-16 bg-gray-100 rounded-md overflow-hidden">
          {timelineData.map((day, index) => {
            const position = (index / (timelineData.length - 1 || 1)) * 100;
            const height = maxEventsPerDay > 0 
              ? (day.count / maxEventsPerDay) * 100 
              : 0;
            
            return (
              <div
                key={day.date}
                className="absolute bottom-0 bg-blue-500 w-1"
                style={{
                  left: `${position}%`,
                  height: `${height}%`,
                  opacity: currentDate && format(currentDate, 'yyyy-MM-dd') === day.date ? 1 : 0.5
                }}
                title={`${day.date}: ${day.count} events`}
              />
            );
          })}
          
          {/* Current position indicator */}
          {currentDate && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{
                left: `${sliderValue}%`
              }}
            />
          )}
        </div>
        
        {/* Slider control */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={togglePlayback}
            disabled={!startDate || !endDate}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={stepBackward}
            disabled={!currentDate || !startDate || isEqual(currentDate, startDate)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Slider
            value={[sliderValue]}
            onValueChange={handleSliderChange}
            className="flex-1"
            disabled={totalDays === 0}
          />
          
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={stepForward}
            disabled={!currentDate || !endDate || isEqual(currentDate, endDate)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
