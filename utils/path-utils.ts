"use client"

/**
 * Gets the base path for assets based on the environment
 * This ensures URLs work both locally and when deployed to GitHub Pages
 * @returns The base path to use for asset URLs
 */
export function getBasePath(): string {
  // For client-side rendering, check if we're in production and use the repository name
  // For local development, use an empty string
  if (typeof window !== 'undefined') {
    // Check if the URL includes the repository name
    const isGitHubPages = window.location.pathname.includes('/511-prototype-deploy');
    return isGitHubPages ? '/511-prototype-deploy' : '';
  }
  
  // Fallback for server-side rendering
  return process.env.NODE_ENV === 'production' ? '/511-prototype-deploy' : '';
}
