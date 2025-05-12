"use client"

import { Map, BarChart3, Database, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface AppTopbarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function AppTopbar({ activeView, onViewChange }: AppTopbarProps) {
  const appVersion = "v0.1.0"
  const releaseDate = "May 08, 2025"
  const menuItems = [
    { id: "map", label: "Map View", icon: Map },
    { id: "chart", label: "Chart View", icon: BarChart3 },
    { id: "database", label: "Database View", icon: Database },
  ]

  return (
    <div className="bg-black text-white h-14 w-full overflow-visible">
      <div className="px-4 h-full flex items-center">
        {/* Title and Version */}
        <div className="flex items-baseline gap-1.5">
          <div className="text-2xl font-bold">511 Data Analysis</div>
          <Dialog>
            <DialogTrigger asChild>
              <button className="relative top bg-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full text-white hover:bg-blue-500 transition-colors leading-tight">
                {appVersion}
              </button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 text-white border-zinc-700">
              <DialogHeader>
                <DialogTitle className="text-xl text-blue-400 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Changelog {appVersion}
                </DialogTitle>
                <DialogDescription className="text-zinc-400">
                  Released on {releaseDate}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">Note</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Some datasets (e.g., Rest Areas, Dynamic Signs, RWIS, etc.) are large and may slow down the app if a wide date range is selected. Even 2 days of data can cause delays. We're working on optimizing this.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">New Features</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Added 'Chart View' tab to display interactive visualizations based on results</li>
                    <li>Added 'Database View' tab to display raw data in a table format</li>
                    <li>Added 'Timeline Slider' to filter events by date range</li>
                    <li>Implemented clustering of markers</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">Improvements</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Enhanced intersection handling for multiple roads and regions</li>
                    <li>Enhanced both Location and Time Selectors</li>
                    <li>Improved UI components: Results are now highlighted when filters are applied</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">Bug Fixes</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Fixed duplicate event handlers for intersection removal</li>
                    <li>Fixed TypeScript errors related to LocationSelectionType</li>
                    <li>Fixed syntax errors in ColorMultiSelectOption interface</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Spacer to shift buttons rightward */}
        <div className="flex-grow" />

        {/* View Buttons */}
        <div className="flex space-x-3 pr-60">
          {menuItems.map((item) => {
            const isChart = item.id === "chart"
            return (
              <div
                key={item.id}
                className={cn("relative group", isChart && "overflow-visible z-50")}
                style={{ position: "relative" }}
              >
                <Button
                  variant={activeView === item.id ? "secondary" : "ghost"}
                  className={cn(
                    "text-white hover:bg-blue-600 transition-all duration-200 rounded-lg px-6 py-5 shadow-md",
                    activeView === item.id
                      ? "bg-blue-700 ring-2 ring-blue-400 ring-offset-1 ring-offset-black font-semibold scale-105"
                      : "bg-zinc-800 hover:scale-105"
                  )}
                  onClick={() => onViewChange(item.id)}
                >
                  <item.icon className={cn("mr-2", activeView === item.id ? "h-5 w-5" : "h-4 w-4")} />
                  <span className="text-base">{item.label}</span>
                </Button>
                {isChart && (
                  <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-yellow-600 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-md">
                    In Progress – Enhancements Coming Soon
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
