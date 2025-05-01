"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface PoliticalSubdivisionInfo {
  name: string;
  type: 'city' | 'county' | 'district' | 'subdistrict';
  feature?: any; // Added to match the structure in location-selector
}

interface IntersectionDialogProps {
  isOpen: boolean
  onClose: () => void
  onIntersect: () => void
  onKeepSeparate: () => void
  roadSelection: string[] // Array to support multiple road selections
  politicalSubdivisions: PoliticalSubdivisionInfo[] // Array to support multiple political subdivisions
}

export function IntersectionDialog({
  isOpen,
  onClose,
  onIntersect,
  onKeepSeparate,
  roadSelection,
  politicalSubdivisions
}: IntersectionDialogProps) {
  // Determine what types of subdivisions we're showing
  const hasCities = politicalSubdivisions.some(ps => ps.type === 'city');
  const hasCounties = politicalSubdivisions.some(ps => ps.type === 'county');
  const hasDistricts = politicalSubdivisions.some(ps => ps.type === 'district');
  const hasSubdistricts = politicalSubdivisions.some(ps => ps.type === 'subdistrict');
  
  // Create a label based on the types of subdivisions
  let subdivisionLabel = '';
  const types = [];
  if (hasCities) types.push('Cities');
  if (hasCounties) types.push('Counties');
  if (hasDistricts) types.push('Districts');
  if (hasSubdistricts) types.push('Subdistricts');
  
  if (types.length > 1) {
    // If multiple types, use a combined label
    subdivisionLabel = 'Geographical Areas';
  } else if (hasCities) {
    subdivisionLabel = politicalSubdivisions.length > 1 ? 'Cities' : 'City';
  } else if (hasCounties) {
    subdivisionLabel = politicalSubdivisions.length > 1 ? 'Counties' : 'County';
  } else if (hasDistricts) {
    subdivisionLabel = politicalSubdivisions.length > 1 ? 'Districts' : 'District';
  } else {
    subdivisionLabel = politicalSubdivisions.length > 1 ? 'Subdistricts' : 'Subdistrict';
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Combine Selections?</DialogTitle>
          <DialogDescription>
            You are trying to add both {roadSelection.length > 1 ? 'Roads' : 'a Road'} and {politicalSubdivisions.length > 1 ? subdivisionLabel : `a ${subdivisionLabel}`}. How would you like to proceed?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="text-sm text-gray-700 mb-2">
            <span className="font-medium">{roadSelection.length > 1 ? 'Roads:' : 'Road:'}</span>
            {roadSelection.length === 1 ? (
              <span> {roadSelection[0]}</span>
            ) : (
              <ul className="list-disc pl-5 mt-1">
                {roadSelection.map((road, index) => (
                  <li key={index}>{road}</li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="text-sm text-gray-700">
            <span className="font-medium">{subdivisionLabel}:</span>
            {politicalSubdivisions.length === 1 ? (
              <span> {politicalSubdivisions[0].name}</span>
            ) : (
              <ul className="list-disc pl-5 mt-1">
                {politicalSubdivisions.map((ps, index) => (
                  <li key={index}>{ps.name} ({
                    ps.type === 'city' ? 'City' : 
                    ps.type === 'county' ? 'County' : 
                    ps.type === 'district' ? 'District' : 'Subdistrict'
                  })</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKeepSeparate}>
            Keep Both
          </Button>
          <Button onClick={onIntersect}>
            Find Intersection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
