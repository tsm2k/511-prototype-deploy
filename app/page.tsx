"use client"

import "leaflet/dist/leaflet.css"
import { useState, useEffect } from "react"
import { AppTopbar } from "@/components/app-topbar"
import { SelectorPanel } from "@/components/selector-panel"
import { MapView } from "@/components/map-view"
import { PlaceholderPage } from "@/components/placeholder-page"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function Home() {
  const [activeView, setActiveView] = useState<string>("map")
  const [isFiltersPanelCollapsed, setIsFiltersPanelCollapsed] = useState(false)
  const [mapData, setMapData] = useState<any>(null)
  
  // Listen for map data updates from the SelectorPanel
  useEffect(() => {
    const handleMapDataUpdated = (event: CustomEvent) => {
      setMapData(event.detail);
    };
    
    window.addEventListener('map-data-updated', handleMapDataUpdated as EventListener);
    
    return () => {
      window.removeEventListener('map-data-updated', handleMapDataUpdated as EventListener);
    };
  }, []);
  
  const [selectedDatasets, setSelectedDatasets] = useState<{
  }>({


  })
  
  // Handler for changing the active view
  const handleViewChange = (view: string) => {
    setActiveView(view)
  }
  
  // Toggle filters panel collapsed state
  const toggleFiltersPanel = () => {
    setIsFiltersPanelCollapsed(!isFiltersPanelCollapsed)
  }
  
  // Effect to handle manual resizing
  useEffect(() => {
    const handleResize = () => {
      const panel = document.querySelector('[data-panel-id="filters-panel"]')
      if (panel) {
        const width = panel.getBoundingClientRect().width
        const windowWidth = window.innerWidth
        const percentage = (width / windowWidth) * 100
        
        // If panel is very small, consider it collapsed
        if (percentage < 10) {
          setIsFiltersPanelCollapsed(true)
        } else {
          setIsFiltersPanelCollapsed(false)
        }
      }
    }
    
    // Add resize observer to detect manual resizing
    const resizeObserver = new ResizeObserver(handleResize)
    const panel = document.querySelector('[data-panel-id="filters-panel"]')
    if (panel) {
      resizeObserver.observe(panel)
    }
    
    return () => {
      if (panel) {
        resizeObserver.unobserve(panel)
      }
      resizeObserver.disconnect()
    }
  }, [])
  
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <AppTopbar activeView={activeView} onViewChange={handleViewChange} />
      <div className="flex-1 overflow-hidden">
        {activeView === "map" && (
          <div className="relative h-full">
            <ResizablePanelGroup direction="horizontal">
              {isFiltersPanelCollapsed ? (
                <ResizablePanel 
                  defaultSize={5} 
                  minSize={5} 
                  maxSize={5}
                  className="!w-[50px] !min-w-[50px] !max-w-[50px] flex items-center justify-center"
                  data-panel-id="collapsed-panel"
                >
                  <div className="h-full w-full flex flex-col items-center pt-16 bg-white">
                    <div className="writing-vertical text-lg font-medium text-gray-700 mb-4">Data Filters</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-2 bg-white/80 hover:bg-white shadow-sm border rounded-full"
                      onClick={toggleFiltersPanel}
                      aria-label="Expand filters panel"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </ResizablePanel>
              ) : (
                <ResizablePanel 
                  defaultSize={32} 
                  minSize={32} 
                  maxSize={50}
                  className="min-w-[300px]"
                  data-panel-id="filters-panel"
                >
                  <div className="h-full relative">
                    <SelectorPanel />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 z-10 bg-white/80 hover:bg-white shadow-sm border rounded-full"
                      onClick={toggleFiltersPanel}
                      aria-label="Collapse filters panel"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </ResizablePanel>
              )}
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={isFiltersPanelCollapsed ? 95 : 68}>
                <MapView 
                  queryResults={mapData}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
        
        {activeView === "chart" && (
          <PlaceholderPage title="Chart View" onBack={() => handleViewChange("map")} />
        )}
        
        {activeView === "data" && (
          <PlaceholderPage title="Data Catalog" onBack={() => handleViewChange("map")} />
        )}
        
        {/* {activeView === "settings" && (
          <PlaceholderPage title="Settings" onBack={() => handleViewChange("map")} />
        )}
        
        {activeView === "guide" && (
          <PlaceholderPage title="User Guide" onBack={() => handleViewChange("map")} />
        )} */}
      </div>
    </div>
  )
}

