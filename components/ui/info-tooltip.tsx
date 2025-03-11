import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

interface InfoTooltipProps {
  content: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
  asSpan?: boolean;
}

export function InfoTooltip({ content, className = "", size = 'sm', asSpan = false }: InfoTooltipProps) {
  const commonClasses = `inline-flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors ${className}`;
  const iconClasses = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          {asSpan ? (
            <span 
              className={commonClasses}
              aria-label="More information"
            >
              <Info className={iconClasses} strokeWidth={2} />
            </span>
          ) : (
            <button 
              className={commonClasses} 
              aria-label="More information"
              type="button"
            >
              <Info className={iconClasses} strokeWidth={2} />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center" 
          className="w-[350px] p-3 text-sm bg-white border border-gray-200 shadow-md rounded-md z-50 break-words overflow-hidden"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
