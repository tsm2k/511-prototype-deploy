#!/bin/bash

# Fix @/lib/utils imports
find components -type f -name "*.tsx" -exec sed -i '' 's|import { cn } from "@/lib/utils"|import { cn } from "../../lib/utils"|g' {} \;
find components/ui -type f -name "*.tsx" -exec sed -i '' 's|import { cn } from "@/lib/utils"|import { cn } from "../../lib/utils"|g' {} \;

# Fix @/components imports
find components -type f -name "*.tsx" -exec sed -i '' 's|from "@/components/ui/|from "./ui/|g' {} \;
find components/ui -type f -name "*.tsx" -exec sed -i '' 's|from "@/components/ui/|from "./|g' {} \;
find components/selectors -type f -name "*.tsx" -exec sed -i '' 's|from "@/components/ui/|from "../ui/|g' {} \;

# Fix other imports
find app -type f -name "*.tsx" -exec sed -i '' 's|from "@/components/|from "../components/|g' {} \;
find lib -type f -name "*.ts" -exec sed -i '' 's|from "@/|from "../|g' {} \;
