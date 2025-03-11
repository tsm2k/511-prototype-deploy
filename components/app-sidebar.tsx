"use client"

import { Map, BarChart3, Database, Settings, BookOpen, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./ui/button"
import { cn } from "../lib/utils"
import { useState } from "react"

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeView, setActiveView] = useState("map")

  const menuItems = [
    { id: "map", label: "Map View", icon: Map },
    { id: "chart", label: "Chart View", icon: BarChart3 },
    { id: "data", label: "Data Catalog", icon: Database },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "guide", label: "Guide", icon: BookOpen },
  ]

  return (
    <div
      className={cn(
        "flex flex-col bg-black text-white transition-all duration-300 ease-in-out",
        isExpanded ? "w-[15%]" : "w-[5%]",
      )}
    >
      <div className="flex justify-end p-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsExpanded(!isExpanded)} 
          className="text-white hover:bg-zinc-800"
        >
          {isExpanded ? <ChevronLeft /> : <ChevronRight />}
        </Button>
      </div>
      <div className="flex flex-col gap-2 p-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant={activeView === item.id ? "secondary" : "ghost"}
            className={cn("justify-start text-white hover:bg-zinc-800", activeView === item.id && "bg-zinc-800")}
            onClick={() => setActiveView(item.id)}
          >
            <item.icon className={cn("h-5 w-5", !isExpanded && "mx-auto")} />
            {isExpanded && <span className="ml-2">{item.label}</span>}
          </Button>
        ))}
      </div>
    </div>
  )
}

