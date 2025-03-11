"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Command, CommandList, CommandGroup, CommandItem } from '../ui/command';
import { Check } from 'lucide-react';
import { InfoTooltip } from "../ui/info-tooltip";

// Sort car events in the specified order
const carEvents = [
  "CONSTRUCTION",
  "MAINTENANCE",
  "TRAFFIC HAZARD",
  "DEBRIS IN THE ROAD",
  "HEAVY TRAFFIC",
  "STALLED VEHICLE",
  "CRASH FATAL",
  "CRASH PD",
  "CRASH PI",
  "CRASH SITE CLEANUP",
  "HIGH WATER",
  "LOCAL EVENT",
  "MEDICAL EMERGENCY",
  "SLIDE OFF",
  "SUPERLOAD",
  "VEHICLE FIRE",
  "FIRE"
]

const eventStatuses = ["NORMAL", "COMPLETED"]
const priorities = ["1", "2", "3", "4", "5", "6", "7", "8"]

// Lane blockage types based on the cars-event-feed.json structure
const blockTypes = ["SLOW", "CLOSED", "N/A"]

// Lane blockage options for filtering
const laneBlockageOptions = {
  // Primary filters
  blockType: blockTypes,
  allLanesAffected: ["Positive Direction", "Negative Direction"],
  lanesAffected: {
    positive: Array.from({ length: 7 }, (_, i) => i + 1),
    negative: Array.from({ length: 7 }, (_, i) => i + 1),
  },
  
  // Additional filters (shoulders and ramps)
  additionalFilters: {
    negative_exit_ramp_affected: [true, false],
    negative_entrance_ramp_affected: [true, false],
    positive_exit_ramp_affected: [true, false],
    positive_entrance_ramp_affected: [true, false],
    negative_inside_shoulder_affected: [true, false],
    negative_outside_shoulder_affected: [true, false],
    positive_inside_shoulder_affected: [true, false],
    positive_outside_shoulder_affected: [true, false],
  }
}

const restAreaOptions = {
  capacity: ["Small (0-50)", "Medium (51-150)", "Large (151-300)", "Very Large (301-500)"],
  spacesAvailable: ["Small (0-50)", "Medium (51-150)", "Large (151-300)", "Very Large (301-500)"],
  siteAreaStatus: ["Open", "Closed"],
  amenities: ["Handicap Accessible", "Restroom Facilities", "Vending Machines", "Picnic Areas"],
}

export interface LaneBlockageFilter {
  blockType: string[]
  allLanesAffected: string[]
  lanesAffected: {
    positive: number[]
    negative: number[]
  }
  additionalFilters: {
    negative_exit_ramp_affected: boolean[]
    negative_entrance_ramp_affected: boolean[]
    positive_exit_ramp_affected: boolean[]
    positive_entrance_ramp_affected: boolean[]
    negative_inside_shoulder_affected: boolean[]
    negative_outside_shoulder_affected: boolean[]
    positive_inside_shoulder_affected: boolean[]
    positive_outside_shoulder_affected: boolean[]
  }
}

export interface RestAreaFilter {
  capacity: string[]
  spacesAvailable: string[]
  siteAreaStatus: string[]
  amenities: string[]
}

export interface DatasetSelectorProps {
  selectedCarEvents: string[]
  setSelectedCarEvents?: (events: string[]) => void
  onSelectedCarEventsChange?: (events: string[]) => void
  
  // Updated Lane Blockages structure
  selectedLaneBlockages: LaneBlockageFilter
  setSelectedLaneBlockages?: (blockages: LaneBlockageFilter) => void
  onSelectedLaneBlockagesChange?: (blockages: LaneBlockageFilter) => void
  
  selectedRestAreaFilters: RestAreaFilter
  setSelectedRestAreaFilters?: (filters: RestAreaFilter) => void
  onSelectedRestAreaFiltersChange?: (filters: RestAreaFilter) => void
  
  selectedPriorities?: string[]
  setSelectedPriorities?: (priorities: string[]) => void
  onSelectedPrioritiesChange?: (priorities: string[]) => void
  
  selectedEventStatuses?: string[]
  setSelectedEventStatuses?: (statuses: string[]) => void
  onSelectedEventStatusesChange?: (statuses: string[]) => void
}

