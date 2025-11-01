# Multi-stage build for React/Vite frontend

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source files
COPY . .

# Build the application (API URL will be set at runtime)
# Override Vite outDir for Docker build (since ../backend/static won't exist in Docker context)
# Modify vite.config.js to output to dist instead of ../backend/static
RUN sed -i "s|outDir: '../backend/static'|outDir: 'dist'|g" vite.config.js

# Build the application
RUN npm run build

# Verify build output
RUN ls -la dist/ || (echo "ERROR: Build output not found in dist/" && exit 1)

# Stage 2: Serve with nginx
FROM nginx:alpine

# entrypoint.sh uses sh, which is available in alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port 80
EXPOSE 80

# Use entrypoint script for runtime configuration
ENTRYPOINT ["/entrypoint.sh"]
