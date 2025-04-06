"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { fetchAttributeFilterValues } from "@/services/api"

interface AttributeRangeFilterProps {
  attributeName: string;
  attributeColumnName: string;
  tableName: string;
  onFilterChange: (columnName: string, values: string[]) => void;
  selectedValues?: string[];
}

export function AttributeRangeFilter({
  attributeName,
  attributeColumnName,
  tableName,
  onFilterChange,
  selectedValues = []
}: AttributeRangeFilterProps) {
  const [availableValues, setAvailableValues] = useState<number[]>([]);
  const [minValue, setMinValue] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(100);
  const [currentRange, setCurrentRange] = useState<[number, number]>([0, 100]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available values for this attribute
  useEffect(() => {
    const fetchValues = async () => {
      setIsLoading(true);
      try {
        const values = await fetchAttributeFilterValues(tableName, [attributeColumnName]);
        if (values && values[attributeColumnName]) {
          // Convert string values to numbers and sort
          const numericValues = values[attributeColumnName]
            .map(val => parseInt(val, 10))
            .filter(val => !isNaN(val))
            .sort((a, b) => a - b);
          
          setAvailableValues(numericValues);
          
          // Set min and max values
          if (numericValues.length > 0) {
            const min = numericValues[0];
            const max = numericValues[numericValues.length - 1];
            setMinValue(min);
            setMaxValue(max);
            
            // Initialize range based on selected values or default to full range
            if (selectedValues && selectedValues.length > 0) {
              const selectedNums = selectedValues
                .map(val => parseInt(val, 10))
                .filter(val => !isNaN(val));
              
              if (selectedNums.length > 0) {
                const selectedMin = Math.min(...selectedNums);
                const selectedMax = Math.max(...selectedNums);
                setCurrentRange([
                  Math.max(selectedMin, min),
                  Math.min(selectedMax, max)
                ]);
              } else {
                setCurrentRange([min, max]);
              }
            } else {
              setCurrentRange([min, max]);
            }
          }
          
          setError(null);
        } else {
          setError("No values found for this attribute");
          setAvailableValues([]);
        }
      } catch (err) {
        setError("Failed to fetch attribute values");
        console.error(err);
        setAvailableValues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchValues();
  }, [tableName, attributeColumnName]);

  // Update selected values when range changes, but only when user interaction changes the range
  // This prevents infinite loops by not updating on every render
  const [prevRange, setPrevRange] = useState<[number, number] | null>(null);
  
  useEffect(() => {
    // Skip the initial setup or when loading
    if (isLoading || availableValues.length === 0) return;
    
    // Only update if this is the first time or if the range has actually changed from user interaction
    if (prevRange === null || 
        (prevRange[0] !== currentRange[0] || prevRange[1] !== currentRange[1])) {
      
      // Find all values within the current range
      const valuesInRange = availableValues.filter(
        value => value >= currentRange[0] && value <= currentRange[1]
      );
      
      // Convert back to strings for the filter
      const stringValues = valuesInRange.map(val => val.toString());
      
      // Update the filter
      onFilterChange(attributeColumnName, stringValues);
      
      // Remember this range to compare against future changes
      setPrevRange(currentRange);
    }
  }, [currentRange, availableValues, attributeColumnName, onFilterChange, isLoading, prevRange]);

  const handleSliderChange = (value: number[]) => {
    if (value.length >= 2) {
      setCurrentRange([value[0], value[1]]);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-xl text-left">
      <Label className="font-medium">{attributeName}</Label>
      
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
          Loading values...
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      ) : (
        <div className="space-y-8 pt-1 px-2">
          {/* Custom slider styling with two thumbs */}
          <div className="w-[60%] px-1">
            <Slider
              defaultValue={currentRange}
              value={currentRange}
              min={minValue}
              max={maxValue}
              step={1}
              onValueChange={handleSliderChange}
              className="mt-2 mb-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-2 mt-0">
              <div>{minValue}</div>
              <div>{maxValue}</div>
            </div>
          </div>
          
          {/* <div className="flex justify-between items-center px-2">
            <div className="bg-gray-50 rounded-md px-3 py-2 border">
              <span className="text-sm font-medium text-gray-700">Min: </span>
              <span className="text-sm font-semibold">{currentRange[0]}</span>
            </div>
            <div className="bg-gray-50 rounded-md px-3 py-2 border">
              <span className="text-sm font-medium text-gray-700">Max: </span>
              <span className="text-sm font-semibold">{currentRange[1]}</span>
            </div>
          </div> */}
          

        </div>
      )}
    </div>
  );
}
