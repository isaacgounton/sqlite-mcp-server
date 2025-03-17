# Use Node.js LTS
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Command to run the server
CMD ["node", "build/index.js"]
