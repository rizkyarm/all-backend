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

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Copy Prisma schema and generate client for production
COPY --chown=node:node prisma ./prisma
RUN npx prisma generate

# Copy the compiled application from the builder stage
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

# Switch to non-root user
USER node

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
