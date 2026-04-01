FROM node:22.15-alpine

WORKDIR /app

# Install only dependencies first (cache-friendly)
COPY package*.json ./
RUN npm ci --silent

# Copy rest of sources (dev will mount source over this)
COPY . .

EXPOSE 5173

CMD ["/bin/sh", "-c", "npm install && npm run dev"]
