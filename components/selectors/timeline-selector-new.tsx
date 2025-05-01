"use client";

import { useState, useEffect, useRef } from "react";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Tag } from "@/components/ui/tag";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HourSelector } from "./ui/hourSelector";
import { HolidaySelector } from "./ui/holidaySelector";

// Define Holiday interface
export interface Holiday {
  id: string;
  name: string;
  date: string;
  dates?: string[];
}

// US Holidays
const US_HOLIDAYS: Holiday[] = [
  { id: "new-years", name: "New Year's Day", date: "2025-01-01" },
  { id: "mlk", name: "Martin Luther King Jr. Day", date: "2025-01-20" },
  { id: "presidents", name: "Presidents' Day", date: "2025-02-17" },
  { id: "memorial", name: "Memorial Day", date: "2025-05-26" },
  { id: "independence", name: "Independence Day", date: "2025-07-04" },
  { id: "labor", name: "Labor Day", date: "2025-09-01" },
  { id: "columbus", name: "Columbus Day", date: "2025-10-13" },
  { id: "veterans", name: "Veterans Day", date: "2025-11-11" },
  { id: "thanksgiving", name: "Thanksgiving Day", date: "2025-11-27" },
  { id: "christmas", name: "Christmas Day", date: "2025-12-25" },
  { id: "easter", name: "Easter", date: "2025-04-20" },
  { id: "halloween", name: "Halloween", date: "2025-10-31" },
  { id: "valentines", name: "Valentine's Day", date: "2025-02-14" },
  { id: "st-patricks", name: "St. Patrick's Day", date: "2025-03-17" },
  { id: "mothers", name: "Mother's Day", date: "2025-05-11" },
  { id: "fathers", name: "Father's Day", date: "2025-06-15" }
];

// Types for timeframe selections
export type DateRange = {
  start: Date;
  end: Date;
};

export type TimeframeSelection = 
  | { type: "dateRange"; range: DateRange; operator?: "AND" | "OR" }
  | { type: "weekdays"; weekdays: string[]; operator?: "AND" | "OR" }
  | { type: "monthDays"; monthDays: string[]; operator?: "AND" | "OR" }
  | { type: "holidays"; holidays: string[]; operator?: "AND" | "OR" }
  | { type: "monthWeek"; monthWeek: string; monthWeekday: string; operator?: "AND" | "OR" }
  | { type: "hours"; hours: number[]; operator?: "AND" | "OR" };

export interface TimelineSelectorProps {
  selections: TimeframeSelection[];
  onSelectionsChange: (selections: TimeframeSelection[]) => void;
  getSummaryRef?: { getSummary: null | (() => string) };
}

