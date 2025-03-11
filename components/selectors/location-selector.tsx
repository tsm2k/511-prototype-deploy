"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Pencil, Circle } from "lucide-react"

const roads = [
  "I-265",
  "I-275",
  "I-465",
  "I-469",
  "I-64",
  "I-65",
  "I-69",
  "I-70",
  "I-74",
  "I-80",
  "I-80 Illinois",
  "I-865",
  "I-94",
  "IN 1",
  "IN 10",
  "IN 114",
  "IN 13",
  "IN 135",
  "IN 15",
  "IN 161",
  "IN 2",
  "IN 213",
  "IN 235",
  "IN 236",
  "IN 250",
  "IN 252",
  "IN 256",
  "IN 32",
  "IN 327",
  "IN 337",
  "IN 37",
  "IN 38",
  "IN 39",
  "IN 42",
  "IN 44",
  "IN 45",
  "IN 450",
  "IN 46",
  "IN 56",
  "IN 57",
  "IN 61",
  "IN 62",
  "IN 63",
  "IN 66",
  "IN 67",
  "IN 7",
  "IN 70",
  "US 150",
  "US 20",
  "US 231",
  "US 24",
  "US 27",
  "US 30",
  "US 31",
  "US 35",
  "US 40",
  "US 41",
  "US 421",
  "US 50",
  "US 52",
  "US 6"
]

const cities = [
  "Anderson",
  "Auburn",
  "Bedford",
  "Beech Grove",
  "Bloomington",
  "Boonville",
  "Brownsburg",
  "Burns Harbor",
  "Carlisle",
  "Carmel",
  "Clarksville",
  "Clear Creek",
  "Cloverdale",
  "Columbus",
  "Crawfordsville",
  "Crown Point",
  "Evansville",
  "Fishers",
  "Fort Wayne",
  "Franklin",
  "Gary",
  "Gas City",
  "Greenfield",
  "Greensburg",
  "Greens Fork",
  "Greenwood",
  "Grissom AFB",
  "Hammond",
  "Henryville",
  "Hobart",
  "Huntington",
  "Indianapolis",
  "Ingalls",
  "Jeffersonville",
  "Kokomo",
  "Lake Station",
  "Lawrence",
  "Lebanon",
  "Louisville",
  "Martinsville",
  "Medora",
  "Memphis",
  "Merrillville",
  "Middlebury",
  "Mooresville",
  "Munster",
  "New Albany",
  "Noblesville",
  "Orland",
  "Orleans",
  "Paoli",
  "Pendleton",
  "Pipe Creek",
  "Plainfield",
  "Plymouth",
  "Portage",
  "Porter",
  "Remington",
  "Roselawn",
  "Scottsburg",
  "Sellersburg",
  "Shelbyville",
  "Speedway",
  "Spiceland",
  "Taylorsville",
  "Tecumseh",
  "Terre Haute",
  "Versailles",
  "Wabash",
  "Westfield",
  "Whiteland",
  "Whitestown",
  "Wolcott",
  "Zionsville"
]

const districts = [
  "CRAWFORDSVILLE",
  "FORT WAYNE",
  "GREENFIELD",
  "LAPORTE",
  "SEYMOUR",
  "VINCENNES"
]

export interface LocationSelectorProps {
  selectedRoads: string[]
  onSelectedRoadsChange?: (roads: string[]) => void
  setSelectedRoads?: (roads: string[]) => void
  selectedLocations: string[]
  onSelectedLocationsChange?: (locations: string[]) => void
  setSelectedLocations?: (locations: string[]) => void
  selectedDistricts: string[]
  onSelectedDistrictsChange?: (districts: string[]) => void
  setSelectedDistricts?: (districts: string[]) => void
}

