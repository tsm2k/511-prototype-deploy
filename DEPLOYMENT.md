# Deploying the 511 Map Visualization Application

This document provides instructions for deploying the 511 Map Visualization application to the Purdue server using Docker.

## Prerequisites

- Docker and Docker Compose installed on the server
- Access to the Purdue server (in-engr-tasi02.it.purdue.edu)
- Git access to clone the repository

## Deployment Steps

### 1. Clone the Repository

```bash
git clone https://github.com/tsm2k/511-prototype-deploy.git
cd 511-prototype-deploy
```

### 2. Build and Run the Docker Container

```bash
# Build and start the application
docker-compose up -d --build

# Check the logs
docker-compose logs -f
```

The application will be available at http://in-engr-tasi02.it.purdue.edu:3000

### 3. Configuration Options

You can modify the `docker-compose.yml` file to change the port or add environment variables:

```yaml
version: '3'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"  # Change the first number to use a different port
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_BASE_PATH=  # Set this if deploying to a subdirectory
    restart: unless-stopped
```

### 4. Stopping the Application

```bash
docker-compose down
```

### 5. Updating the Application

```bash
# Pull the latest changes
git pull

# Rebuild and restart the containers
docker-compose up -d --build
```

## Troubleshooting

### API Connection Issues

If you encounter issues connecting to the 511 Data Analytics API:

1. Check that the server can reach https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics
2. Verify that the API proxy endpoints in `/pages/api/proxy/` are correctly configured
3. Check the Docker logs for any error messages

### Container Issues

If the container fails to start:

```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs -f
```

## Additional Notes

- The application uses Next.js API routes to proxy requests to the 511 Data Analytics API
- Static assets (GeoJSON files) are served from the `/public` directory
- The application is configured to run in production mode for optimal performance
