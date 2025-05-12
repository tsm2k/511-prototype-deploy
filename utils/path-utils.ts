"use client"

/**
 * Gets the base path for assets based on the environment
 * This ensures URLs work both locally and when deployed to Vercel
 * @returns The base path to use for asset URLs
 */
export function getBasePath(): string {
  // For Vercel deployment, we don't need a base path
  // as the app will be served from the root domain
  return '';
}
