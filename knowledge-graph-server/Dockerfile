# Stage 1: Build the TypeScript code
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Create the final, lean production image
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port the app will run on
EXPOSE 4001

CMD [ "node", "dist/server.js" ]
