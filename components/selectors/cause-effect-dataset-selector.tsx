"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { AlertCircle, X, Filter as FilterIcon, ChevronUp, ChevronDown, GripVertical, Settings, Clock, MapPin, Check } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import DatasetAttributeFilters from "./dataset-attribute-filters"

// Define dataset categorization
const datasetCategories = {
  cause: [
    { value: 'social_events', label: 'Social Events (Ticketmaster)', description: 'Planned social gatherings affecting traffic' },
    { value: 'traffic_events', label: 'Traffic Events (511)', description: 'Traffic incidents and events' },
    { value: 'rest_area_info', label: 'Rest Areas (511)', description: 'Locations and details of highway rest areas' },
    { value: 'dynamic_message_sign_info', label: 'Dynamic Message Signs (511)', description: 'Dynamic message signs data' },
    { value: 'traffic_parking_info', label: 'Truck Parking Information (511)', description: 'Truck parking Information Management System data' },
    { value: 'variable_speed_limit_sign_info', label: 'Variable Speed Limit Signs (511)', description: 'Variable Speed Limit Signs data' },
    { value: 'weather_info', label: 'Road Weather Information System (511)', description: 'Road Weather Information System data' },
    { value: 'travel_time_system_info', label: 'Travel Time System (511)', description: 'Travel Time System data' }


  ],
  effect: [
    { value: 'lane_blockage_info', label: 'Lane Blockages (511)', description: 'Information about lane closures and blockages' },
    { value: 'traffic_speed_info', label: 'Traffic Speed (511)', description: 'Traffic Speed data' }
  ],
  both: [
  ]
};

// Get all available datasets
const getAllDatasets = () => {
  const allDatasets = [
    ...datasetCategories.cause,
    ...datasetCategories.effect
  ];
  
  // Remove duplicates (if any)
  return allDatasets.filter((dataset, index, self) => 
    index === self.findIndex((d) => d.value === dataset.value)
  );
};

interface CauseEffectDatasetSelectorProps {
  filterId: string;
  selectedDatasets: string[];
  onDatasetChange: (datasets: string[]) => void;
  attributeFilters: Record<string, Record<string, string[]>>;
  timeframeSelections?: any[];
  onFilterChange: (datasetId: string, attributeName: string, values: string[]) => void;
}

interface EffectSettings {
  timeExpansion: number; // in minutes
  locationRadius: number; // in miles
  radiusUnit: 'miles' | 'km';
}

