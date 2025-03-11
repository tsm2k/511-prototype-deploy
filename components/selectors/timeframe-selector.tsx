"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 4 }, (_, i) => String(currentYear - 1 + i)) // Current year and 3 years ahead

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
]

interface Holiday {
  name: string
  date: string
}

const holidays: Holiday[] = [
  { name: "New Year's Day", date: "2024-01-01" },
  { name: "Martin Luther King Jr. Day", date: "2024-01-15" },
  { name: "Presidents' Day", date: "2024-02-19" },
  { name: "Memorial Day", date: "2024-05-27" },
  { name: "Independence Day", date: "2024-07-04" },
  { name: "Labor Day", date: "2024-09-02" },
  { name: "Columbus Day", date: "2024-10-14" },
  { name: "Veterans Day", date: "2024-11-11" },
  { name: "Thanksgiving Day", date: "2024-11-28" },
  { name: "Christmas Day", date: "2024-12-25" },
]

interface DateRange {
  start: string
  end: string
}

export interface TimeframeSelectorProps {
  selectedTimeframe: DateRange | null
  onSelectedTimeframeChange?: (timeframe: DateRange | null) => void
  setSelectedTimeframe?: (timeframe: DateRange | null) => void
}

interface TimeframeState {
  calendar: DateRange | null
  monthRanges: DateRange[]
  dayRanges: DateRange[]
  holidays: DateRange[]
}

interface TimeframeSelection {
  type: 'calendar' | 'months' | 'holidays'
  calendar: { from: Date | undefined; to: Date | undefined }
  monthRange: { months: string[]; years: string[] }
  holidays: string[]
}

