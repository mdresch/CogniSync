# Use Node.js LTS Alpine image
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S cogni-sync -u 1001

# Copy built application
COPY --from=base --chown=cogni-sync:nodejs /app/dist ./dist
COPY --from=base --chown=cogni-sync:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=cogni-sync:nodejs /app/package.json ./
COPY --from=base --chown=cogni-sync:nodejs /app/prisma ./prisma

# Switch to non-root user
USER cogni-sync

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
