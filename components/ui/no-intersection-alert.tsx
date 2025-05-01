"use client"

import React from "react"
import { X, AlertCircle } from "lucide-react"
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction
} from "./alert-dialog"
import { Button } from "./button"
import { cn } from "../../lib/utils"

interface NoIntersectionAlertProps {
  isOpen: boolean
  onClose: () => void
  roadName: string
  subdivisionName: string
  className?: string
}

export function NoIntersectionAlert({
  isOpen,
  onClose,
  roadName,
  subdivisionName,
  className
}: NoIntersectionAlertProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className={cn("max-w-md", className)}>
        <div className="absolute right-4 top-4">
          <Button
            variant="ghost"
            className="h-6 w-6 p-0 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <AlertDialogTitle className="text-lg">No Intersection Found</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            We couldn't find any intersection between <span className="font-medium text-foreground">{roadName}</span> and <span className="font-medium text-foreground">{subdivisionName}</span>.
          </AlertDialogDescription>
          
          <div className="mt-2 text-sm text-muted-foreground">
            This may be due to:
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>The road not passing through this area</li>
              {/* <li>Slight misalignment in the GeoJSON data</li>
              <li>Different precision levels in the boundary data</li> */}
            </ul>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button className="w-full sm:w-auto" onClick={onClose}>
              OK
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
