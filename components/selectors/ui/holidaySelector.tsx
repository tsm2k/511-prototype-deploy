import React from "react";
import { Button } from "@/components/ui/button";
import { Holiday } from "../timeline-selector";

interface HolidaySelectorProps {
  allHolidays: Holiday[];
  availableHolidays: (Holiday & { isAvailable?: boolean })[];
  selectedHolidays: string[];
  callback: (holidays: string[]) => void;
}

export function HolidaySelector({
  allHolidays,
  availableHolidays,
  selectedHolidays,
  callback,
}: HolidaySelectorProps) {
  const toggleHoliday = (holidayId: string, isAvailable: boolean) => {
    // Only allow toggling available holidays
    if (!isAvailable) return;
    
    if (selectedHolidays.includes(holidayId)) {
      callback(selectedHolidays.filter((id) => id !== holidayId));
    } else {
      callback([...selectedHolidays, holidayId]);
    }
  };

  return (
    <div className="space-y-1">
      {availableHolidays.map((holiday) => {
        const isAvailable = holiday.isAvailable !== false; // Default to true if not specified
        
        return (
          <div key={holiday.id} className="flex items-center">
            <Button
              variant={selectedHolidays.includes(holiday.id) ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs w-full justify-start ${!isAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => toggleHoliday(holiday.id, isAvailable)}
              disabled={!isAvailable}
            >
              {holiday.name}
              {!isAvailable && " (outside range)"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
