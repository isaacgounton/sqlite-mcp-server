# Use Node.js LTS
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# Enable interactive mode for stdio
ENV NODE_ENV=production
STOPSIGNAL SIGINT

# Command to run the server
CMD ["node", "--interactive", "build/index.js"]
