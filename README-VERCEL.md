# Deploying to Vercel

This guide explains how to deploy the 511 Map Visualization application to Vercel.

## Prerequisites

- A Vercel account (you can sign up at [vercel.com](https://vercel.com))
- Git repository with your code (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### 1. Connect Your Repository to Vercel

1. Log in to your Vercel account
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Select the repository containing this application

### 2. Configure the Project

Use the following settings:

- **Framework Preset**: Next.js
- **Root Directory**: ./
- **Build Command**: `npm run build`
- **Output Directory**: .next
- **Install Command**: `npm install --legacy-peer-deps`

### 3. Environment Variables

No environment variables are required for basic functionality.

### 4. Deploy

Click "Deploy" and Vercel will build and deploy your application.

## Vercel Specific Features

### API Routes

The application uses Next.js API routes to proxy requests to the 511 Data Analytics API. These will work automatically on Vercel without additional configuration.

### Custom Domain (Optional)

If you want to use a custom domain:

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain and follow the verification steps

## Troubleshooting

### API Connectivity Issues

If you encounter issues with the API:

1. Check the Vercel Function Logs in your project dashboard
2. Verify that the external API (https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics) is accessible
3. Check for CORS issues in the browser console

### Build Failures

If your build fails:

1. Check the build logs in Vercel
2. Ensure all dependencies are correctly installed
3. Verify that the build command is working correctly

## Local Development

To test the application locally before deploying to Vercel:

```bash
npm run dev
```

The application will be available at http://localhost:3000