export function DatasetSelector({
  selectedCarEvents,
  setSelectedCarEvents,
  onSelectedCarEventsChange,
  selectedLaneBlockages,
  setSelectedLaneBlockages,
  onSelectedLaneBlockagesChange,
  selectedRestAreaFilters,
  setSelectedRestAreaFilters,
  onSelectedRestAreaFiltersChange,
  selectedPriorities = [],
  setSelectedPriorities,
  onSelectedPrioritiesChange,
  selectedEventStatuses = [],
  setSelectedEventStatuses,
  onSelectedEventStatusesChange,
}: DatasetSelectorProps) {
  // Initialize the Lane Blockages state if it's empty
  useEffect(() => {
    // Check if selectedLaneBlockages is empty or undefined
    if (!selectedLaneBlockages || 
        Object.keys(selectedLaneBlockages).length === 0 ||
        (!selectedLaneBlockages.blockType?.length && 
         !selectedLaneBlockages.allLanesAffected?.length && 
         !selectedLaneBlockages.lanesAffected?.positive?.length && 
         !selectedLaneBlockages.lanesAffected?.negative?.length)) {
      // Initialize with empty arrays for all properties
      setSelectedLaneBlockages?.({ 
        blockType: [],
        allLanesAffected: [],
        lanesAffected: {
          positive: [],
          negative: []
        },
        additionalFilters: {
          negative_exit_ramp_affected: [],
          negative_entrance_ramp_affected: [],
          positive_exit_ramp_affected: [],
          positive_entrance_ramp_affected: [],
          negative_inside_shoulder_affected: [],
          negative_outside_shoulder_affected: [],
          positive_inside_shoulder_affected: [],
          positive_outside_shoulder_affected: []
        }
      });
    }
  }, []);
  const [activeTab, setActiveTab] = useState("car-events")
  const [localSelectedEventStatuses, setLocalSelectedEventStatuses] = useState<string[]>(selectedEventStatuses || [])
  const [localSelectedPriorities, setLocalSelectedPriorities] = useState<string[]>(selectedPriorities || [])

  const toggleAllCarEvents = () => {
    const newCarEvents = selectedCarEvents.length === carEvents.length ? [] : [...carEvents];
    
    if (onSelectedCarEventsChange) {
      onSelectedCarEventsChange?.(newCarEvents);
    } else if (setSelectedCarEvents) {
      setSelectedCarEvents?.(newCarEvents);
    }
  }

  const toggleAllEventStatuses = () => {
    const newEventStatuses = localSelectedEventStatuses.length === eventStatuses.length ? [] : [...eventStatuses];
    
    setLocalSelectedEventStatuses(newEventStatuses);
    
    if (onSelectedEventStatusesChange) {
      onSelectedEventStatusesChange(newEventStatuses);
    } else if (setSelectedEventStatuses) {
      setSelectedEventStatuses?.(newEventStatuses);
    }
  }

  // Lane blockage helper functions
  const toggleBlockTypes = (blockType: string) => {
    const updatedBlockTypes = selectedLaneBlockages.blockType.includes(blockType)
      ? selectedLaneBlockages.blockType.filter(type => type !== blockType)
      : [...selectedLaneBlockages.blockType, blockType];
    
    setSelectedLaneBlockages?.({
      ...selectedLaneBlockages,
      blockType: updatedBlockTypes
    });
  };
  
  const toggleAllLanesDirection = (direction: string) => {
    const updatedAllLanesAffected = selectedLaneBlockages.allLanesAffected.includes(direction)
      ? selectedLaneBlockages.allLanesAffected.filter(dir => dir !== direction)
      : [...selectedLaneBlockages.allLanesAffected, direction];
    
    setSelectedLaneBlockages?.({
      ...selectedLaneBlockages,
      allLanesAffected: updatedAllLanesAffected
    });
  };
  
  const toggleLaneNumber = (direction: 'positive' | 'negative', laneNumber: number) => {
    const currentLanes = selectedLaneBlockages.lanesAffected[direction];
    const updatedLanes = currentLanes.includes(laneNumber)
      ? currentLanes.filter(lane => lane !== laneNumber)
      : [...currentLanes, laneNumber];
    
    setSelectedLaneBlockages?.({
      ...selectedLaneBlockages,
      lanesAffected: {
        ...selectedLaneBlockages.lanesAffected,
        [direction]: updatedLanes
      }
    });
  };
  
  const toggleAdditionalFilter = (filterName: keyof typeof selectedLaneBlockages.additionalFilters, value: boolean) => {
    const currentValues = selectedLaneBlockages.additionalFilters[filterName];
    const updatedValues = currentValues.includes(value)
      ? currentValues.filter(val => val !== value)
      : [...currentValues, value];
    
    setSelectedLaneBlockages?.({
      ...selectedLaneBlockages,
      additionalFilters: {
        ...selectedLaneBlockages.additionalFilters,
        [filterName]: updatedValues
      }
    });
  };

  const toggleSelectAll = (options: string[], selected: string[], setSelected: (options: string[]) => void) => {
    if (selected.length === options.length) {
      setSelected([])
    } else {
      setSelected([...options])
    }
  }
  
  // Effect to sync local priorities with parent component
  useEffect(() => {
    if (setSelectedPriorities) {
      setSelectedPriorities(localSelectedPriorities);
    }
  }, [localSelectedPriorities, setSelectedPriorities]);
  
  // Effect to sync local event statuses with parent component
  useEffect(() => {
    if (setSelectedEventStatuses) {
      setSelectedEventStatuses(localSelectedEventStatuses);
    }
  }, [localSelectedEventStatuses, setSelectedEventStatuses]);

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
      <TabsList className="flex flex-wrap gap-2 mb-4 bg-transparent p-0">
        <TabsTrigger value="car-events" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center gap-1">
          Car Events
          <InfoTooltip 
            asSpan={true}
            content={
              <div className="space-y-2 w-full">
                <p className="font-medium">Car Events</p>
                <p>Description: Traffic Incidents information</p>
                <p className="break-words">
                  Source: <a 
                    href="https://content.trafficwise.org/json/cars-event-feed.json" 
                    className="text-blue-600 hover:underline" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    cars-event-feed.json
                  </a> (511)
                </p>
              </div>
            } 
          />
        </TabsTrigger>
        <TabsTrigger value="lane-blockages" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center gap-1">
          Lane Blockages
          <InfoTooltip 
            asSpan={true}
            content={
              <div className="space-y-2 w-full">
                <p className="font-medium">Lane Blockages</p>
                <p>Description: Lane Blockages Information</p>
                <p className="break-words">
                  Source: <a 
                    href="https://content.trafficwise.org/json/cars-event-feed.json" 
                    className="text-blue-600 hover:underline" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    cars-event-feed.json
                  </a> (511)
                </p>
              </div>
            } 
          />
        </TabsTrigger>
        <TabsTrigger value="road-weather" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300 flex items-center gap-1">
          Road Weather
          <InfoTooltip 
            asSpan={true}
            content={
              <div className="space-y-2 w-full">
                <p className="font-medium">RWIS</p>
                <p>Description: Road weather information system data</p>
                <p className="break-words">
                  Source: <a 
                    href="https://content.trafficwise.org/json/rwis.json" 
                    className="text-blue-600 hover:underline" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    rwis.json
                  </a>
                </p>
              </div>
            } 
          />
        </TabsTrigger>
        <TabsTrigger value="social-events" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Social Events</TabsTrigger>
        <TabsTrigger value="weather-events" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Weather Events</TabsTrigger>
      </TabsList>

      <TabsContent value="car-events" className="space-y-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium">Event Types:</p>
              <InfoTooltip content={
                <p>Type of the event</p>
              } />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAllCarEvents}>
              {selectedCarEvents.length === carEvents.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-2">
            {carEvents.map((event) => (
              <div key={event} className="flex items-center space-x-2">
                <Checkbox
                  id={`event-${event}`}
                  checked={selectedCarEvents.includes(event)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedCarEvents?.([...selectedCarEvents, event])
                    } else {
                      setSelectedCarEvents?.(selectedCarEvents.filter((e) => e !== event))
                    }
                  }}
                />
                <Label htmlFor={`event-${event}`}>{event}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <p className="text-sm font-medium">Event Status:</p>
              <InfoTooltip content={
                <p>Status of the traffic event</p>
              } />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAllEventStatuses}>
              {selectedEventStatuses.length === eventStatuses.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="flex gap-4">
            {eventStatuses.map((status) => (
              <div key={status} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status}`}
                  checked={localSelectedEventStatuses.includes(status)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setLocalSelectedEventStatuses([...localSelectedEventStatuses, status])
                    } else {
                      setLocalSelectedEventStatuses(localSelectedEventStatuses.filter((s) => s !== status))
                    }
                  }}
                />
                <Label htmlFor={`status-${status}`}>{status}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium">Priority:</p>
            <InfoTooltip content={
              <p>Priority ranking assigned to the traffic event</p>
            } />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between mt-1">
                {localSelectedPriorities.length > 0
                  ? `${localSelectedPriorities.length} priorities selected`
                  : "Select priorities..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => toggleSelectAll(priorities, localSelectedPriorities, setLocalSelectedPriorities)}
                      className="flex items-center gap-2"
                    >
                      <Check
                        className={
                          localSelectedPriorities.length === priorities.length ? "opacity-100" : "opacity-0"
                        }
                        size={16}
                      />
                      <span>Select All</span>
                    </CommandItem>
                    {priorities.map((priority) => (
                      <CommandItem
                        key={priority}
                        onSelect={() => {
                          setLocalSelectedPriorities(
                            localSelectedPriorities.includes(priority)
                              ? localSelectedPriorities.filter((p) => p !== priority)
                              : [...localSelectedPriorities, priority],
                          )
                        }}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={localSelectedPriorities.includes(priority) ? "opacity-100" : "opacity-0"}
                          size={16}
                        />
                        <span>{priority}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </TabsContent>

      <TabsContent value="lane-blockages" className="space-y-6">
        {/* Primary Filters Section */}
        <div className="space-y-6">
          {/* Block Type Filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
            <p className="text-sm font-medium">Block Type:</p>
            <InfoTooltip content={
              <p>Describes the type of blockage</p>
            } />
          </div>
            <div className="flex flex-wrap gap-2 border rounded-md p-3">
              {laneBlockageOptions.blockType.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`block-type-${type}`}
                    checked={selectedLaneBlockages.blockType.includes(type)}
                    onCheckedChange={() => toggleBlockTypes(type)}
                  />
                  <Label htmlFor={`block-type-${type}`}>{type}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* All Lanes Affected Filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
            <p className="text-sm font-medium">All Lanes Affected:</p>
            <InfoTooltip content={
              <p>Describe if all lanes are affected in positive or negative direction</p>
            } />
          </div>
            <div className="flex flex-wrap gap-4 border rounded-md p-3">
              {laneBlockageOptions.allLanesAffected.map((direction) => (
                <div key={direction} className="flex items-center space-x-2">
                  <Checkbox
                    id={`all-lanes-${direction}`}
                    checked={selectedLaneBlockages.allLanesAffected.includes(direction)}
                    onCheckedChange={() => toggleAllLanesDirection(direction)}
                  />
                  <Label htmlFor={`all-lanes-${direction}`}>{direction}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Lanes Affected Filter */}
          <div className="space-y-4">
            <div className="flex items-center gap-1">
            <p className="text-sm font-medium">Lanes Affected:</p>
            <InfoTooltip content={
              <p>Number of lanes impacted in the positive or negative direction</p>
            } />
          </div>
            
            {/* Positive Direction Lanes */}
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Positive Direction:</p>
              <div className="flex flex-wrap gap-2 border rounded-md p-3">
                {laneBlockageOptions.lanesAffected.positive.map((lane) => (
                  <div key={`positive-${lane}`} className="flex items-center space-x-1">
                    <Checkbox
                      id={`positive-lane-${lane}`}
                      checked={selectedLaneBlockages.lanesAffected.positive.includes(lane)}
                      onCheckedChange={() => toggleLaneNumber('positive', lane)}
                    />
                    <Label htmlFor={`positive-lane-${lane}`}>{lane}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Negative Direction Lanes */}
            <div className="space-y-2">
              <p className="text-xs text-gray-600">Negative Direction:</p>
              <div className="flex flex-wrap gap-2 border rounded-md p-3">
                {laneBlockageOptions.lanesAffected.negative.map((lane) => (
                  <div key={`negative-${lane}`} className="flex items-center space-x-1">
                    <Checkbox
                      id={`negative-lane-${lane}`}
                      checked={selectedLaneBlockages.lanesAffected.negative.includes(lane)}
                      onCheckedChange={() => toggleLaneNumber('negative', lane)}
                    />
                    <Label htmlFor={`negative-lane-${lane}`}>{lane}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Filters Section (Collapsed by Default) */}
        <div className="space-y-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Additional Filters
                <span className="text-xs text-gray-500">
                  {Object.values(selectedLaneBlockages.additionalFilters).flat().length > 0 
                    ? `${Object.values(selectedLaneBlockages.additionalFilters).flat().length} selected` 
                    : "None selected"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-4" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Ramps:</p>
                <div className="grid grid-cols-1 gap-2">
                  {/* Negative Exit Ramp */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Negative Exit Ramp Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-exit-ramp-true"
                          checked={selectedLaneBlockages.additionalFilters.negative_exit_ramp_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_exit_ramp_affected', true)}
                        />
                        <Label htmlFor="negative-exit-ramp-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-exit-ramp-false"
                          checked={selectedLaneBlockages.additionalFilters.negative_exit_ramp_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_exit_ramp_affected', false)}
                        />
                        <Label htmlFor="negative-exit-ramp-false">No</Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Negative Entrance Ramp */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Negative Entrance Ramp Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-entrance-ramp-true"
                          checked={selectedLaneBlockages.additionalFilters.negative_entrance_ramp_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_entrance_ramp_affected', true)}
                        />
                        <Label htmlFor="negative-entrance-ramp-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-entrance-ramp-false"
                          checked={selectedLaneBlockages.additionalFilters.negative_entrance_ramp_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_entrance_ramp_affected', false)}
                        />
                        <Label htmlFor="negative-entrance-ramp-false">No</Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Positive Exit Ramp */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Positive Exit Ramp Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-exit-ramp-true"
                          checked={selectedLaneBlockages.additionalFilters.positive_exit_ramp_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_exit_ramp_affected', true)}
                        />
                        <Label htmlFor="positive-exit-ramp-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-exit-ramp-false"
                          checked={selectedLaneBlockages.additionalFilters.positive_exit_ramp_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_exit_ramp_affected', false)}
                        />
                        <Label htmlFor="positive-exit-ramp-false">No</Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Positive Entrance Ramp */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Positive Entrance Ramp Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-entrance-ramp-true"
                          checked={selectedLaneBlockages.additionalFilters.positive_entrance_ramp_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_entrance_ramp_affected', true)}
                        />
                        <Label htmlFor="positive-entrance-ramp-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-entrance-ramp-false"
                          checked={selectedLaneBlockages.additionalFilters.positive_entrance_ramp_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_entrance_ramp_affected', false)}
                        />
                        <Label htmlFor="positive-entrance-ramp-false">No</Label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm font-medium mt-4">Shoulders:</p>
                <div className="grid grid-cols-1 gap-2">
                  {/* Negative Inside Shoulder */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Negative Inside Shoulder Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-inside-shoulder-true"
                          checked={selectedLaneBlockages.additionalFilters.negative_inside_shoulder_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_inside_shoulder_affected', true)}
                        />
                        <Label htmlFor="negative-inside-shoulder-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-inside-shoulder-false"
                          checked={selectedLaneBlockages.additionalFilters.negative_inside_shoulder_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_inside_shoulder_affected', false)}
                        />
                        <Label htmlFor="negative-inside-shoulder-false">No</Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Negative Outside Shoulder */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Negative Outside Shoulder Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-outside-shoulder-true"
                          checked={selectedLaneBlockages.additionalFilters.negative_outside_shoulder_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_outside_shoulder_affected', true)}
                        />
                        <Label htmlFor="negative-outside-shoulder-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="negative-outside-shoulder-false"
                          checked={selectedLaneBlockages.additionalFilters.negative_outside_shoulder_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('negative_outside_shoulder_affected', false)}
                        />
                        <Label htmlFor="negative-outside-shoulder-false">No</Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Positive Inside Shoulder */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Positive Inside Shoulder Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-inside-shoulder-true"
                          checked={selectedLaneBlockages.additionalFilters.positive_inside_shoulder_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_inside_shoulder_affected', true)}
                        />
                        <Label htmlFor="positive-inside-shoulder-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-inside-shoulder-false"
                          checked={selectedLaneBlockages.additionalFilters.positive_inside_shoulder_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_inside_shoulder_affected', false)}
                        />
                        <Label htmlFor="positive-inside-shoulder-false">No</Label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Positive Outside Shoulder */}
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">Positive Outside Shoulder Affected:</p>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-outside-shoulder-true"
                          checked={selectedLaneBlockages.additionalFilters.positive_outside_shoulder_affected.includes(true)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_outside_shoulder_affected', true)}
                        />
                        <Label htmlFor="positive-outside-shoulder-true">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="positive-outside-shoulder-false"
                          checked={selectedLaneBlockages.additionalFilters.positive_outside_shoulder_affected.includes(false)}
                          onCheckedChange={() => toggleAdditionalFilter('positive_outside_shoulder_affected', false)}
                        />
                        <Label htmlFor="positive-outside-shoulder-false">No</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TabsContent>

      <TabsContent value="road-weather" className="space-y-4">
        <div className="border rounded-md p-4 h-60 flex flex-col items-center justify-center bg-muted/50">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Road Weather Information System</h3>
          <p className="text-center text-gray-600 mb-4">RWIS filtering options will be available soon.</p>

        </div>
      </TabsContent>

      <TabsContent value="social-events" className="space-y-4">
        <div className="border rounded-md p-4 h-40 flex items-center justify-center bg-muted/50">
          <p className="text-center text-muted-foreground">Social Events filtering options will be available soon</p>
        </div>
      </TabsContent>

      <TabsContent value="weather-events" className="space-y-4">
        <div className="border rounded-md p-4 h-40 flex items-center justify-center bg-muted/50">
          <p className="text-center text-muted-foreground">Weather Events filtering options will be available soon</p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
