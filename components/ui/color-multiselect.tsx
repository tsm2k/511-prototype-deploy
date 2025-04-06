"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ColorMultiSelectOption {
  label: string
  value: string
  description?: string
  source?: string
  href?: string
}

interface ColorMultiSelectProps {
  options: ColorMultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  dropdownClassName?: string
  buttonClassName?: string
  optionClassName?: string
}



export function ColorMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
  dropdownClassName,
  buttonClassName,
  optionClassName
}: ColorMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(item => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const getSelectedLabels = () => {
    if (selected.length === 0) return placeholder
    
    const selectedOptions = options.filter(option => selected.includes(option.value))
    if (selectedOptions.length <= 2) {
      return selectedOptions.map(option => option.label).join(', ')
    }
    return `${selectedOptions.length} items selected`
  }

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 text-left border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
          buttonClassName
        )}
      >
        <span>{getSelectedLabels()}</span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={cn(
          "absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto",
          dropdownClassName
        )}>
          {options.map((option, index) => {
            const isSelected = selected.includes(option.value)
            
            return (
              <div
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={cn(
                  "flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100",
                  isSelected ? "bg-gray-50" : "",
                  optionClassName
                )}
              >
                <span className="flex-1">{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
