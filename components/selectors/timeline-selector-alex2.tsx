"use client";

import { useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
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
import { Tag } from "@/components/ui/tag";
import { HolidaySelector } from "./ui/holidaySelector";

import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { HourSelector } from "./ui/hourSelector";

export interface Holiday {
  id: string;
  name: string;
  dates: string[];
}

export default function RecurringDateSelector(props: {
  earliestDate: Date;
  holidays: Holiday[];
  jsonSaveCallback: Function;
}) {
  const earliestDate = props.earliestDate;
  const holidays = props.holidays;
  const setJsonOutput = props.jsonSaveCallback;

  const [dayHours, setDayHours] = useState<number[]>([0, 24]);
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [monthDays, setMonthDays] = useState<string[]>([]);
  const [selectedHolidays, setSelectedHolidays] = useState<string[]>([]);
  const [monthWeek, setMonthWeek] = useState("");
  const [monthWeekday, setMonthWeekday] = useState("");

  const [endDate, setEndDate] = useState<Date>(new Date()); // Initialy the current date
  const [startDate, setStartDate] = useState<Date>(getDefaultStartDate());
  const [preview, setPreview] = useState(<div></div>);

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
        // NOTE: This resets to the CURRENT DAY, which might
        // mean that a lot of days are getting selected
        handleEndDateChange(undefined);
      }
    }
    setAvailableHolidays();
  };

  // Handle end date change with validation
  const handleEndDateChange = (date: Date | undefined) => {
    // Only set the end date if it's after the start date
    if (date && date >= startDate && date <= new Date()) {
      setEndDate(date);
    } else if (!date) {
      setEndDate(new Date());
    }

    setAvailableHolidays();
  };

  const generateJSON = () => {
    // TODO: ensure correct format
    // the "logic" operator might be wrong here.
    //  basically, we need the start and end date, then the
    //  other options are an OR with each other, and an AND
    //  with the start/end dates?
    const json: any = {
      temporal_join_conditions: [
        {
          expressions: [
            {
              column: "date_start",
              operator: ">=",
              value: startDate.toLocaleDateString("en-us").replaceAll("/", "-"),
            },
          ],
          logic: "AND",
        },
        {
          expressions: [
            {
              column: "date_end",
              operator: "<=",
              value: endDate.toLocaleDateString("en-us").replaceAll("/", "-"),
            },
          ],
          logic: "AND",
        },
        {
          expressions: [
            { column: "hour_start", operator: ">=", value: dayHours[0] },
            { column: "hour_end", operator: "<=", value: dayHours[1] },
          ],
          logic: "AND",
        },
      ],
    };

    if (weekdays.length > 0) {
      json.temporal_join_conditions.push({
        expressions: [
          {
            column: "days_of_week",
            operator: "==",
            value: [weekdays],
          },
        ],
        logic: "OR",
      });
    }

    if (monthDays.length > 0) {
      json.temporal_join_conditions.push({
        expressions: [
          {
            column: "days_of_month",
            operator: "==",
            value: [monthDays],
          },
        ],
        logic: "OR",
      });
    }

    if (selectedHolidays.length > 0) {
      json.temporal_join_conditions.push({
        expressions: [
          {
            column: "holidays",
            operator: "==",
            value: [
              selectedHolidays.map((holiday) => {
                for (const item of availableHolidaysList) {
                  if (item.id === holiday) return item;
                }
              }),
            ],
          },
        ],
        logic: "OR",
      });
    }

    if (monthWeek && monthWeekday) {
      json.temporal_join_conditions.push({
        expressions: [
          {
            column: "first_date_of_year",
            operator: "==",
            value: {
              monthWeek,
              monthWeekday,
            },
          },
        ],
        logic: "OR",
      });
    }

    return JSON.stringify(json, null, 2);
  };

  const [availableHolidaysList, setAvailableHolidaysList] = useState<Holiday[]>(
    getAvailableHolidays()
  );

  function getAvailableHolidays() {
    const availableHolidays: Holiday[] = [];

    for (const holiday of holidays) {
      const holidayAvailableDates: string[] = [];
      for (const holidayDate of holiday.dates) {
        const date = new Date(holidayDate);
        if (date >= startDate && date <= endDate) {
          holidayAvailableDates.push(
            date.toLocaleDateString("en-us").replaceAll("/", "-")
          );
        }
      }
      if (holidayAvailableDates.length > 0) {
        holiday.dates = holidayAvailableDates;
        availableHolidays.push(holiday);
      }
    }
    return availableHolidays;
  }

  function setAvailableHolidays() {
    setAvailableHolidaysList(getAvailableHolidays());
  }

  function handleHourChange(newHours: number[]) {
    setDayHours(newHours);
  }

  function valueLabelFormat(value: number) {
    const suffix = value >= 12 ? "PM" : "AM";
    const hour = value % 12 === 0 ? 12 : value % 12; // Convert 0 and 12 to 12
    return `${hour} ${suffix}`;
  }
  useEffect(() => {
    setAvailableHolidays();

    const invalidSelections: string[] = [];

    for (const holiday of selectedHolidays) {
      if (!(holiday in availableHolidaysList)) {
        invalidSelections.push(holiday);
      }
    }
    setSelectedHolidays((prev) =>
      prev.filter((holiday) => holiday in invalidSelections)
    );
  }, [startDate, endDate]);

  function resetTag(tagName: String) {
    // Reset the values stored in a "tag"
    // Then switch to that tag's view to give
    //  the user the options to set them again
    switch (tagName) {
      case "daily":
        setStartDate(getDefaultStartDate());
        setEndDate(new Date());
        break;

      case "hourly":
        setDayHours([0, 24]);
        break;
      case "weekly":
        setWeekdays([]);
        break;
      case "monthly":
        setMonthDays([]);
        break;
      case "yearly":
        setSelectedHolidays([]);
        setMonthWeek("");
        setMonthWeekday("");
        break;
      default:
        return;
    }
    // setRecurrenceType(`${tagName}`);
  }

  function getHourlyPreviewString() {
    if (dayHours[0] === 0 && dayHours[1] === 24) return "All hours of each day";
    else
      return `From ${valueLabelFormat(dayHours[0])} to ${valueLabelFormat(
        dayHours[1]
      )} each day`;
  }

  function getWeekdayPreviewString() {
    function getWeekdays() {
      if (weekdays.length == 1) return weekdays[0];
      if (weekdays.length == 7) return "Every day";
      if (
        weekdays.length == 5 &&
        weekdays.includes("Mon") &&
        weekdays.includes("Tue") &&
        weekdays.includes("Wed") &&
        weekdays.includes("Thu") &&
        weekdays.includes("Fri")
      )
        return "Weekdays";

      if (
        weekdays.length == 2 &&
        weekdays.includes("Sat") &&
        weekdays.includes("Sun")
      )
        return "Weekends";

      return `${weekdays.slice(0, weekdays.length - 1).join(", ")} and ${
        weekdays[weekdays.length - 1]
      }`;
    }

    if (weekdays.length > 0) {
      return `${getWeekdays()} each week`;
    }
    return;
  }

  function getMonthlyPreviewString() {
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

      if (days.length == 1) return days[0];
      else
        return `${days.slice(0, days.length - 1).join(", ")} and ${
          days[days.length - 1]
        }`;
    }

    if (monthDays.length > 0) {
      // let content = weekdays.length > 0 ? "Along with " : "";
      let content = "";
      if (monthDays.length <= 3) {
        content += `${
          content === "" ? "T" : "t"
        }he ${getMonthDays()} of each month`;
      } else {
        content += `${monthDays.length} selected days of the month`;
      }
      return content;
    }
    return;
  }

  function getYearlyPreviewString() {
    function getHolidayString() {
      const selection: String[] = [];

      for (const day of selectedHolidays) {
        let name = "";
        for (const holiday of holidays) {
          if (holiday.id === day) {
            name = holiday.name;
            break;
          }
        }
        if (name) selection.push(name);
      }

      return `${selection.slice(0, selection.length - 1).join(", ")}${
        selection.length > 1 ? " and " : ""
      }${selection[selection.length - 1]}`;
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
    return content;
  }

  const generatePreview = () => {
    // Create the preview tags to be displayed in the component
    const tagList = [];
    let tagContent;

    // Add hour selection tag
    tagContent = getHourlyPreviewString();
    if (tagContent) {
      tagList.push(
        <Tag
          key="hourly"
          value="hourly"
          content={tagContent}
          deleteCallback={resetTag}
        />
      );
    }

    // Add weekday selection tag
    tagContent = getWeekdayPreviewString();
    if (tagContent) {
      tagList.push(
        <Tag
          key="weekly"
          value="weekly"
          content={tagContent}
          deleteCallback={resetTag}
        />
      );
    }

    // Add monthly selection tag
    tagContent = getMonthlyPreviewString();
    if (tagContent) {
      tagList.push(
        <Tag
          key="monthly"
          value="monthly"
          content={tagContent}
          deleteCallback={resetTag}
        />
      );
    }

    // Add yearly selection tag
    tagContent = getYearlyPreviewString();
    if (tagContent) {
      tagList.push(
        <Tag
          key="yearly"
          value="yearly"
          content={tagContent}
          deleteCallback={resetTag}
        />
      );
    }

    return (
      <div
        className="text-xs"
        style={{
          display: "flex",
          flexFlow: "row wrap",
        }}
      >
        {tagList.map((tag) => tag)}
      </div>
    );
  };

  function isPreviewable() {
    return (
      !(dayHours[0] === 0 && dayHours[1] === 24) ||
      weekdays.length > 0 ||
      monthDays.length > 0 ||
      selectedHolidays.length > 0 ||
      (monthWeekday && monthWeek)
    );
  }

  // TODO: get total day count

  useEffect(() => {
    setPreview(generatePreview());
  }, [
    dayHours,
    weekdays,
    monthDays,
    monthWeek,
    monthWeekday,
    startDate,
    endDate,
    selectedHolidays,
  ]);

  const handleApply = () => {
    const json = generateJSON();
    setJsonOutput(json);
    // setOpen(false); // Close the popover
  };

  const [expanded, setExpanded] = useState(false);

  const [headerText, setHeaderText] = useState(
    <div>
      <Typography>
        Click to Add Custom Days or Hours within Selected Range​
      </Typography>
    </div>
  );

  const handleExpansion = () => {
    setExpanded((prevExpanded) => !prevExpanded);
  };

  function getOverallHeaderText() {
    return expanded ? (
      <Typography>
        Editing Custom Days or Hours within Selected Range
      </Typography>
    ) : isPreviewable() ? (
      <div>
        <Typography>Only Showing</Typography>
        <div
          className="p-2 bg-gray-100 rounded-md"
          onClick={(event) => {
            console.log(event);
            event.stopPropagation();
          }}
        >
          {preview}
        </div>
      </div>
    ) : (
      <Typography>
        Click to Add Custom Days or Hours within Selected Range
      </Typography>
    );
  }

  useEffect(() => {
    setHeaderText(getOverallHeaderText());
  }, [expanded, preview]);

  return (
    <div
      className={
        "rounded-md border bg-popover p-1 shadow-md outline-none w-[750px] flex flex-col"
      }
    >
      <div className="flex flex-col max-h-full overflow-y-auto">
        <CardHeader className="px-4 py-2 border-b">
          <CardTitle className="text-base">Date Options</CardTitle>

          {/* Date Range Selector */}
          <div className="grid grid-cols-2 gap-1">
            <div className="space-y-0 flex items-center space-x-4">
              <div className="space-y-0 flex items-center gap-1">
                <Label className="text-base">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={`w-full justify-start text-left font-normal h-8 text-sm`}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {format(startDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      startMonth={earliestDate}
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
                      variant={"outline"}
                      className={`w-full justify-start text-left font-normal h-8 text-sm ${
                        !endDate && "text-muted-foreground"
                      }`}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {endDate ? (
                        format(endDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      startMonth={startDate}
                      selected={endDate}
                      onSelect={handleEndDateChange}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Accordion expanded={expanded} onChange={handleExpansion}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel1-content"
              id="panel1-header"
            >
              <Typography component="span">
                {/* Preview Options */}
                {headerText}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {/* Add date selection options here */}

              {/* Hourly */}
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography
                    component="span"
                    sx={{ width: "33%", flexShrink: 0 }}
                  >
                    Hours of Day
                  </Typography>
                  <Typography component="span" sx={{ color: "text.secondary" }}>
                    {getHourlyPreviewString()}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {/* Hourly setting options here! */}
                  <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                    <HourSelector
                      dayHours={dayHours}
                      setDayHours={handleHourChange}
                    />
                  </div>
                </AccordionDetails>
              </Accordion>

              {/* Weekly */}
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography
                    component="span"
                    sx={{ width: "33%", flexShrink: 0 }}
                  >
                    Days of Week
                  </Typography>
                  <Typography component="span" sx={{ color: "text.secondary" }}>
                    {getWeekdayPreviewString()}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                    <Label className="text-sm">Repeat on</Label>
                    <div className="flex flex-wrap gap-1">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                        (day) => (
                          <Button
                            key={day}
                            variant={
                              weekdays.includes(day) ? "default" : "outline"
                            }
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
                </AccordionDetails>
              </Accordion>

              {/* Monthly */}
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography
                    component="span"
                    sx={{ width: "33%", flexShrink: 0 }}
                  >
                    Days of Month
                  </Typography>
                  <Typography component="span" sx={{ color: "text.secondary" }}>
                    {getMonthlyPreviewString()}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div className="p-3 border rounded-md bg-gray-50 space-y-1">
                    <Label className="text-sm">Days of the month</Label>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 31 }, (_, i) => {
                        const day = (i + 1).toString();
                        return (
                          <Button
                            key={day}
                            variant={
                              monthDays.includes(day) ? "default" : "outline"
                            }
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
                        variant={
                          monthDays.includes("last") ? "default" : "outline"
                        }
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
                </AccordionDetails>
              </Accordion>

              {/* Yearly / Holidays */}
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography
                    component="span"
                    sx={{ width: "33%", flexShrink: 0 }}
                  >
                    Days of Year & Holidays
                  </Typography>
                  <Typography component="span" sx={{ color: "text.secondary" }}>
                    {getYearlyPreviewString()}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Select holidays</Label>
                      <div className="max-h-40 overflow-y-auto border rounded-md p-2 bg-white">
                        <HolidaySelector
                          allHolidays={holidays}
                          availableHolidays={availableHolidaysList}
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
                            {[
                              "-",
                              "first",
                              "second",
                              "third",
                              "fourth",
                              "last",
                            ].map((week) => (
                              <SelectItem key={week} value={week}>
                                {week}
                              </SelectItem>
                            ))}
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
                            <SelectValue placeholder="Position in Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "-",
                              "monday",
                              "tuesday",
                              "wednesday",
                              "thursday",
                              "friday",
                              "saturday",
                              "sunday",
                            ].map((week) => (
                              <SelectItem key={week} value={week}>
                                {week}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </AccordionDetails>
              </Accordion>
            </AccordionDetails>
          </Accordion>
        </CardContent>

        <div className="px-4 py-2 border-t">
          <Button onClick={handleApply} className="w-full h-8 text-sm">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}