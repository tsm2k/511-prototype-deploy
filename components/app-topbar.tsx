"use client"

import { Map, BarChart3, Database, Settings, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AppTopbarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function AppTopbar({ activeView, onViewChange }: AppTopbarProps) {

  const menuItems = [
    { id: "map", label: "Map View", icon: Map },
    { id: "chart", label: "Chart View", icon: BarChart3 },
    // { id: "data", label: "Data Catalog", icon: Database },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "guide", label: "Guide", icon: BookOpen },
  ]

  return (
    <div className="flex bg-black text-white h-14 w-full">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-full">
          <div className="mr-6">
            <h1 className="text-xl font-bold">511 Data Analysis</h1>
          </div>
          <div className="flex space-x-1">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant={activeView === item.id ? "secondary" : "ghost"}
                className={cn(
                  "text-white hover:bg-zinc-400", 
                  activeView === item.id && "bg-zinc-700"
                )}
                onClick={() => onViewChange(item.id)}
              >
                <item.icon className="h-5 w-5 mr-2" />
                <span>{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
