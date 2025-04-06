"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface PlaceholderPageProps {
  title: string
  onBack: () => void
}

export function PlaceholderPage({ title, onBack }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">{title}</h1>
        <p className="text-lg text-gray-600 mb-8">
          This feature is coming soon!
        </p>
        <div className="flex justify-center">
          <Button onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Map View
          </Button>
        </div>
      </div>
    </div>
  )
}
