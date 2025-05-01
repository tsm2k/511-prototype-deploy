import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  onDelete?: () => void;
  variant?: "default" | "secondary" | "outline";
}

export function Tag({
  label,
  onDelete,
  variant = "default",
  className,
  ...props
}: TagProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold mr-1 mb-1",
        variant === "default" && "border border-gray-200 bg-white text-gray-800",
        variant === "secondary" && "bg-gray-100 text-gray-800",
        variant === "outline" && "border border-gray-200 text-gray-800",
        className
      )}
      {...props}
    >
      <span className="mr-1">{label}</span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="ml-1 font-bold text-gray-400 hover:text-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
