/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Remove 'output: export' for Vercel deployment
  // Remove basePath and assetPrefix for root domain deployment
  
  // Enable trailing slash for consistent routing
  trailingSlash: true,

  // Ignore TypeScript and ESLint errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configure webpack to support path aliases
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
}

module.exports = nextConfig