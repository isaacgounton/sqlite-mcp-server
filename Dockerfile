FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install --omit=dev && npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build/index.js"]