export function TimeframeSelector({
  selectedTimeframe,
  onSelectedTimeframeChange,
  setSelectedTimeframe,
}: TimeframeSelectorProps) {
  const applyTimeframe = (timeframe: DateRange | null) => {
    if (onSelectedTimeframeChange) {
      onSelectedTimeframeChange(timeframe);
    } else if (setSelectedTimeframe) {
      setSelectedTimeframe(timeframe);
    }
  }
  const [activeTab, setActiveTab] = useState<'calendar' | 'dateRange' | 'holidays'>('calendar')
  
  const [timeframeState, setTimeframeState] = useState<TimeframeState>({
    calendar: selectedTimeframe,
    monthRanges: selectedTimeframe ? [selectedTimeframe] : [],
    dayRanges: selectedTimeframe ? [selectedTimeframe] : [],
    holidays: selectedTimeframe ? [selectedTimeframe] : []
  })

  const [calendarSelection, setCalendarSelection] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: selectedTimeframe ? new Date(selectedTimeframe.start) : undefined,
    to: selectedTimeframe ? new Date(selectedTimeframe.end) : undefined
  })

  const [monthRangeSelection, setMonthRangeSelection] = useState<{
    months: string[]
    years: string[]
  }>(() => {
    if (!selectedTimeframe) return { months: [], years: [] }
    
    const monthsSet = new Set<string>()
    const yearsSet = new Set<string>()
    let currentDate = new Date(selectedTimeframe.start)
    const endDate = new Date(selectedTimeframe.end)
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear().toString()
      // Only add years that are in our valid range
      if (years.includes(year)) {
        yearsSet.add(year)
        monthsSet.add(months[currentDate.getMonth()])
      }
      currentDate.setMonth(currentDate.getMonth() + 1)
    }
    
    return {
      months: Array.from(monthsSet).sort((a, b) => months.indexOf(a) - months.indexOf(b)),
      years: Array.from(yearsSet).sort()
    }
  })

  const [dayRangeSelection, setDayRangeSelection] = useState<string[]>(() => {
    if (!selectedTimeframe) return []
    
    const daysSet = new Set<string>()
    let currentDate = new Date(selectedTimeframe.start)
    const endDate = new Date(selectedTimeframe.end)
    
    while (currentDate <= endDate) {
      daysSet.add(daysOfWeek[currentDate.getDay()])
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return Array.from(daysSet)
  })

  const [holidaySelection, setHolidaySelection] = useState<string[]>(() => {
    if (!selectedTimeframe) return []
    
    const start = new Date(selectedTimeframe.start)
    const end = new Date(selectedTimeframe.end)
    
    return holidays
      .filter((holiday: Holiday) => {
        const holidayDate = new Date(holiday.date)
        return holidayDate >= start && holidayDate <= end
      })
      .map((holiday: Holiday) => holiday.name)
  })

  // Re-initialize states when selectedTimeframe changes externally
  useEffect(() => {
    if (selectedTimeframe) {
      const start = new Date(selectedTimeframe.start)
      const end = new Date(selectedTimeframe.end)
      
      // Update calendar selection
      setCalendarSelection({ from: start, to: end })
      
      // Update month and year selections
      const monthsSet = new Set<string>()
      const yearsSet = new Set<string>()
      let currentDate = new Date(start)
      while (currentDate <= end) {
        const year = currentDate.getFullYear().toString()
        // Only add years that are in our valid range
        if (years.includes(year)) {
          yearsSet.add(year)
          monthsSet.add(months[currentDate.getMonth()])
        }
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
      setMonthRangeSelection({
        months: Array.from(monthsSet).sort((a: string, b: string) => months.indexOf(a) - months.indexOf(b)),
        years: Array.from(yearsSet).sort()
      })
      
      // Update day selections
      const daysSet = new Set<string>()
      currentDate = new Date(start)
      while (currentDate <= end) {
        daysSet.add(daysOfWeek[currentDate.getDay()])
        currentDate.setDate(currentDate.getDate() + 1)
      }
      setDayRangeSelection(Array.from(daysSet))
      
      // Update holiday selections
      const selectedHolidays = holidays
        .filter((holiday: Holiday) => {
          const holidayDate = new Date(holiday.date)
          return holidayDate >= start && holidayDate <= end
        })
        .map((holiday: Holiday) => holiday.name)
      setHolidaySelection(selectedHolidays)
      
      // Update timeframe state
      setTimeframeState({
        calendar: selectedTimeframe,
        monthRanges: [selectedTimeframe],
        dayRanges: [selectedTimeframe],
        holidays: [selectedTimeframe]
      })
    }
  }, [selectedTimeframe])

  // Persist selections in timeframeState
  useEffect(() => {
    if (calendarSelection.from && calendarSelection.to) {
      const start = calendarSelection.from.toISOString().split('T')[0]
      const end = calendarSelection.to.toISOString().split('T')[0]
      setTimeframeState(prev => ({
        ...prev,
        calendar: { start, end }
      }))
    } else {
      setTimeframeState(prev => ({ ...prev, calendar: null }))
    }
  }, [calendarSelection])

  useEffect(() => {
    if (monthRangeSelection.months.length > 0 && monthRangeSelection.years.length > 0) {
      const ranges: DateRange[] = []
      
      for (const year of monthRangeSelection.years.sort()) {
        for (const month of monthRangeSelection.months.sort((a, b) => months.indexOf(a) - months.indexOf(b))) {
          const monthIndex = months.indexOf(month)
          const startDate = new Date(Number(year), monthIndex, 1)
          const endDate = new Date(Number(year), monthIndex + 1, 0)
          
          ranges.push({
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          })
        }
      }
      
      setTimeframeState(prev => ({ ...prev, monthRanges: ranges }))
    }
  }, [monthRangeSelection])

  useEffect(() => {
    if (holidaySelection.length > 0) {
      const ranges = holidays
        .filter(h => holidaySelection.includes(h.name))
        .map(h => ({
          start: h.date,
          end: h.date
        }))
      
      setTimeframeState(prev => ({ ...prev, holidays: ranges }))
    }
  }, [holidaySelection])

  useEffect(() => {
    if (dayRangeSelection.length > 0) {
      const ranges: DateRange[] = []
      const startDate = new Date(currentYear, 0, 1)
      const endDate = new Date(currentYear, 11, 31)
      
      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dayName = daysOfWeek[currentDate.getDay()]
        if (dayRangeSelection.includes(dayName)) {
          ranges.push({
            start: currentDate.toISOString().split('T')[0],
            end: currentDate.toISOString().split('T')[0]
          })
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      setTimeframeState(prev => ({ ...prev, dayRanges: ranges }))
    }
  }, [dayRangeSelection])



  // Don't reset selections when switching tabs

  const updateTimeframeFromSelections = (months: string[], years: string[]) => {
    const ranges: DateRange[] = []
    
    if (months.length > 0 && years.length > 0) {
      // Only use years from our valid range
      const validYears = years.filter((y: string) => years.includes(y)).sort()
      
      // Create ranges for each valid month and year combination
      for (const year of validYears) {
        for (const month of months) {
          // Get the correct month index from the global months array
          const monthIndex = months.findIndex((m: string) => m === month)
          if (monthIndex !== -1) {
            // Create start and end dates for this month
            const startDate = new Date(Number(year), monthIndex, 1)
            const endDate = new Date(Number(year), monthIndex + 1, 0)
            ranges.push({
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            })
          }
        }
      }
      
      // Sort ranges by date
      ranges.sort((a, b) => a.start.localeCompare(b.start))
    }
    
    // Update both states together
    setTimeframeState((prev: TimeframeState) => ({ ...prev, monthRanges: ranges }))
    applyTimeframe(ranges.length > 0 ? ranges[0] : null)
  }

  const toggleMonth = (month: string) => {
    setMonthRangeSelection((prev: { months: string[]; years: string[] }) => {
      const newMonths = prev.months.includes(month)
        ? prev.months.filter((m: string) => m !== month)
        : [...prev.months, month].sort((a, b) => months.indexOf(a) - months.indexOf(b))
      const newSelection = { ...prev, months: newMonths }
      updateTimeframeFromSelections(newSelection.months, newSelection.years)
      return newSelection
    })
  }

  const toggleYear = (year: string) => {
    if (!years.includes(year)) return // Only toggle valid years
    
    setMonthRangeSelection((prev: { months: string[]; years: string[] }) => {
      const newYears = prev.years.includes(year)
        ? prev.years.filter((y: string) => y !== year)
        : [...prev.years, year].sort((a, b) => Number(a) - Number(b))
      const newSelection = { ...prev, years: newYears }
      updateTimeframeFromSelections(newSelection.months, newSelection.years)
      return newSelection
    })
  }

  const toggleHoliday = (holidayName: string) => {
    const newHolidays = holidaySelection.includes(holidayName)
      ? holidaySelection.filter((h: string) => h !== holidayName)
      : [...holidaySelection, holidayName]
    
    const ranges = newHolidays.length > 0
      ? holidays
          .filter((h: Holiday) => newHolidays.includes(h.name))
          .map((h: Holiday) => ({
            start: h.date,
            end: h.date
          }))
      : []
    
    // Update all states together
    setHolidaySelection(newHolidays)
    setTimeframeState((prev: TimeframeState) => ({ ...prev, holidays: ranges }))
    applyTimeframe(ranges.length > 0 ? ranges[0] : null)
  }

  const toggleAllHolidays = () => {
    const newHolidays = holidaySelection.length === holidays.length ? [] : holidays.map((h: Holiday) => h.name)
    const ranges = newHolidays.length > 0
      ? holidays.map((h: Holiday) => ({ start: h.date, end: h.date }))
      : []
    
    // Update all states together
    setHolidaySelection?.(newHolidays)
    setTimeframeState?.((prev: TimeframeState) => ({ ...prev, holidays: ranges }))
    applyTimeframe(ranges.length > 0 ? ranges[0] : null)
  }

  const toggleDay = (day: string) => {
    setDayRangeSelection((prev: string[]) => {
      const newDays = prev.includes(day)
        ? prev.filter((d: string) => d !== day)
        : [...prev, day].sort((a, b) => daysOfWeek.indexOf(a) - daysOfWeek.indexOf(b))
      
      const ranges: DateRange[] = []
      if (newDays.length > 0) {
        const startDate = new Date(currentYear, 0, 1)
        const endDate = new Date(currentYear, 11, 31)
        
        let currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          const dayName = daysOfWeek[currentDate.getDay()]
          if (newDays.includes(dayName)) {
            ranges.push({
              start: currentDate.toISOString().split('T')[0],
              end: currentDate.toISOString().split('T')[0]
            })
          }
          currentDate.setDate(currentDate.getDate() + 1)
        }
      }
      
      // Update all states together
      setTimeframeState?.((prev: TimeframeState) => ({ ...prev, dayRanges: ranges }))
      applyTimeframe(ranges.length > 0 ? ranges[0] : null)
      
      return newDays
    })
  }

  const getDefaultTab = () => {
    return activeTab || 'calendar'
  }

  return (
    <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'calendar' | 'dateRange' | 'holidays')} className="w-full">
      <TabsList className="flex flex-wrap gap-2 mb-4 bg-transparent p-0">
        <TabsTrigger value="calendar" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Date Picker</TabsTrigger>
        <TabsTrigger value="dateRange" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Date Range</TabsTrigger>
        <TabsTrigger value="holidays" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Holidays</TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="space-y-4">
        <div className="flex justify-center">
          <div className="flex flex-col space-y-4">
            <div className="flex space-x-4">
              <div className="flex flex-col">
                <Label htmlFor="start-date" className="text-sm font-medium">Start Date</Label>
                <input
                  type="date"
                  id="start-date"
                  value={calendarSelection.from ? calendarSelection.from.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const newDate = e.target.value ? new Date(e.target.value) : undefined
                    setCalendarSelection?.(prev => ({ ...prev, from: newDate }))
                    if (newDate && calendarSelection.to) {
                      const dateRange = {
                        start: newDate.toISOString().split('T')[0],
                        end: calendarSelection.to.toISOString().split('T')[0]
                      }
                      setTimeframeState?.(prev => ({ ...prev, calendar: dateRange }))
                      applyTimeframe(dateRange)
                    }
                  }}
                  className="border rounded-md p-2"
                />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="end-date" className="text-sm font-medium">End Date</Label>
                <input
                  type="date"
                  id="end-date"
                  value={calendarSelection.to ? calendarSelection.to.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const newDate = e.target.value ? new Date(e.target.value) : undefined
                    setCalendarSelection?.(prev => ({ ...prev, to: newDate }))
                    if (calendarSelection.from && newDate) {
                      const dateRange = {
                        start: calendarSelection.from.toISOString().split('T')[0],
                        end: newDate.toISOString().split('T')[0]
                      }
                      setTimeframeState?.(prev => ({ ...prev, calendar: dateRange }))
                      applyTimeframe(dateRange)
                    }
                  }}
                  className="border rounded-md p-2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected Range:</p>
              <div className="flex flex-wrap gap-1">
                {timeframeState.calendar && (
                  <>
                    <Badge variant="outline">From: {timeframeState.calendar.start}</Badge>
                    <Badge variant="outline">To: {timeframeState.calendar.end}</Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="dateRange" className="mt-2">
        <div className="space-y-6">
          <div className="p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-600 font-medium">Note: This functionality is currently untested</p>
          </div>
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Date Range Selection</h4>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMonthRangeSelection({
                    months: [],
                    years: []
                  })
                  setDayRangeSelection?.([])
                  setTimeframeState?.(prev => ({ ...prev, monthRanges: [], dayRanges: [] }))
                  setSelectedTimeframe?.(null)
                }}
              >
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newSelection = {
                    months: [...months],
                    years: [...years],
                    days: [...daysOfWeek]
                  }
                  setMonthRangeSelection(newSelection)
                  setDayRangeSelection(newSelection.days)
                  
                  const ranges: DateRange[] = []
                  for (const year of years) {
                    for (const month of months) {
                      const monthIndex = months.findIndex((m: string) => m === month)
                      if (monthIndex !== -1) {
                        const startDate = new Date(Number(year), monthIndex, 1)
                        const endDate = new Date(Number(year), monthIndex + 1, 0)
                        ranges.push({
                          start: startDate.toISOString().split('T')[0],
                          end: endDate.toISOString().split('T')[0]
                        })
                      }
                    }
                  }
                  
                  ranges.sort((a, b) => a.start.localeCompare(b.start))
                  setTimeframeState?.(prev => ({ ...prev, monthRanges: ranges, dayRanges: ranges }))
                  setSelectedTimeframe?.(ranges.length > 0 ? ranges[0] : null)
                }}
              >
                Select All
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Years</h4>
                <div className="text-xs text-muted-foreground">
                  {monthRangeSelection.years.length} selected
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 border rounded-lg bg-white">
                {years.map((year) => (
                  <div key={year} className="flex items-center space-x-2 min-w-0">
                    <Checkbox
                      id={`year-${year}`}
                      checked={monthRangeSelection.years.includes(year)}
                      onCheckedChange={() => toggleYear(year)}
                      className="shrink-0"
                    />
                    <Label
                      htmlFor={`year-${year}`}
                      className="text-sm"
                    >
                      {year}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium">Months</h4>
                <div className="text-xs text-muted-foreground">
                  {monthRangeSelection.months.length} selected
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 border rounded-lg bg-white">
                {months.map((month) => (
                  <div key={month} className="flex items-center space-x-2 min-w-0">
                    <Checkbox
                      id={`month-${month}`}
                      checked={monthRangeSelection.months.includes(month)}
                      onCheckedChange={() => toggleMonth(month)}
                      className="shrink-0"
                    />
                    <Label
                      htmlFor={`month-${month}`}
                      className="text-sm truncate"
                    >
                      {month}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Days of Week</h4>
              <div className="text-xs text-muted-foreground">
                {dayRangeSelection.length} selected
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 border rounded-lg bg-white">
              {daysOfWeek.map((day) => (
                <div key={day} className="flex items-center space-x-2 min-w-0">
                  <Checkbox
                    id={`day-${day}`}
                    checked={dayRangeSelection.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                    className="shrink-0"
                  />
                  <Label
                    htmlFor={`day-${day}`}
                    className="text-sm"
                  >
                    {day}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Selected Ranges</h4>
            <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-white min-h-[60px]">
              {monthRangeSelection.months.length === 0 && monthRangeSelection.years.length === 0 && dayRangeSelection.length === 0 ? (
                <div className="text-sm text-muted-foreground">No selections made</div>
              ) : (
                <>
                  {monthRangeSelection.years.sort().map(year => (
                    monthRangeSelection.months
                      .sort((a, b) => months.indexOf(a) - months.indexOf(b))
                      .map(month => (
                        <Badge 
                          key={`${year}-${month}`} 
                          variant="secondary"
                          className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          {month} {year}
                        </Badge>
                      ))
                  ))}
                  {dayRangeSelection.map(day => (
                    <Badge 
                      key={day} 
                      variant="secondary"
                      className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      {day}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="holidays" className="space-y-4">
        <div className="p-2 bg-red-50 border border-red-200 rounded-md mb-4">
          <p className="text-xs text-red-600 font-medium">Note: This functionality is currently untested</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium">Federal Holidays:</p>
          <Button variant="outline" size="sm" onClick={toggleAllHolidays}>
            {holidaySelection.length === holidays.length ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
          {holidays.map((holiday: { name: string; date: string }) => (
            <div key={holiday.name} className="flex items-center justify-between py-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`holiday-${holiday.name}`}
                  checked={holidaySelection.includes(holiday.name)}
                  onCheckedChange={() => toggleHoliday(holiday.name)}
                />
                <Label htmlFor={`holiday-${holiday.name}`}>{holiday.name}</Label>
              </div>
              <span className="text-sm text-muted-foreground">{holiday.date}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Selected Holidays:</p>
          <div className="flex flex-wrap gap-1">
            {timeframeState.holidays.length > 0 ? (
              timeframeState.holidays.map((range, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {range.start} - {holidays.find(h => h.date === range.start)?.name}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No holidays selected</p>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
