import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface HourSelectorProps {
  dayHours: number[];
  setDayHours: (hours: number[]) => void;
}

export function HourSelector({ dayHours, setDayHours }: HourSelectorProps) {
  const [value, setValue] = useState<number[]>(dayHours);

  useEffect(() => {
    setValue(dayHours);
  }, [dayHours]);

  const handleValueChange = (newValue: number[]) => {
    setValue(newValue);
    setDayHours(newValue);
  };

  const formatHour = (hour: number) => {
    if (hour === 0 || hour === 24) return "12 AM";
    if (hour === 12) return "12 PM";
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="text-sm">Hours: {formatHour(value[0])} - {formatHour(value[1])}</Label>
        </div>
        <div className="py-4">
          <Slider
            defaultValue={value}
            value={value}
            onValueChange={handleValueChange}
            min={0}
            max={24}
            step={1}
          />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>12 AM</span>
          </div>
        </div>
      </div>
    </div>
  );
}
