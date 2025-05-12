# 511 Map Visualization - Deployment Instructions

This document provides instructions for deploying the 511 Map Visualization application using the provided Docker image tar file.

## Prerequisites

- Docker installed on the server
- The `511-map-visualization.tar` file (size: approximately 431MB)

## Deployment Steps

### 1. Load the Docker Image

```bash
# Load the Docker image from the tar file
docker load -i 511-map-visualization.tar
```

This will load the image into your local Docker registry with the tag `511-map-visualization:latest`.

### 2. Run the Container

```bash
# Run the container, exposing it on port 3000
docker run -d --name 511-map-app -p 3000:3000 511-map-visualization
```

The application will be available at http://localhost:3000 or http://server-ip:3000

### 3. Verify the Application is Running

```bash
# Check the container status
docker ps

# View logs if needed
docker logs 511-map-app
```

## Configuration Options

### Using a Different Port

If you need to use a different port (e.g., port 8080 instead of 3000):

```bash
docker run -d --name 511-map-app -p 8080:3000 511-map-visualization
```

### Setting Environment Variables

If you need to set environment variables:

```bash
docker run -d --name 511-map-app \
  -p 3000:3000 \
  -e NEXT_PUBLIC_BASE_PATH="" \
  511-map-visualization
```

### Using Docker Compose (Alternative Method)

If you prefer using Docker Compose, create a file named `docker-compose.yml` with the following content:

```yaml
version: '3'

services:
  app:
    image: 511-map-visualization
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_BASE_PATH=
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

## Managing the Container

### Stopping the Container

```bash
docker stop 511-map-app
```

### Removing the Container

```bash
docker stop 511-map-app
docker rm 511-map-app
```

### Restarting the Container

```bash
docker restart 511-map-app
```

## Troubleshooting

### Container Fails to Start

Check the logs for error messages:

```bash
docker logs 511-map-app
```

### API Connection Issues

If you encounter issues connecting to the 511 Data Analytics API:

1. Check that the server can reach https://in-engr-tasi02.it.purdue.edu/api/511DataAnalytics
2. Verify network connectivity and firewall settings

### Application Not Accessible

If you can't access the application in your browser:

1. Verify the container is running: `docker ps`
2. Check if the port is correctly mapped: `docker port 511-map-app`
3. Ensure your firewall allows connections to the specified port

## Additional Notes

- The application uses Next.js API routes to proxy requests to the 511 Data Analytics API
- Static assets (GeoJSON files) are included in the Docker image
- The application is configured to run in production mode for optimal performance
