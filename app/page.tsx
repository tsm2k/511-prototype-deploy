"use client"

import "leaflet/dist/leaflet.css"
import { useState } from "react"
import { AppTopbar } from "@/components/app-topbar"
import { SelectorPanel } from "@/components/selector-panel"
import { MapView } from "@/components/map-view"
import { PlaceholderPage } from "@/components/placeholder-page"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

interface LaneBlockage {
  insideShoulderAffected: boolean
  outsideShoulderAffected: boolean
  allLanesAffected: boolean
  exitRampAffected: boolean
  entranceRampAffected: boolean
  lanesAffected: number[]
}

interface CarEvent {
  id: number
  eventType: string
  route: string
  lat: number
  lon: number
  priorityLevel: number
  eventStatus: string
  dateStart: number
  dateEnd: number | null
  positiveLaneBlockageType: string
  negativeLaneBlockageType: string
  positiveLaneBlockage: LaneBlockage
  negativeLaneBlockage: LaneBlockage
  locationDetails: {
    city: string[]
    county: string[]
    district: string[]
  }
}

export default function Home() {
  const [activeView, setActiveView] = useState<string>("map")
  const [filteredCarEvents, setFilteredCarEvents] = useState<CarEvent[]>([])
  const [selectedDatasets, setSelectedDatasets] = useState<{
    carEvents: string[]
    laneBlockages: {
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
  }>({
    carEvents: [],
    laneBlockages: {
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
    }
  })
  
  // Handler for changing the active view
  const handleViewChange = (view: string) => {
    setActiveView(view)
  }
  
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <AppTopbar activeView={activeView} onViewChange={handleViewChange} />
      <div className="flex-1 overflow-hidden">
        {activeView === "map" && (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={30} minSize={15} collapsible={true} collapsedSize={15}>
              <SelectorPanel 
                onFilteredDataChange={setFilteredCarEvents} 
                onSelectedDatasetsChange={setSelectedDatasets}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
              <MapView 
                carEvents={filteredCarEvents} 
                selectedDatasets={selectedDatasets}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
        
        {activeView === "chart" && (
          <PlaceholderPage title="Chart View" onBack={() => handleViewChange("map")} />
        )}
        
        {activeView === "data" && (
          <PlaceholderPage title="Data Catalog" onBack={() => handleViewChange("map")} />
        )}
        
        {activeView === "settings" && (
          <PlaceholderPage title="Settings" onBack={() => handleViewChange("map")} />
        )}
        
        {activeView === "guide" && (
          <PlaceholderPage title="User Guide" onBack={() => handleViewChange("map")} />
        )}
      </div>
    </div>
  )
}

