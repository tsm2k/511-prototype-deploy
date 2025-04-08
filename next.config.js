// next.config.js
module.exports = {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
  }

const repo = '511-prototype-deploy' // <- your GitHub repo name

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  trailingSlash: true,
}  
  