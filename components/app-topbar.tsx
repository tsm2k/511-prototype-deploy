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
  const appVersion = "v0.2.0"
  const releaseDate = "Jun 18, 2025"
  const menuItems = [
    { id: "map", label: "Map View", icon: Map },
    // { id: "chart", label: "Chart View", icon: BarChart3 },
    { id: "chart2", label: "Chart View", icon: BarChart3 },
    { id: "database", label: "Database View", icon: Database },
  ]

  return (
    <div className="bg-black text-white h-14 w-full overflow-visible">
      <div className="px-4 h-full flex items-center">
        {/* Title and Version */}
        <div className="flex items-baseline gap-1.5">
          <div className="text-2xl font-bold">SPR 4937 Data Analysis</div>
          <Dialog>
            <DialogTrigger asChild>
              <button className="relative top-[1px] bg-blue-600 text-xs font-semibold px-2.5 py-0.5 rounded-full text-white hover:bg-blue-500 transition-colors leading-tight">
                {appVersion}
              </button>
            </DialogTrigger>
            <DialogContent
              className={cn(
                "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                "bg-zinc-900 text-white border border-zinc-700",
                "max-h-[90vh] overflow-y-auto rounded-xl shadow-lg",
                "w-full max-w-xl px-6 pt-6 pb-4"
              )}
            >
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
                  <h3 className="text-lg font-medium text-blue-400 mb-2">New Features</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Users can now interact with the results summary to highlight corresponding features on the map.</li>
                    <li>Users can specify granularity in the time selector (30M, 1Hr, 1Day) to reduce processing overhead.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">Improvements</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Enhanced and improved the Selector Panel and Dataset Selector</li>
                    <li>Time Slider is now more responsive, and shows more information</li>
                    <li>Chart View works with Traffic Events data</li>
                    <li>Popups cleaned for better readability</li>
                    <li>Social Events card shows Venue and City info, along with date</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-blue-400 mb-2">Bug Fixes</h3>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Removal of unconfirmed polygon supported</li>
                    <li>Road naming conventions fixed</li>
                    <li>Roads with large geojson coordinates are now supported</li>
                  </ul>
                </div>

                {/* Known Issues */}
                <details className="text-zinc-300">
                  <summary className="text-red-400 cursor-pointer font-medium text-base hover:underline mb-2">Known Issues</summary>
                  <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                    <li>Longer processing times in few cases</li>
                  </ul>
                </details>

                {/* Planned Enhancements */}
                <details className="text-zinc-300">
                  <summary className="text-green-400 cursor-pointer font-medium text-base hover:underline mb-2">Planned Enhancements</summary>
                  <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                    <li>Implement Mile Marker filtering</li>
                    <li>Enhance Chart View with more dataset support</li>
                    <li>Upgrade Timeline Slider for finer control</li>
                    <li>User login and session support</li>
                    <li>Save and Load custom queries</li>
                  </ul>
                </details>
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
