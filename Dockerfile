FROM node:20-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm install --omit=dev && npm run build
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1
CMD ["node", "build/index.js"]