export function LocationSelector({
  selectedRoads,
  onSelectedRoadsChange,
  setSelectedRoads,
  selectedLocations,
  onSelectedLocationsChange,
  setSelectedLocations,
  selectedDistricts,
  onSelectedDistrictsChange,
  setSelectedDistricts,
}: LocationSelectorProps) {
  const [radius, setRadius] = useState(10)
  const [mileMarkerRange, setMileMarkerRange] = useState([0, 100])
  const [drawMode, setDrawMode] = useState<"polygon" | "circle" | null>(null)
  const [searchRoad, setSearchRoad] = useState("")
  const [searchLocation, setSearchLocation] = useState("")
  const [searchDistrict, setSearchDistrict] = useState("")

  const filteredRoads = roads.filter((road) => road.toLowerCase().includes(searchRoad.toLowerCase()))

  const filteredLocations = cities.filter((location) =>
    location.toLowerCase().includes(searchLocation.toLowerCase()),
  )

  const filteredDistricts = districts.filter((district) =>
    district.toLowerCase().includes(searchDistrict.toLowerCase()),
  )

  const toggleAllRoads = () => {
    const updatedRoads = selectedRoads.length === roads.length ? [] : [...roads];
    
    if (onSelectedRoadsChange) {
      onSelectedRoadsChange?.(updatedRoads);
    } else if (setSelectedRoads) {
      setSelectedRoads?.(updatedRoads);
    }
  }

  const toggleAllLocations = () => {
    const updatedLocations = selectedLocations.length === cities.length ? [] : [...cities];
    
    if (onSelectedLocationsChange) {
      onSelectedLocationsChange?.(updatedLocations);
    } else if (setSelectedLocations) {
      setSelectedLocations?.(updatedLocations);
    }
  }

  const toggleAllDistricts = () => {
    const updatedDistricts = selectedDistricts.length === districts.length ? [] : [...districts];
    
    if (onSelectedDistrictsChange) {
      onSelectedDistrictsChange(updatedDistricts);
    } else if (setSelectedDistricts) {
      setSelectedDistricts?.(updatedDistricts);
    }
  }

  return (
    <Tabs defaultValue="road" className="w-full">
      <TabsList className="flex flex-wrap gap-2 mb-4 bg-transparent p-0">
        <TabsTrigger value="road" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Road</TabsTrigger>
        <TabsTrigger value="city" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">City</TabsTrigger>
        <TabsTrigger value="districts" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Districts</TabsTrigger>
        <TabsTrigger value="draw" className="bg-white hover:bg-gray-50 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 shadow-sm border-2 border-gray-300">Draw</TabsTrigger>
      </TabsList>

      <TabsContent value="road" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search roads..."
              value={searchRoad}
              onChange={(e) => setSearchRoad(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllRoads} size="sm">
              {selectedRoads.length === roads.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2 grid grid-cols-2 gap-2">
            {filteredRoads.map((road) => (
              <div key={road} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`road-${road}`}
                  checked={selectedRoads.includes(road)}
                  onCheckedChange={(checked) => {
                    const updatedRoads = checked 
                      ? [...selectedRoads, road]
                      : selectedRoads.filter((r) => r !== road);
                      
                    if (onSelectedRoadsChange) {
                      onSelectedRoadsChange(updatedRoads);
                    } else if (setSelectedRoads) {
                      setSelectedRoads?.(updatedRoads);
                    }
                  }}
                />
                <Label htmlFor={`road-${road}`}>{road}</Label>
              </div>
            ))}
          </div>

          {selectedRoads.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Mile Marker Range (Not Functional)</Label>
                <div className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded-md">
                  {mileMarkerRange[0]} - {mileMarkerRange[1]}
                </div>
              </div>
              
              <div id="slider-container" className="relative pt-2 pb-2">
                {/* Custom Range Slider */}
                <div className="h-2 w-full bg-gray-200 rounded-full relative">
                  {/* Colored range between thumbs */}
                  <div 
                    className="absolute h-full bg-black rounded-full" 
                    style={{
                      left: `${mileMarkerRange[0]}%`,
                      width: `${mileMarkerRange[1] - mileMarkerRange[0]}%`
                    }}
                  />
                </div>
                
                {/* Left thumb - draggable */}
                <div 
                  className="absolute top-0 -mt-1 -ml-2.5 h-5 w-5 rounded-full border-2 border-black bg-white cursor-pointer shadow-md hover:scale-110 transition-transform"
                  style={{ left: `${mileMarkerRange[0]}%` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const sliderContainer = document.getElementById('slider-container');
                    if (!sliderContainer) return;
                    
                    const sliderRect = sliderContainer.getBoundingClientRect();
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const newPosition = Math.max(0, Math.min(100, ((moveEvent.clientX - sliderRect.left) / sliderRect.width) * 100));
                      if (newPosition < mileMarkerRange[1]) {
                        setMileMarkerRange([Math.round(newPosition), mileMarkerRange[1]]);
                      }
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
                
                {/* Right thumb - draggable */}
                <div 
                  className="absolute top-0 -mt-1 -ml-2.5 h-5 w-5 rounded-full border-2 border-black bg-white cursor-pointer shadow-md hover:scale-110 transition-transform"
                  style={{ left: `${mileMarkerRange[1]}%` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const sliderContainer = document.getElementById('slider-container');
                    if (!sliderContainer) return;
                    
                    const sliderRect = sliderContainer.getBoundingClientRect();
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const newPosition = Math.max(0, Math.min(100, ((moveEvent.clientX - sliderRect.left) / sliderRect.width) * 100));
                      if (newPosition > mileMarkerRange[0]) {
                        setMileMarkerRange([mileMarkerRange[0], Math.round(newPosition)]);
                      }
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </div>
              
              {/* Input fields */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <input
                    type="number"
                    value={mileMarkerRange[0]}
                    min={0}
                    max={mileMarkerRange[1] - 1}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(mileMarkerRange[1] - 1, parseInt(e.target.value) || 0));
                      setMileMarkerRange([value, mileMarkerRange[1]]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
                  />
                </div>
                <div className="text-gray-400">—</div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={mileMarkerRange[1]}
                    min={mileMarkerRange[0] + 1}
                    max={100}
                    onChange={(e) => {
                      const value = Math.max(mileMarkerRange[0] + 1, Math.min(100, parseInt(e.target.value) || 0));
                      setMileMarkerRange([mileMarkerRange[0], value]);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-gray-800"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1 mt-2">
            {selectedRoads.map((road) => (
              <Badge key={road} variant="secondary" className="text-xs">
                {road}
              </Badge>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="city" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search locations..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllLocations} size="sm">
              {selectedLocations.length === cities.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2 grid grid-cols-2 gap-2">
            {filteredLocations.map((location) => (
              <div key={location} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`location-${location}`}
                  checked={selectedLocations.includes(location)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedLocations?.([...selectedLocations, location])
                    } else {
                      setSelectedLocations?.(selectedLocations.filter((l) => l !== location))
                    }
                  }}
                />
                <Label htmlFor={`location-${location}`}>{location}</Label>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Radius (miles) (Not Functional): {radius}</Label>
            <Slider value={[radius]} min={1} max={50} step={1} onValueChange={([value]) => setRadius(value)} />
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {selectedLocations.map((location) => (
              <Badge key={location} variant="secondary" className="text-xs">
                {location} ({radius} mi)
              </Badge>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="districts" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search districts..."
              value={searchDistrict}
              onChange={(e) => setSearchDistrict(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={toggleAllDistricts} size="sm">
              {selectedDistricts.length === districts.length ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border rounded-md p-2">
            {filteredDistricts.map((district) => (
              <div key={district} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`district-${district}`}
                  checked={selectedDistricts.includes(district)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedDistricts?.([...selectedDistricts, district])
                    } else {
                      setSelectedDistricts?.(selectedDistricts.filter((d) => d !== district))
                    }
                  }}
                />
                <Label htmlFor={`district-${district}`}>{district}</Label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {selectedDistricts.map((district) => (
              <Badge key={district} variant="secondary" className="text-xs">
                {district}
              </Badge>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="draw" className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4">
          <p className="text-amber-800 text-sm">Note: The draw functionality is not yet implemented. This feature will be available in a future update.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={drawMode === "polygon" ? "default" : "outline"}
            onClick={() => setDrawMode("polygon")}
            className="flex-1"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Draw Polygon
          </Button>
          <Button
            variant={drawMode === "circle" ? "default" : "outline"}
            onClick={() => setDrawMode("circle")}
            className="flex-1"
          >
            <Circle className="mr-2 h-4 w-4" />
            Draw Circle
          </Button>
        </div>

        <div className="border rounded-md p-4 h-40 flex items-center justify-center bg-muted/50">
          {drawMode ? (
            <p className="text-center text-muted-foreground">Click on the map to start drawing a {drawMode}</p>
          ) : (
            <p className="text-center text-muted-foreground">Select a drawing mode above</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
