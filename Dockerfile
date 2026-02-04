# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build the application
RUN npm run build

# Explicitly copy static assets to dist to ensure they are present
RUN cp public/sw-v1.js dist/
RUN cp public/manifest.json dist/
RUN cp public/lyrics*.json dist/
RUN cp public/debug.html dist/
RUN cp -r public/VocalParts dist/

# Debug: List dist contents
RUN ls -la dist

# Stage 2: Runner
FROM node:18-alpine

WORKDIR /app

# Install Nginx
RUN apk add --no-cache nginx

# Copy build output
COPY --from=builder /app/dist ./dist
COPY nginx.conf /etc/nginx/nginx.conf
COPY certs /etc/nginx/certs

# Ensure permissions
RUN chmod -R 755 /app/dist
RUN chmod -R 755 /etc/nginx/certs

# Verify files in runner
RUN ls -la /app/dist

# Expose the ports the app runs on
EXPOSE 8080 443

# Debug: List dist contents in runner
RUN ls -la dist

# Command to run the app
CMD ["nginx", "-g", "daemon off;"]

# Cache-busting comment: 2025-11-25 20:50:00