export function TimelineSelector({
  selections = [],
  onSelectionsChange,
  getSummaryRef
}: TimelineSelectorProps) {
  // State for date range
  const [startDate, setStartDate] = useState<Date>(getDefaultStartDate());
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // State for recurrence options
  const [dayHours, setDayHours] = useState<number[]>([0, 24]);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [monthDays, setMonthDays] = useState<string[]>([]);
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([]);
  const [monthWeek, setMonthWeek] = useState<string>("");
  const [monthWeekday, setMonthWeekday] = useState<string>("");
  
  // State for available holidays
  const [availableHolidays, setAvailableHolidays] = useState<Holiday[]>([]);
  
  // State for accordion
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<React.ReactNode>(null);

  // Initially a week prior to the current day
  function getDefaultStartDate() {
    const currentDay = new Date();
    // Set the previous date to be 7 days earlier than the present day
    const earlierDate = new Date().setDate(currentDay.getDate() - 7);
    return new Date(earlierDate);
  }

  // Handle start date change with validation
  const handleStartDateChange = (date: Date | undefined) => {
    if (date && date <= new Date()) {
      setStartDate(date);
      // If end date exists and is before the new start date, reset it
      if (endDate && date > endDate) {
        setEndDate(new Date());
      }
      
      // Update selections with new date range
      updateDateRangeSelection(date, endDate);
    }
    updateAvailableHolidays();
  };

  // Handle end date change with validation
  const handleEndDateChange = (date: Date | undefined) => {
    // Only set the end date if it's after the start date
    if (date && date >= startDate && date <= new Date()) {
      setEndDate(date);
      
      // Update selections with new date range
      updateDateRangeSelection(startDate, date);
    } else if (!date) {
      setEndDate(new Date());
      
      // Update selections with new date range
      updateDateRangeSelection(startDate, new Date());
    }
    updateAvailableHolidays();
  };
  
  // Helper function to update date range selection
  const updateDateRangeSelection = (start: Date, end: Date) => {
    // Find existing date range selection if any
    const dateRangeIndex = selections.findIndex(s => s.type === "dateRange");
    
    // Create new date range selection
    const dateRangeSelection: TimeframeSelection = {
      type: "dateRange",
      range: { start, end },
      operator: "AND"
    };
    
    // Update selections array
    const newSelections = [...selections];
    
    if (dateRangeIndex >= 0) {
      // Replace existing date range selection
      newSelections[dateRangeIndex] = dateRangeSelection;
    } else {
      // Add new date range selection
      newSelections.push(dateRangeSelection);
    }
    
    // Update selections state
    onSelectionsChange(newSelections);
  };

  // Set all holidays to be displayed
  const updateAvailableHolidays = () => {
    // Set all holidays to be available for display
    setAvailableHolidays(US_HOLIDAYS);
  };

  // Initialize available holidays
  useEffect(() => {
    updateAvailableHolidays();
  }, [startDate, endDate]);
  
  // Initialize date range selection when component loads
  useEffect(() => {
    // Only add date range if no selections exist yet
    if (selections.length === 0) {
      updateDateRangeSelection(startDate, endDate);
    }
  }, []);
  
  // Handle hour change
  const handleHourChange = (hours: number[]) => {
    setDayHours(hours);
  };

  // Preview string generation functions
  function getHourlyPreviewString() {
    if (dayHours[0] === 0 && dayHours[1] === 24) {
      return "All hours";
    }
    
    const formatHour = (hour: number) => {
      if (hour === 0 || hour === 24) return "12 AM";
      if (hour === 12) return "12 PM";
      return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
    };
    
    return `${formatHour(dayHours[0])} to ${formatHour(dayHours[1])}`;
  }
  
  function getWeekdayPreviewString() {
    if (weekdays.length === 0) return undefined;
    
    function getWeekdays() {
      if (weekdays.length === 7) return "Every day";
      
      if (weekdays.length === 5 &&
          weekdays.includes("Mon") &&
          weekdays.includes("Tue") &&
          weekdays.includes("Wed") &&
          weekdays.includes("Thu") &&
          weekdays.includes("Fri")) {
        return "Weekdays";
      }
      
      if (weekdays.length === 2 &&
          weekdays.includes("Sat") &&
          weekdays.includes("Sun")) {
        return "Weekends";
      }
      
      return `${weekdays.slice(0, weekdays.length - 1).join(", ")} and ${weekdays[weekdays.length - 1]}`;
    }
    
    return `${getWeekdays()} each week`;
  }
  
  function getMonthlyPreviewString() {
    if (monthDays.length === 0) return undefined;
    
    function getMonthDays() {
      const days: any[] = [];
      
      for (let day of monthDays) {
        switch (day) {
          case "1":
          case "21":
          case "31":
            day += "st";
            break;
          case "2":
          case "22":
            day += "nd";
            break;
          case "3":
          case "23":
            day += "rd";
            break;
          case "last":
            day += " day";
            break;
          default:
            day += "th";
        }
        days.push(day);
      }
      
      if (days.length === 1) return days[0];
      else {
        return `${days.slice(0, days.length - 1).join(", ")} and ${days[days.length - 1]}`;
      }
    }
    
    let content = "";
    if (monthDays.length <= 3) {
      content += `${content === "" ? "T" : "t"}he ${getMonthDays()} of each month`;
    } else {
      content += `${monthDays.length} selected days of the month`;
    }
    return content;
  }
  
  function getYearlyPreviewString() {
    function getHolidayString() {
      const selection: string[] = [];
      
      for (const day of selectedHolidays) {
        let name = "";
        for (const holiday of availableHolidays) {
          if (holiday.id === day) {
            name = holiday.name;
            break;
          }
        }
        if (name) selection.push(name);
      }
      
      if (selection.length === 0) return "";
      
      return `${selection.slice(0, selection.length - 1).join(", ")}${selection.length > 1 ? " and " : ""}${selection[selection.length - 1]}`;
    }
    
    let content = "";
    if (selectedHolidays.length > 0) {
      if (selectedHolidays.length <= 3) {
        content += `${getHolidayString()}`;
      } else {
        content += `${selectedHolidays.length} selected holidays`;
      }
      
      if (monthWeekday && monthWeek) {
        content += `, along with the ${monthWeek} ${monthWeekday} of the year`;
      }
    } else if (monthWeekday && monthWeek) {
      content = `On the ${monthWeek} ${monthWeekday} of the year`;
    }
    
    return content || undefined;
  }
  
  function isPreviewable() {
    return (
      dayHours[0] !== 0 || dayHours[1] !== 24 ||
      weekdays.length > 0 ||
      monthDays.length > 0 ||
      selectedHolidays.length > 0 ||
      (monthWeek && monthWeekday)
    );
  }
  
  function getOverallPreviewString() {
    const parts: string[] = [];
    
    const hourlyPreview = getHourlyPreviewString();
    if (hourlyPreview && hourlyPreview !== "All hours") {
      parts.push(hourlyPreview);
    }
    
    const weekdayPreview = getWeekdayPreviewString();
    if (weekdayPreview) {
      parts.push(weekdayPreview);
    }
    
    const monthlyPreview = getMonthlyPreviewString();
    if (monthlyPreview) {
      parts.push(monthlyPreview);
    }
    
    const yearlyPreview = getYearlyPreviewString();
    if (yearlyPreview) {
      parts.push(yearlyPreview);
    }
    
    return parts.join("; ");
  }
  
  // Apply selections to the parent component
  const applySelections = () => {
    // Start with existing selections to preserve the date range that's already being managed
    const newSelections: TimeframeSelection[] = [];
    
    // Add date range selection
    newSelections.push({
      type: "dateRange",
      range: { start: startDate, end: endDate },
      operator: "AND"
    });
    
    // Add hours selection if not default (0-24)
    if (dayHours[0] !== 0 || dayHours[1] !== 24) {
      newSelections.push({
        type: "hours",
        hours: dayHours,
        operator: "AND"
      });
    }
    
    // Add weekdays selection if any weekdays are selected
    if (weekdays.length > 0) {
      newSelections.push({
        type: "weekdays",
        weekdays,
        operator: "AND"
      });
    }
    
    // Add month days selection if any month days are selected
    if (monthDays.length > 0) {
      newSelections.push({
        type: "monthDays",
        monthDays,
        operator: "AND"
      });
    }
    
    // Add holidays selection if any holidays are selected
    if (selectedHolidays.length > 0) {
      newSelections.push({
        type: "holidays",
        holidays: selectedHolidays,
        operator: "AND"
      });
    }
    
    // Add month week selection if both month week and weekday are selected
    if (monthWeek && monthWeekday) {
      newSelections.push({
        type: "monthWeek",
        monthWeek,
        monthWeekday,
        operator: "AND"
      });
    }
    
    // Update selections
    onSelectionsChange(newSelections);
  };
  
  // Format weekdays for display
  const formatWeekdays = (weekdays: string[]) => {
    if (weekdays.length === 0) return "";
    if (weekdays.length === 7) return "Every day";
    
    if (weekdays.length === 5 &&
        weekdays.includes("Mon") &&
        weekdays.includes("Tue") &&
        weekdays.includes("Wed") &&
        weekdays.includes("Thu") &&
        weekdays.includes("Fri")) {
      return "Weekdays";
    }
    
    if (weekdays.length === 2 &&
        weekdays.includes("Sat") &&
        weekdays.includes("Sun")) {
      return "Weekends";
    }
    
    return `${weekdays.join(", ")}`;
  };
  
  // Format month days for display
  const formatMonthDays = (monthDays: string[]) => {
    if (monthDays.length === 0) return "";
    return monthDays.join(", ");
  };
  
  // Format holidays for display
  const formatHolidays = (holidayIds: string[]) => {
    if (holidayIds.length === 0) return "";
    
    const holidayNames = holidayIds.map(id => {
      const holiday = US_HOLIDAYS.find(h => h.id === id);
      return holiday ? holiday.name : id;
    });
    
    if (holidayNames.length > 3) return `${holidayNames.length} selected holidays`;
    return `${holidayNames.join(", ")}`;
  };
  
  // Generate summary for display in the selector panel
  const getSummary = () => {
    if (selections.length === 0) {
      return "No timeframe selected";
    }
    
    const parts: string[] = [];
    
    // Process date range
    const dateRangeSelection = selections.find(s => s.type === "dateRange");
    if (dateRangeSelection && dateRangeSelection.type === "dateRange") {
      const { start, end } = dateRangeSelection.range;
      parts.push(`${format(start, "MMM d, yyyy")} to ${format(end, "MMM d, yyyy")}`);
    }
    
    // Process hours
    const hoursSelection = selections.find(s => s.type === "hours");
    if (hoursSelection && hoursSelection.type === "hours") {
      const formatHour = (hour: number) => {
        if (hour === 0 || hour === 24) return "12 AM";
        if (hour === 12) return "12 PM";
        return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
      };
      parts.push(`Hours: ${formatHour(hoursSelection.hours[0])} to ${formatHour(hoursSelection.hours[1])}`);
    }
    
    // Process weekdays
    const weekdaysSelection = selections.find(s => s.type === "weekdays");
    if (weekdaysSelection && weekdaysSelection.type === "weekdays") {
      const formattedWeekdays = formatWeekdays(weekdaysSelection.weekdays);
      if (formattedWeekdays) parts.push(formattedWeekdays);
    }
    
    // Process month days
    const monthDaysSelection = selections.find(s => s.type === "monthDays");
    if (monthDaysSelection && monthDaysSelection.type === "monthDays") {
      const formattedMonthDays = formatMonthDays(monthDaysSelection.monthDays);
      if (formattedMonthDays) parts.push(`Days: ${formattedMonthDays}`);
    }
    
    // Process holidays
    const holidaysSelection = selections.find(s => s.type === "holidays");
    if (holidaysSelection && holidaysSelection.type === "holidays") {
      const formattedHolidays = formatHolidays(holidaysSelection.holidays);
      if (formattedHolidays) parts.push(`Holidays: ${formattedHolidays}`);
    }
    
    // Process month week
    const monthWeekSelection = selections.find(s => s.type === "monthWeek");
    if (monthWeekSelection && monthWeekSelection.type === "monthWeek") {
      parts.push(`${monthWeekSelection.monthWeek} ${monthWeekSelection.monthWeekday} of each month`);
    }
    
    return parts.join(" | ");
  };
  
  // Attach the getSummary function to the ref if provided
  useEffect(() => {
    if (getSummaryRef) {
      getSummaryRef.getSummary = getSummary;
    }
    
    return () => {
      if (getSummaryRef) {
        getSummaryRef.getSummary = null;
      }
    };
  }, [selections]);
  
  // Handle accordion expansion
  const handleExpansion = () => {
    setExpanded((prevExpanded) => !prevExpanded);
  };

  // Update preview text when relevant state changes
  useEffect(() => {
    if (isPreviewable()) {
      setPreview(
        <div className="text-sm">
          {getOverallPreviewString()}
        </div>
      );
    } else {
      setPreview(null);
    }
  }, [dayHours, weekdays, monthDays, selectedHolidays, monthWeek, monthWeekday]);
  
  // Remove a selection
  const removeSelection = (index: number) => {
    const newSelections = [...selections];
    newSelections.splice(index, 1);
    onSelectionsChange(newSelections);
  };
  
  return (
    <div className="space-y-6">
      {/* Current Selections Section */}
      <div>
        <Label className="text-sm font-medium">Current Selections</Label>
        <div className="min-h-[40px] p-2 border rounded-md bg-slate-50">
          {selections.length === 0 ? (
            <span className="text-sm text-muted-foreground">No timeframe selections added yet</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Date Range (without delete button) */}
              {selections.find(s => s.type === "dateRange") && (
                <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-bold text-gray-800 mr-1 mb-1">
                  {(() => {
                    const dateRange = selections.find(s => s.type === "dateRange");
                    if (dateRange && dateRange.type === "dateRange") {
                      return `${format(dateRange.range.start, "MMM d, yyyy")} to ${format(dateRange.range.end, "MMM d, yyyy")}`;
                    }
                    return "";
                  })()}
                </div>
              )}
              
              {/* Hours selection */}
              {selections.find(s => s.type === "hours") && (
                <Tag
                  key="hours"
                  label={(() => {
                    const hoursSelection = selections.find(s => s.type === "hours");
                    if (hoursSelection && hoursSelection.type === "hours") {
                      const formatHour = (hour: number) => {
                        if (hour === 0 || hour === 24) return "12 AM";
                        if (hour === 12) return "12 PM";
                        return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
                      };
                      return `Hours: ${formatHour(hoursSelection.hours[0])} to ${formatHour(hoursSelection.hours[1])}`;
                    }
                    return "";
                  })()}
                  onDelete={() => {
                    const newSelections = selections.filter(s => s.type !== "hours");
                    onSelectionsChange(newSelections);
                  }}
                />
              )}
              
              {/* Other selections (with delete buttons) */}
              {selections
                .filter(selection => selection.type !== "dateRange" && selection.type !== "hours")
                .map((selection, i) => (
                  <Tag
                    key={i}
                    label={(() => {
                      if (selection.type === "weekdays") {
                        return `Days: ${selection.weekdays.join(", ")}`;
                      }
                      if (selection.type === "monthDays") {
                        return `Month days: ${selection.monthDays.join(", ")}`;
                      }
                      if (selection.type === "holidays") {
                        return `Holidays: ${formatHolidays(selection.holidays)}`;
                      }
                      if (selection.type === "monthWeek") {
                        return `${selection.monthWeek} ${selection.monthWeekday} of month`;
                      }
                      return "";
                    })()}
                    onDelete={() => {
                      const newSelections = selections.filter((_, index) => {
                        const selectionIndex = selections.findIndex(s => s.type !== "dateRange" && s.type !== "hours");
                        return index !== selectionIndex + i;
                      });
                      onSelectionsChange(newSelections);
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Date Options Section with Accordion */}
      <div className="rounded-md border bg-popover p-1 shadow-md outline-none w-full">
        <div className="flex flex-col max-h-full overflow-y-auto">
          <div className="px-4 py-2 border-b">
            <h3 className="text-base font-medium">Date Options</h3>
            
            {/* Date Range Selector */}
            <div className="grid grid-cols-2 gap-1">
              <div className="space-y-0 flex items-center space-x-4">
                <div className="space-y-0 flex items-center gap-1">
                  <Label className="text-base">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-8 text-sm"
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {format(startDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={handleStartDateChange}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-0 flex items-center gap-1">
                  <Label className="text-base">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal h-8 text-sm"
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={handleEndDateChange}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
          
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="options">
                <AccordionTrigger onClick={handleExpansion}>
                  {expanded ? (
                    "Editing Custom Days or Hours within Selected Range"
                  ) : isPreviewable() ? (
                    <div>
                      <span>Only Showing: </span>
                      <span className="p-2 bg-gray-100 rounded-md inline-block">
                        {getOverallPreviewString()}
                      </span>
                    </div>
                  ) : (
                    "Click to Add Custom Days or Hours within Selected Range"
                  )}
                </AccordionTrigger>
                <AccordionContent>
                  {/* Hourly */}
                  <Accordion type="single" collapsible className="mb-2">
                    <AccordionItem value="hourly">
                      <AccordionTrigger>
                        <div className="flex justify-between w-full">
                          <span className="font-medium">Hours of Day</span>
                          <span className="text-gray-500">{getHourlyPreviewString()}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                          <HourSelector
                            dayHours={dayHours}
                            setDayHours={handleHourChange}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Weekly */}
                  <Accordion type="single" collapsible className="mb-2">
                    <AccordionItem value="weekly">
                      <AccordionTrigger>
                        <div className="flex justify-between w-full">
                          <span className="font-medium">Days of Week</span>
                          <span className="text-gray-500">{getWeekdayPreviewString()}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                          <Label className="text-sm">Repeat on</Label>
                          <div className="flex flex-wrap gap-1">
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                              (day) => (
                                <Button
                                  key={day}
                                  variant={weekdays.includes(day) ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    setWeekdays((prev) =>
                                      prev.includes(day)
                                        ? prev.filter((d) => d !== day)
                                        : [...prev, day]
                                    );
                                  }}
                                >
                                  {day}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Monthly */}
                  <Accordion type="single" collapsible className="mb-2">
                    <AccordionItem value="monthly">
                      <AccordionTrigger>
                        <div className="flex justify-between w-full">
                          <span className="font-medium">Days of Month</span>
                          <span className="text-gray-500">{getMonthlyPreviewString()}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                          <Label className="text-sm">Days of the month</Label>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 31 }, (_, i) => {
                              const day = (i + 1).toString();
                              return (
                                <Button
                                  key={day}
                                  variant={monthDays.includes(day) ? "default" : "outline"}
                                  size="sm"
                                  className="h-7 w-7 p-0 text-xs"
                                  onClick={() => {
                                    setMonthDays((prev) =>
                                      prev.includes(day)
                                        ? prev.filter((d) => d !== day)
                                        : [...prev, day]
                                    );
                                  }}
                                >
                                  {day}
                                </Button>
                              );
                            })}
                            <Button
                              variant={monthDays.includes("last") ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs col-span-2"
                              onClick={() => {
                                setMonthDays((prev) =>
                                  prev.includes("last")
                                    ? prev.filter((d) => d !== "last")
                                    : [...prev, "last"]
                                );
                              }}
                            >
                              Last
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  {/* Yearly / Holidays */}
                  <Accordion type="single" collapsible className="mb-2">
                    <AccordionItem value="yearly">
                      <AccordionTrigger>
                        <div className="flex justify-between w-full">
                          <span className="font-medium">Days of Year & Holidays</span>
                          <span className="text-gray-500">{getYearlyPreviewString()}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Select holidays</Label>
                            <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-white">
                              <HolidaySelector
                                allHolidays={US_HOLIDAYS}
                                availableHolidays={availableHolidays}
                                selectedHolidays={selectedHolidays}
                                callback={setSelectedHolidays}
                              />
                            </div>
                          </div>
                          
                          <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                            <Label className="text-sm">Select a specific day</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={monthWeek}
                                onValueChange={(value) => {
                                  if (value === "-") setMonthWeek("");
                                  else setMonthWeek(`${value}`);
                                }}
                              >
                                <SelectTrigger
                                  className="h-8"
                                  style={{
                                    color: monthWeek ? "black" : "lightgray",
                                  }}
                                >
                                  <SelectValue placeholder="Position in Year" />
                                </SelectTrigger>
                                <SelectContent>
                                  {
                                    ["-", "first", "second", "third", "fourth", "last"].map((week) => (
                                      <SelectItem key={week} value={week}>
                                        {week}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                              
                              <Select
                                value={monthWeekday}
                                onValueChange={(value) => {
                                  if (value === "-") setMonthWeekday("");
                                  else setMonthWeekday(`${value}`);
                                }}
                              >
                                <SelectTrigger
                                  className="h-8"
                                  style={{
                                    color: monthWeekday ? "black" : "lightgray",
                                  }}
                                >
                                  <SelectValue placeholder="Day of Week" />
                                </SelectTrigger>
                                <SelectContent>
                                  {
                                    ["-", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                                      <SelectItem key={day} value={day}>
                                        {day}
                                      </SelectItem>
                                    ))
                                  }
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
          
          <div className="px-4 py-2 border-t">
            <Button onClick={applySelections} className="w-full h-8 text-sm">
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
