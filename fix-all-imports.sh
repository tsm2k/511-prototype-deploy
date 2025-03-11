#!/bin/bash

# Fix imports in UI components
find components/ui -type f -name "*.tsx" | while read file; do
  # Fix @/lib/utils imports
  sed -i '' 's|import { cn } from "@/lib/utils"|import { cn } from "../../lib/utils"|g' "$file"
  
  # Fix component imports within UI folder
  sed -i '' 's|from "@/components/ui/|from "./|g' "$file"
  
  # Fix any remaining @/ imports
  sed -i '' 's|from "@/|from "../../|g' "$file"
done

# Fix imports in top-level components
find components -maxdepth 1 -type f -name "*.tsx" | while read file; do
  # Fix @/lib/utils imports
  sed -i '' 's|import { cn } from "@/lib/utils"|import { cn } from "../lib/utils"|g' "$file"
  
  # Fix component imports
  sed -i '' 's|from "@/components/ui/|from "./ui/|g' "$file"
  sed -i '' 's|from "@/components/|from "./|g' "$file"
  
  # Fix any remaining @/ imports
  sed -i '' 's|from "@/|from "../|g' "$file"
done

# Fix imports in selector components
find components/selectors -type f -name "*.tsx" | while read file; do
  # Fix @/lib/utils imports
  sed -i '' 's|import { cn } from "@/lib/utils"|import { cn } from "../../lib/utils"|g' "$file"
  
  # Fix component imports
  sed -i '' 's|from "@/components/ui/|from "../ui/|g' "$file"
  sed -i '' 's|from "@/components/|from "../|g' "$file"
  
  # Fix any remaining @/ imports
  sed -i '' 's|from "@/|from "../../|g' "$file"
done

# Fix imports in app directory
find app -type f -name "*.tsx" | while read file; do
  # Fix component imports
  sed -i '' 's|from "@/components/|from "../components/|g' "$file"
  
  # Fix any remaining @/ imports
  sed -i '' 's|from "@/|from "../|g' "$file"
done

# Fix imports in lib directory
find lib -type f -name "*.ts" | while read file; do
  # Fix any @/ imports
  sed -i '' 's|from "@/|from "../|g' "$file"
done

echo "All imports have been fixed!"