export function CauseEffectDatasetSelector({
  filterId,
  selectedDatasets,
  onDatasetChange,
  attributeFilters,
  timeframeSelections = [],
  onFilterChange
}: CauseEffectDatasetSelectorProps) {
  // State for tracking which datasets have filters applied
  const [datasetsWithFilters, setDatasetsWithFilters] = useState<Record<string, boolean>>({});
  
  // State for tracking which dataset's filters are being shown
  const [activeFilterDataset, setActiveFilterDataset] = useState<string | null>(null);
  
  // State for tracking which sections are collapsed
  const [collapsedSections, setCollapsedSections] = useState<{
    cause: boolean;
    effect: boolean;
  }>({ cause: true, effect: true });
  
  // Track which datasets are selected in each category
  const [categorySelections, setCategorySelections] = useState<{
    cause: string[];
    effect: string[];
  }>({ cause: [], effect: [] });
  
  // State for effect settings
  const [effectSettings, setEffectSettings] = useState<EffectSettings>({
    timeExpansion: 30, // default 30 minutes
    locationRadius: 5, // default 5 miles
    radiusUnit: 'miles'
  });
  
  // State for settings popover
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Initialize category selections based on selectedDatasets
  useEffect(() => {
    const cause: string[] = [];
    const effect: string[] = [];
    
    selectedDatasets.forEach(datasetId => {
      // Check if dataset is in cause category
      if (datasetCategories.cause.some(d => d.value === datasetId)) {
        cause.push(datasetId);
      }
      
      // Check if dataset is in effect category
      if (datasetCategories.effect.some(d => d.value === datasetId)) {
        effect.push(datasetId);
      }
    });
    
    setCategorySelections({ cause, effect });
  }, []);

  // Helper function to check if a dataset has filters applied
  const hasFilters = (datasetId: string) => {
    if (!attributeFilters[datasetId]) return false;
    
    // Check if any attribute has filters applied
    return Object.values(attributeFilters[datasetId]).some(values => values.length > 0);
  };

  // Update the datasetsWithFilters state when attributeFilters changes
  useEffect(() => {
    const newDatasetsWithFilters: Record<string, boolean> = {};
    
    getAllDatasets().forEach(dataset => {
      newDatasetsWithFilters[dataset.value] = hasFilters(dataset.value);
    });
    
    setDatasetsWithFilters(newDatasetsWithFilters);
  }, [attributeFilters]);

  // Toggle dataset selection
  const toggleDataset = (datasetId: string, category: 'cause' | 'effect') => {
    // Check if dataset is already selected
    const isSelected = categorySelections[category].includes(datasetId);
    
    // Create new category selections
    const newCategorySelections = { ...categorySelections };
    
    if (isSelected) {
      // Remove from this category
      newCategorySelections[category] = newCategorySelections[category].filter(id => id !== datasetId);
    } else {
      // Add to this category
      newCategorySelections[category] = [...newCategorySelections[category], datasetId];
      
      // If this is a dataset from the 'both' category, we need to remove it from the other category
      const otherCategory = category === 'cause' ? 'effect' : 'cause';
      // if (datasetCategories.both.some(d => d.value === datasetId) && 
      //     newCategorySelections[otherCategory].includes(datasetId)) {
      //   newCategorySelections[otherCategory] = newCategorySelections[otherCategory].filter(id => id !== datasetId);
      // }
    }
    
    // Update category selections state
    setCategorySelections(newCategorySelections);
    
    // Combine both category selections for the overall selected datasets
    const newSelectedDatasets = Array.from(new Set([...newCategorySelections.cause, ...newCategorySelections.effect]));
    onDatasetChange(newSelectedDatasets);
    
    // If we're removing the dataset that has active filters, close the filter panel
    if (activeFilterDataset === datasetId && !newSelectedDatasets.includes(datasetId)) {
      setActiveFilterDataset(null);
    }
    
    // If we're selecting a dataset, automatically open its filter panel
    if (!isSelected && newSelectedDatasets.includes(datasetId)) {
      setActiveFilterDataset(datasetId);
    }
  };

  // Toggle filter panel for a dataset
  const toggleFilterPanel = (datasetId: string) => {
    setActiveFilterDataset(activeFilterDataset === datasetId ? null : datasetId);
  };

  // Toggle section collapse state
  const toggleSectionCollapse = (section: 'cause' | 'effect') => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Check if a dataset is selected in the other category
  const isSelectedInOtherCategory = (datasetId: string, currentCategory: 'cause' | 'effect') => {
    const otherCategory = currentCategory === 'cause' ? 'effect' : 'cause';
    return categorySelections[otherCategory].includes(datasetId);
  };

  // Render a dataset item
  const renderDatasetItem = (dataset: { value: string; label: string; description: string }, category: 'cause' | 'effect') => {
    const isSelected = categorySelections[category].includes(dataset.value);
    const hasAppliedFilters = datasetsWithFilters[dataset.value];
    const isDisabled = isSelectedInOtherCategory(dataset.value, category);
    
    return (
      <div 
        key={dataset.value}
        className={cn(
          "p-2 border rounded-md mb-1 transition-colors",
          isSelected ? "border-blue-300 bg-white shadow-sm" : 
          isDisabled ? "border-gray-200 bg-gray-50 opacity-60" : 
          "border-gray-200 hover:border-blue-200 hover:bg-white"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
              isSelected ? "border-blue-500 bg-blue-100" : "border-gray-300",
              isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            )} 
              onClick={() => !isDisabled && toggleDataset(dataset.value, category)}
            >
              <Checkbox 
                checked={isSelected}
                onCheckedChange={() => toggleDataset(dataset.value, category)}
                id={`dataset-${filterId}-${category}-${dataset.value}`}
                disabled={isDisabled}
                className={cn(
                  "h-4 w-4",
                  isSelected ? "border-blue-500 text-blue-500 data-[state=checked]:bg-blue-500" : ""
                )}
              />
            </div>
            <div className="flex-1">
              <Label 
                htmlFor={`dataset-${filterId}-${category}-${dataset.value}`}
                className={cn(
                  "font-medium cursor-pointer select-none",
                  isSelected ? "text-blue-700" : 
                  isDisabled ? "text-gray-400" : 
                  "text-gray-700"
                )}
              >
                {dataset.label}
                {isDisabled && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Selected in {category === 'cause' ? 'Effect' : 'Cause'}
                  </Badge>
                )}
              </Label>
              {dataset.description && (
                <p className={cn(
                  "text-xs mt-1",
                  isDisabled ? "text-gray-400" : "text-gray-500"
                )}>
                  {dataset.description}
                </p>
              )}
            </div>
          </div>
          
          {isSelected && (
            <Button
              variant={hasAppliedFilters ? "ghost" : "outline"}
              size="sm"
              className={cn(
                "ml-2 gap-1",
                hasAppliedFilters ? "bg-blue-200" : ""
              )}
              onClick={() => toggleFilterPanel(dataset.value)}
            >
              {hasAppliedFilters ? (
                <>
                <ChevronDown className="h-3 w-3" />
                  {/* <FilterIcon className="h-3 w-3 mr-1" /> */}
                  {/* <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge> */}
                </>
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        
        {isSelected && activeFilterDataset === dataset.value && (
          <div className="mt-2 border-t">
            <DatasetAttributeFilters
              selectedDatasets={[dataset.value]}
              selectedFilters={attributeFilters}
              onFilterChange={onFilterChange}
              timeframeSelections={timeframeSelections}
              activeDataset={dataset.value}
            />
          </div>
        )}
      </div>
    );
  };

  // Handle settings change
  const handleSettingsChange = (key: keyof EffectSettings, value: any) => {
    setEffectSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Render the settings panel for Effect side
  const renderEffectSettings = () => {
    return (
      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        {/* <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={(e) => {
              // Stop propagation to prevent the card from collapsing
              e.stopPropagation();
            }}
          >
            <Settings className="h-4 w-4 mr-1" />
            Settings (In progress)
          </Button>
        </PopoverTrigger> */}
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Effect Analysis Settings</h4>
            
            {/* Time Range Expansion */}
            {/* <div className="space-y-2">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-blue-500" />
                <h5 className="text-sm font-medium">Expand Time Range</h5>
              </div>
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="time-expansion" className="text-xs">Expand by:</Label>
                  <div className="flex-1">
                    <Input 
                      id="time-expansion"
                      type="number" 
                      min={0} 
                      max={240}
                      value={effectSettings.timeExpansion} 
                      onChange={(e) => handleSettingsChange('timeExpansion', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <span className="text-xs">minutes</span>
                </div>
                <p className="text-xs text-gray-500">Applied equally before and after selected time</p>
                <div className="pt-1">
                  <Slider
                    value={[effectSettings.timeExpansion]}
                    min={0}
                    max={240}
                    step={5}
                    onValueChange={(value) => handleSettingsChange('timeExpansion', value[0])}
                  />
                </div>
              </div>
            </div> */}
            
            {/* Location Radius Expansion */}
            {/* <div className="space-y-2">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                <h5 className="text-sm font-medium">Expand Location Radius</h5>
              </div>
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="location-radius" className="text-xs">Radius:</Label>
                  <div className="flex-1">
                    <Input 
                      id="location-radius"
                      type="number" 
                      min={0.1} 
                      max={50}
                      step={0.1}
                      value={effectSettings.locationRadius} 
                      onChange={(e) => handleSettingsChange('locationRadius', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <RadioGroup 
                    value={effectSettings.radiusUnit} 
                    onValueChange={(value) => handleSettingsChange('radiusUnit', value as 'miles' | 'km')}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="miles" id="miles" className="h-3 w-3" />
                      <Label htmlFor="miles" className="text-xs">miles</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="km" id="km" className="h-3 w-3" />
                      <Label htmlFor="km" className="text-xs">km</Label>
                    </div>
                  </RadioGroup>
                </div>
                <p className="text-xs text-gray-500">Around selected points</p>
                <div className="pt-1">
                  <Slider
                    value={[effectSettings.locationRadius]}
                    min={0.1}
                    max={50}
                    step={0.1}
                    onValueChange={(value) => handleSettingsChange('locationRadius', value[0])}
                  />
                </div>
              </div>
            </div> */}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Render a category section
  const renderCategorySection = (title: string, category: 'cause' | 'effect') => {
    const datasets = [
      ...datasetCategories[category],
      ...datasetCategories.both
    ];
    
    // Count selected datasets in this category
    const selectedCount = categorySelections[category].length;
    const isCollapsed = collapsedSections[category];
    
    return (
      <div className="flex flex-col border rounded-md mb-4">
        <div 
          className="flex items-center justify-between p-3 bg-gray-100 rounded-t-md cursor-pointer hover:bg-gray-200 transition-colors"
          onClick={() => toggleSectionCollapse(category)}
        >
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{title}</h3>
            {selectedCount > 0 && (
              <Badge variant="secondary">
                {selectedCount} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {category === 'effect' && !isCollapsed && renderEffectSettings()}
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="p-3 border-t">
            <div className="max-h-[300px] overflow-y-auto">
              {datasets.map(dataset => renderDatasetItem(dataset, category))}
            </div>
            
            {/* Show effect settings summary if any are set */}
            {/* {category === 'effect' && (effectSettings.timeExpansion > 0 || effectSettings.locationRadius > 0) && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs">
                <div className="flex flex-wrap gap-2">
                  {effectSettings.timeExpansion > 0 && (
                    <Badge variant="outline" className="bg-white">
                      <Clock className="h-3 w-3 mr-1" />
                      Time +{effectSettings.timeExpansion} min
                    </Badge>
                  )}
                  {effectSettings.locationRadius > 0 && (
                    <Badge variant="outline" className="bg-white">
                      <MapPin className="h-3 w-3 mr-1" />
                      Radius +{effectSettings.locationRadius} {effectSettings.radiusUnit}   
                    </Badge>
                    
                  )}
                    <Badge variant="outline" className="bg-yellow-100">
                      Not Functional  
                    </Badge>
                </div>
              </div>
            )} */}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 w-full max-w-[95vw]">
      {/* Vertically stacked sections */}
      <div className="space-y-2 w-full">
        {renderCategorySection("Cause Datasets", "cause")}
        {renderCategorySection("Effect Datasets", "effect")}
      </div>
    </div>
  );
}

export default CauseEffectDatasetSelector;
