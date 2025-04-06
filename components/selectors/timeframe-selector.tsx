"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { CalendarIcon, X, Plus } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// Types for timeframe selections
export type DateRange = {
  start: Date
  end: Date
}

export type RecurringDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
export type RecurringMonth = "January" | "February" | "March" | "April" | "May" | "June" | "July" | "August" | "September" | "October" | "November" | "December"
export type RecurringYear = "2024" | "2025"

export type RecurringDaySelection = {
  type: "day"
  days: RecurringDay[]
}

export type RecurringMonthSelection = {
  type: "month"
  months: RecurringMonth[]
}

export type RecurringHolidaySelection = {
  type: "holiday"
  holiday: string
  years: RecurringYear[]
}

export type TimeframeSelection = 
  | { type: "dateRange"; range: DateRange; operator?: "AND" | "OR" }
  | { type: "recurringDay"; selection: RecurringDaySelection; operator?: "AND" | "OR" }
  | { type: "recurringMonth"; selection: RecurringMonthSelection; operator?: "AND" | "OR" }
  | { type: "recurringHoliday"; selection: RecurringHolidaySelection; operator?: "AND" | "OR" }
  | { type: "recurringCombined"; days: RecurringDay[]; months: RecurringMonth[]; years?: RecurringYear[]; operator?: "AND" | "OR" }

export interface TimeframeSelectorProps {
  selections: TimeframeSelection[]
  onSelectionsChange: (selections: TimeframeSelection[]) => void
  getSummaryRef?: { getSummary: null | (() => string) }
}

// US Holidays
const US_HOLIDAYS = [
  "New Year's Day",
  "Martin Luther King Jr. Day",
  "Presidents' Day",
  "Memorial Day",
  "Independence Day",
  "Labor Day",
  "Columbus Day",
  "Veterans Day",
  "Thanksgiving Day",
  "Christmas Day",
  "Easter",
  "Halloween",
  "Valentine's Day",
  "St. Patrick's Day",
  "Mother's Day",
  "Father's Day"
]

// Days of the week
const DAYS_OF_WEEK: RecurringDay[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
]

// Months of the year
const MONTHS_OF_YEAR: RecurringMonth[] = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
]

// Years
const YEARS: RecurringYear[] = ["2024", "2025"]

