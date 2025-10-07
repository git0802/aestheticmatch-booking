# Production-ready Dockerfile for NestJS with pnpm
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm


# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy Prisma schema before generating client
COPY prisma ./prisma
RUN pnpm exec prisma generate

# Copy source code
COPY . .
COPY .env .env

# Build the app
RUN pnpm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env .env

# Expose port (default NestJS port)
EXPOSE 3001

# Start the app
CMD ["node", "dist/main.js"]
