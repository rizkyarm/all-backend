# -----------------------------
# Stage 1: Build the application
# -----------------------------
FROM node:22-alpine AS builder

# Install OpenSSL (Required by Prisma on Alpine Linux)
RUN apk add --update --no-cache openssl

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the NestJS application
RUN npm run build

# -----------------------------
# Stage 2: Production image
# -----------------------------
FROM node:22-alpine AS production

# Install OpenSSL (Required by Prisma on Alpine Linux)
RUN apk add --update --no-cache openssl

# Set Node environment to production
ENV NODE_ENV=production

# Create app directory and set ownership to node user
WORKDIR /usr/src/app
RUN chown node:node /usr/src/app

# Copy package files with correct ownership
COPY --chown=node:node package*.json ./

# Install ONLY production dependencies + tsx (needed by prisma.config.ts at runtime)
RUN npm ci --omit=dev && npm install tsx

# Copy Prisma schema, config, and generate client for production
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts tsconfig.json ./

# Set placeholder DB vars so `prisma generate` can resolve prisma.config.ts
# (real values are injected via docker-compose / K8s at runtime)
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public \
    DB_USERNAME=placeholder \
    DB_PASSWORD=placeholder \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_DATABASE=placeholder

RUN npx prisma generate

# Copy the compiled application from the builder stage
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

# Switch to non-root user
USER node

# Expose the application port
EXPOSE 3000

# Start the application (auto-run migrations first)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
