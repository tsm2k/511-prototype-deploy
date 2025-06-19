"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the context type
interface FilterContextType {
  filterState: any;
  setFilterState: (state: any) => void;
  queryResults: any;
  setQueryResults: (results: any) => void;
  resultsSummary: {
    total: number;
    byDataset: Record<string, number>;
  };
  setResultsSummary: (summary: {
    total: number;
    byDataset: Record<string, number>;
  }) => void;
}

// Create the context with a default value
const FilterContext = createContext<FilterContextType | undefined>(undefined);

// Provider component
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filterState, setFilterState] = useState<any>(null);
  const [queryResults, setQueryResults] = useState<any>(null);
  const [resultsSummary, setResultsSummary] = useState<{
    total: number;
    byDataset: Record<string, number>;
  }>({ total: 0, byDataset: {} });

  return (
    <FilterContext.Provider value={{
      filterState,
      setFilterState,
      queryResults,
      setQueryResults,
      resultsSummary,
      setResultsSummary
    }}>
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
