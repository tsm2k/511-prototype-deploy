"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { format, getYear, getMonth } from "date-fns"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  // State for the current month being displayed
  const [currentMonth, setCurrentMonth] = React.useState<Date>(props.defaultMonth || new Date());
  
  // Update the current month when the defaultMonth prop changes
  React.useEffect(() => {
    if (props.defaultMonth) {
      setCurrentMonth(props.defaultMonth);
    }
  }, [props.defaultMonth]);
  
  // Handle month change from the DayPicker
  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
    if (props.onMonthChange) {
      props.onMonthChange(month);
    }
  };
  
  // Get current year and month
  const currentYear = getYear(currentMonth);
  const currentMonthIndex = getMonth(currentMonth);
  
  // Generate years for dropdown (10 years in past, 10 years in future)
  const years = React.useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => {
      const year = currentYear - 10 + i;
      return { value: year.toString(), label: year.toString() };
    });
  }, [currentYear]);
  
  // Month names for dropdown
  const months = React.useMemo(() => [
    { value: "0", label: "January" },
    { value: "1", label: "February" },
    { value: "2", label: "March" },
    { value: "3", label: "April" },
    { value: "4", label: "May" },
    { value: "5", label: "June" },
    { value: "6", label: "July" },
    { value: "7", label: "August" },
    { value: "8", label: "September" },
    { value: "9", label: "October" },
    { value: "10", label: "November" },
    { value: "11", label: "December" }
  ], []);
  
  // Handle year change
  const handleYearChange = (year: string) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(parseInt(year));
    handleMonthChange(newDate);
  };
  
  // Handle month change
  const handleMonthSelect = (month: string) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(parseInt(month));
    handleMonthChange(newDate);
  };
  
  // Custom caption component with month/year dropdowns
  const CustomCaption = React.useCallback(() => {
    return (
      <div className="flex justify-between items-center px-2 py-1">
        <button
          onClick={() => {
            const prevMonth = new Date(currentMonth);
            prevMonth.setMonth(prevMonth.getMonth() - 1);
            handleMonthChange(prevMonth);
          }}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-7 w-7 p-0 opacity-70 hover:opacity-100"
          )}
          type="button"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-1">
          <Select value={currentMonthIndex.toString()} onValueChange={handleMonthSelect}>
            <SelectTrigger className="h-7 min-h-0 w-[90px] text-sm px-2 py-0 border-0 bg-transparent hover:bg-gray-100 rounded">
              <SelectValue>
                {months[currentMonthIndex].label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value} className="text-xs py-1">
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={currentYear.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="h-7 min-h-0 w-[70px] text-sm px-2 py-0 border-0 bg-transparent hover:bg-gray-100 rounded">
              <SelectValue>
                {currentYear}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {years.map((year) => (
                <SelectItem key={year.value} value={year.value} className="text-xs py-1">
                  {year.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <button
          onClick={() => {
            const nextMonth = new Date(currentMonth);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            handleMonthChange(nextMonth);
          }}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-7 w-7 p-0 opacity-70 hover:opacity-100"
          )}
          type="button"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }, [currentMonth, currentMonthIndex, currentYear, handleMonthChange, handleMonthSelect, handleYearChange, months, years]);
  
  return (
    <DayPicker
      month={currentMonth}
      onMonthChange={handleMonthChange}
      showOutsideDays={showOutsideDays}
      className={cn("p-2 pr-0", className)}
      classNames={{
        months: "flex flex-col space-y-3",
        month: "space-y-3",
        caption: "flex justify-center relative items-center mb-1",
        caption_label: "sr-only", // Hide the default caption label
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 opacity-70 hover:opacity-100"
        ),
        nav_button_previous: "hidden", // Hide default nav buttons
        nav_button_next: "hidden", // Hide default nav buttons
        table: "w-auto border-collapse",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] py-1",
        row: "flex w-full mt-1",
        cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20 last:pr-0",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal text-sm aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar"

export { Calendar }
