"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the context type
interface FilterContextType {
  filterState: any;
  setFilterState: (state: any) => void;
}

// Create the context with a default value
const FilterContext = createContext<FilterContextType | undefined>(undefined);

// Provider component
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filterState, setFilterState] = useState<any>(null);

  return (
    <FilterContext.Provider value={{ filterState, setFilterState }}>
      {children}
    </FilterContext.Provider>
  );
}

// Custom hook for using the filter context
export function useFilterContext() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilterContext must be used within a FilterProvider');
  }
  return context;
}