export function TimeframeSelector({
  selections = [],
  onSelectionsChange,
  getSummaryRef
}: TimeframeSelectorProps) {
  // State for date range
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  
  // State for recurring selections
  const [selectedDays, setSelectedDays] = useState<RecurringDay[]>([])
  const [selectedMonths, setSelectedMonths] = useState<RecurringMonth[]>([])
  const [selectedYears, setSelectedYears] = useState<RecurringYear[]>([])
  const [selectedHoliday, setSelectedHoliday] = useState<string>("")
  const [selectedHolidayYears, setSelectedHolidayYears] = useState<RecurringYear[]>([])
  
  // Function to toggle operator between AND and OR
  const toggleOperator = (index: number) => {
    const newSelections = [...selections]
    const currentOperator = newSelections[index].operator || "AND"
    newSelections[index].operator = currentOperator === "AND" ? "OR" : "AND"
    onSelectionsChange(newSelections)
  }
  
  // Function to remove a selection
  const removeSelection = (index: number) => {
    const newSelections = [...selections]
    newSelections.splice(index, 1)
    onSelectionsChange(newSelections)
  }
  
  // Function to add date range
  const addDateRange = () => {
    if (startDate && endDate) {
      const newSelection: TimeframeSelection = {
        type: "dateRange",
        range: { start: startDate, end: endDate },
        operator: "AND"
      }
      onSelectionsChange([...selections, newSelection])
      
      // Reset date inputs
      setStartDate(undefined)
      setEndDate(undefined)
    }
  }
  
  // Function to add recurring days
  const addRecurringDays = () => {
    if (selectedDays.length > 0) {
      const newSelection: TimeframeSelection = {
        type: "recurringDay",
        selection: { type: "day", days: [...selectedDays] },
        operator: "AND"
      }
      onSelectionsChange([...selections, newSelection])
      
      // Reset day selection
      setSelectedDays([])
    }
  }
  
  // Function to add recurring months
  const addRecurringMonths = () => {
    if (selectedMonths.length > 0) {
      const newSelection: TimeframeSelection = {
        type: "recurringMonth",
        selection: { type: "month", months: [...selectedMonths] },
        operator: "AND"
      }
      onSelectionsChange([...selections, newSelection])
      
      // Reset month selection
      setSelectedMonths([])
    }
  }
  
  // Function to add combined selection (days, months, years)
  const addCombinedSelection = () => {
    if (selectedDays.length > 0 || selectedMonths.length > 0 || selectedYears.length > 0) {
      const newSelection: TimeframeSelection = {
        type: "recurringCombined",
        days: [...selectedDays],
        months: [...selectedMonths],
        years: selectedYears.length > 0 ? [...selectedYears] : undefined,
        operator: "AND"
      }
      onSelectionsChange([...selections, newSelection])
      
      // Clear selections after adding
      setSelectedDays([])
      setSelectedMonths([])
      setSelectedYears([])
    }
  }
  
  // Function to add holiday selection
  const addHoliday = () => {
    if (selectedHoliday && selectedHolidayYears.length > 0) {
      const newSelection: TimeframeSelection = {
        type: "recurringHoliday",
        selection: { 
          type: "holiday", 
          holiday: selectedHoliday, 
          years: [...selectedHolidayYears] 
        },
        operator: "AND"
      }
      onSelectionsChange([...selections, newSelection])
      
      // Clear selections after adding
      setSelectedHoliday("")
      setSelectedHolidayYears([])
    }
  }
  
  // Function to toggle day selection
  const toggleDay = (day: RecurringDay) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day))
    } else {
      setSelectedDays([...selectedDays, day])
    }
  }
  
  // Function to toggle month selection
  const toggleMonth = (month: RecurringMonth) => {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter(m => m !== month))
    } else {
      setSelectedMonths([...selectedMonths, month])
    }
  }
  
  // Function to toggle year selection
  const toggleYear = (year: RecurringYear) => {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year))
    } else {
      setSelectedYears([...selectedYears, year])
    }
  }
  
  // Function to select all years
  const selectAllYears = () => {
    if (selectedYears.length === YEARS.length) {
      setSelectedYears([])
    } else {
      setSelectedYears([...YEARS])
    }
  }
  
  // Function to toggle holiday year selection
  const toggleHolidayYear = (year: RecurringYear) => {
    if (selectedHolidayYears.includes(year)) {
      setSelectedHolidayYears(selectedHolidayYears.filter(y => y !== year))
    } else {
      setSelectedHolidayYears([...selectedHolidayYears, year])
    }
  }
  
  // Function to select all days
  const selectAllDays = () => {
    if (selectedDays.length === DAYS_OF_WEEK.length) {
      setSelectedDays([])
    } else {
      setSelectedDays([...DAYS_OF_WEEK])
    }
  }
  
  // Function to select all months
  const selectAllMonths = () => {
    if (selectedMonths.length === MONTHS_OF_YEAR.length) {
      setSelectedMonths([])
    } else {
      setSelectedMonths([...MONTHS_OF_YEAR])
    }
  }
  
  // Function to select all holiday years
  const selectAllHolidayYears = () => {
    if (selectedHolidayYears.length === YEARS.length) {
      setSelectedHolidayYears([])
    } else {
      setSelectedHolidayYears([...YEARS])
    }
  }
  
  // Format a date for display
  const formatDate = (date: Date) => {
    return format(date, "MMM d, yyyy")
  }
  
  // Get a summary of the selections for display in collapsed view
  const getSummary = useCallback(() => {
    if (selections.length === 0) {
      return "No timeframe selected"
    }
    
    const summaries: string[] = selections.map((selection, index) => {
      const prefix = index > 0 ? (selection.operator || "AND") + " " : ""
      
      switch (selection.type) {
        case "dateRange":
          return `${prefix}${formatDate(selection.range.start)} to ${formatDate(selection.range.end)}`
        case "recurringDay":
          if (selection.selection.days.length === DAYS_OF_WEEK.length) {
            return `${prefix}All days of week`
          }
          return `${prefix}Days: ${selection.selection.days.join(", ")}`
        case "recurringMonth":
          if (selection.selection.months.length === MONTHS_OF_YEAR.length) {
            return `${prefix}All months`
          }
          return `${prefix}Months: ${selection.selection.months.join(", ")}`
        case "recurringHoliday":
          const yearText = selection.selection.years.length === YEARS.length 
            ? "all years" 
            : selection.selection.years.join(", ")
          return `${prefix}${selection.selection.holiday} (${yearText})`
        case "recurringCombined":
          let combinedText = ""
          if (selection.days.length > 0) {
            const dayText = selection.days.length === DAYS_OF_WEEK.length ? "All days" : selection.days.join(", ")
            combinedText = dayText
          }
          if (selection.months.length > 0) {
            const monthText = selection.months.length === MONTHS_OF_YEAR.length ? "all months" : selection.months.join(", ")
            combinedText = combinedText ? `${combinedText} of ${monthText}` : monthText
          }
          if (selection.years && selection.years.length > 0) {
            const yearText = selection.years.length === YEARS.length ? "all years" : selection.years.join(", ")
            combinedText = combinedText ? `${combinedText} of ${yearText}` : yearText
          }
          return `${prefix}${combinedText}`
        default:
          return ""
      }
    })
    
    return summaries.join(" | ")
  }, [selections])
      
  // For external access to the summary
  useEffect(() => {
    if (getSummaryRef) {
      getSummaryRef.getSummary = getSummary
    }
    
    return () => {
      if (getSummaryRef) {
        getSummaryRef.getSummary = null
      }
    }
  }, [getSummary, getSummaryRef])
  
  return (
    <div className="w-full space-y-4">
      {/* Selection Preview */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Current Selections</h3>
        <div className="min-h-[40px] p-2 border rounded-md bg-slate-50">
          {selections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeframe selections added yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selections.map((selection, index) => {
                let content = ""
                
                switch (selection.type) {
                  case "dateRange":
                    content = `${formatDate(selection.range.start)} to ${formatDate(selection.range.end)}`
                    break
                  case "recurringDay":
                    content = `Days: ${selection.selection.days.join(", ")}`
                    break
                  case "recurringMonth":
                    content = `Months: ${selection.selection.months.join(", ")}`
                    break
                  case "recurringHoliday":
                    content = `${selection.selection.holiday} (${selection.selection.years.join(", ")})`
                    break
                  case "recurringCombined":
                    let combinedText = []
                    if (selection.days && selection.days.length > 0) {
                      combinedText.push(`Days: ${selection.days.join(", ")}`)
                    }
                    if (selection.months && selection.months.length > 0) {
                      combinedText.push(`Months: ${selection.months.join(", ")}`)
                    }
                    if (selection.years && selection.years.length > 0) {
                      combinedText.push(`Years: ${selection.years.join(", ")}`)
                    }
                    content = combinedText.join(" | ")
                    break
                }
                
                return (
                  <div key={index} className="flex items-center gap-1">
                    {index > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium"
                        onClick={() => toggleOperator(index)}
                      >
                        {selection.operator || "AND"}
                      </Button>
                    )}
                    <Badge 
                      variant="outline" 
                      className="px-2 py-1 flex items-center gap-1 bg-white"
                    >
                      <span>{content}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => removeSelection(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Tabs for different selection types */}
      <Tabs defaultValue="dateRange" className="w-full">
        <TabsList className="flex flex-wrap gap-2 mb-4 bg-transparent p-0">
          <TabsTrigger 
            value="dateRange" 
            className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300"
          >
            Date Range
          </TabsTrigger>
          <TabsTrigger 
            value="recurring" 
            className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300"
          >
            Recurring Dates
          </TabsTrigger>
        </TabsList>
        
        {/* Date Range Tab */}
        <TabsContent value="dateRange" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="startDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate || undefined}
                    onSelect={(date) => setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="endDate"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate || undefined}
                    onSelect={(date) => setEndDate(date)}
                    initialFocus
                    disabled={(date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <Button 
            onClick={addDateRange}
            disabled={!startDate || !endDate}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Date Range
          </Button>
        </TabsContent>
        
        {/* Recurring Dates Tab */}
        <TabsContent value="recurring" className="space-y-4">
          {/* Days, Months, Years selectors */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Select Days, Months, and Years</Label>
            <div className="flex items-end gap-2">
              <div className="grid grid-cols-3 gap-2 flex-1">
                {/* Days Selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedDays.length > 0 
                        ? `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''}` 
                        : "Days"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandGroup>
                        <div className="p-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={selectAllDays}
                            className="w-full mb-2 text-xs"
                          >
                            {selectedDays.length === DAYS_OF_WEEK.length ? "Deselect All" : "Select All"}
                          </Button>
                          {DAYS_OF_WEEK.map((day) => (
                            <div key={day} className="flex items-center space-x-2 py-1">
                              <Checkbox 
                                id={`day-${day}`} 
                                checked={selectedDays.includes(day)}
                                onCheckedChange={() => toggleDay(day)}
                              />
                              <Label htmlFor={`day-${day}`} className="text-sm cursor-pointer flex-1">
                                {day}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Months Selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedMonths.length > 0 
                        ? `${selectedMonths.length} month${selectedMonths.length > 1 ? 's' : ''}` 
                        : "Months"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandGroup>
                        <div className="p-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={selectAllMonths}
                            className="w-full mb-2 text-xs"
                          >
                            {selectedMonths.length === MONTHS_OF_YEAR.length ? "Deselect All" : "Select All"}
                          </Button>
                          {MONTHS_OF_YEAR.map((month) => (
                            <div key={month} className="flex items-center space-x-2 py-1">
                              <Checkbox 
                                id={`month-${month}`} 
                                checked={selectedMonths.includes(month)}
                                onCheckedChange={() => toggleMonth(month)}
                              />
                              <Label htmlFor={`month-${month}`} className="text-sm cursor-pointer flex-1">
                                {month}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Years Selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedYears.length > 0 
                        ? `${selectedYears.length} year${selectedYears.length > 1 ? 's' : ''}` 
                        : "Years"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[150px] p-0" align="start">
                    <Command>
                      <CommandGroup>
                        <div className="p-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={selectAllYears}
                            className="w-full mb-2 text-xs"
                          >
                            {selectedYears.length === YEARS.length ? "Deselect All" : "Select All"}
                          </Button>
                          {YEARS.map((year) => (
                            <div key={year} className="flex items-center space-x-2 py-1">
                              <Checkbox 
                                id={`year-${year}`} 
                                checked={selectedYears.includes(year)}
                                onCheckedChange={() => toggleYear(year)}
                              />
                              <Label htmlFor={`year-${year}`} className="text-sm cursor-pointer flex-1">
                                {year}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              
              <Button 
                onClick={addCombinedSelection}
                disabled={selectedDays.length === 0 && selectedMonths.length === 0 && selectedYears.length === 0}
                size="icon"
                className="h-10 w-10"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="border-t my-3"></div>
          
          {/* Holidays section */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Holidays of</Label>
            <div className="flex items-end gap-2">
              <div className="grid grid-cols-2 gap-2 flex-1">
                {/* Holiday Selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedHoliday || "Select..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                      <CommandGroup>
                        <CommandList className="max-h-[200px] overflow-auto">
                        {US_HOLIDAYS.map((holiday) => (
                          <CommandItem
                            key={holiday}
                            value={holiday}
                            onSelect={() => setSelectedHoliday(holiday)}
                          >
                            {holiday}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {/* Years for Holidays */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedHolidayYears.length > 0 
                      ? `${selectedHolidayYears.length} selected` 
                      : "Select..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[150px] p-0" align="start">
                  <Command>
                    <CommandGroup>
                      <div className="p-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={selectAllHolidayYears}
                          className="w-full mb-2 text-xs"
                        >
                          {selectedHolidayYears.length === YEARS.length ? "Deselect All" : "Select All"}
                        </Button>
                        {YEARS.map((year) => (
                          <div key={year} className="flex items-center space-x-2 py-1">
                            <Checkbox 
                              id={`holiday-year-${year}`} 
                              checked={selectedHolidayYears.includes(year)}
                              onCheckedChange={() => toggleHolidayYear(year)}
                            />
                            <Label htmlFor={`holiday-year-${year}`} className="text-sm cursor-pointer flex-1">
                              {year}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              </div>
              
              <Button 
                onClick={addHoliday}
                disabled={!selectedHoliday || selectedHolidayYears.length === 0}
                size="icon"
                className="h-10 w-10"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}