"use client"

import { useState, useEffect } from "react"
import { Search, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { fetchAttributeFilterValues } from "@/services/api"

interface AttributeFilterProps {
  attributeName?: string;
  attributeColumnName: string;
  tableName: string;
  onFilterChange: (columnName: string, values: string[]) => void;
  selectedValues?: string[];
}

// Helper function to determine appropriate height based on number of values
function getScrollAreaHeight(valueCount: number): string {
  if (valueCount <= 2) return 'h-[80px]';
  if (valueCount <= 4) return 'h-[120px]';
  if (valueCount <= 6) return 'h-[140px]';
  if (valueCount <= 10) return 'h-[180px]';
  return 'h-[200px]';
}

export function AttributeFilter({
  attributeName,
  attributeColumnName,
  tableName,
  onFilterChange,
  selectedValues = []
}: AttributeFilterProps) {
  const [availableValues, setAvailableValues] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(selectedValues);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available values for this attribute
  useEffect(() => {
    const fetchValues = async () => {
      setIsLoading(true);
      try {
        const values = await fetchAttributeFilterValues(tableName, [attributeColumnName]);
        if (values && values[attributeColumnName]) {
          setAvailableValues(values[attributeColumnName]);
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

  // Sync with parent component's selectedValues
  useEffect(() => {
    setSelected(selectedValues);
  }, [selectedValues]);
  
  // Update parent component when selection changes, but only if it's initiated from this component
  const updateParent = (newSelection: string[]) => {
    setSelected(newSelection);
    onFilterChange(attributeColumnName, newSelection);
  };

  // Filter values based on search query
  const filteredValues = availableValues.filter(value => 
    value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle select/deselect all
  const handleSelectAll = () => {
    updateParent(availableValues); // Select ALL values, not just filtered ones
  };

  const handleDeselectAll = () => {
    updateParent([]);
  };
  
  // Determine if all values are selected
  const allSelected = availableValues.length > 0 && 
    availableValues.every(value => selected.includes(value));

  // Handle individual checkbox change
  const handleCheckboxChange = (value: string) => {
    const newSelection = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    updateParent(newSelection);
  };

  // Check if this is a small attribute set (few options)
  const isSmallAttributeSet = !isLoading && !error && availableValues.length <= 5;
  
  // Check if this is a very small set (2-3 options) where we don't need a Select All button
  const isVerySmallSet = !isLoading && !error && availableValues.length <= 3;
  
  // Check if this is a boolean attribute (only has true/false values)
  const isBooleanAttribute = !isLoading && !error && 
    availableValues.length <= 2 && 
    availableValues.every(value => value.toLowerCase() === 'true' || value.toLowerCase() === 'false');

  // Render a compact filter if it's a boolean or small attribute set
  if (isBooleanAttribute || isSmallAttributeSet) {
    return (
      <div className="space-y-2 w-full">
        {attributeName && <Label className="font-medium">{attributeName}</Label>}
        
        {!isVerySmallSet && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1 text-xs h-8"
              onClick={allSelected ? handleDeselectAll : handleSelectAll}
            >
              {allSelected ? (
                <>
                  <X className="h-3 w-3" /> Deselect All
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" /> Select All
                </>
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="p-2 text-center text-muted-foreground bg-gray-50 border rounded-md">
            Loading...
          </div>
        ) : error ? (
          <div className="p-2 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 w-full">
            {availableValues.map((value) => (
              <div key={value} className="flex items-center">
                <Checkbox
                  id={`${attributeColumnName}-${value}`}
                  checked={selected.includes(value)}
                  onCheckedChange={() => handleCheckboxChange(value)}
                  className="mr-2"
                />
                <label
                  htmlFor={`${attributeColumnName}-${value}`}
                  className="text-sm truncate"
                >
                  {value}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Standard filter for non-boolean attributes
  return (
    <div className="space-y-2 w-full flex-grow">
      {attributeName && <Label className="font-medium">{attributeName}</Label>}
      
      {/* Search and Select/Deselect All */}
      <div className="space-y-2 w-full">
        <div className="relative w-full">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find..."
            className="pl-8 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {!isVerySmallSet && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1 text-xs h-8"
              onClick={allSelected ? handleDeselectAll : handleSelectAll}
            >
              {allSelected ? (
                <>
                  <X className="h-3 w-3" /> Deselect All
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" /> Select All
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Values List */}
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground bg-gray-50 border rounded-md">
          Loading values...
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      ) : (
        <ScrollArea className={`${getScrollAreaHeight(filteredValues.length)} border rounded-md p-2 w-full`}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
            {filteredValues.length === 0 ? (
              <div className="p-2 text-center text-muted-foreground col-span-2">
                No values match your search
              </div>
            ) : (
              filteredValues.map((value) => (
                <div key={value} className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id={`${attributeColumnName}-${value}`}
                    checked={selected.includes(value)}
                    onCheckedChange={() => handleCheckboxChange(value)}
                  />
                  <label
                    htmlFor={`${attributeColumnName}-${value}`}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                  >
                    {value}
                  </label>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
