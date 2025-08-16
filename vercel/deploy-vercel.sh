#!/bin/bash

# Vercel Deployment Script for CogniSync Services
# This script deploys all CogniSync services to Vercel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CogniSync Vercel Deployment${NC}"
echo -e "${BLUE}==============================${NC}"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI is not installed. Run: npm i -g vercel"
    exit 1
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    print_error "Not logged in to Vercel. Run: vercel login"
    exit 1
fi

print_status "Vercel CLI is ready"

# Services to deploy
services=("atlassian-sync-service" "knowledge-graph-service" "llm-rag-service" "knowledge-graph-server")

# Deploy each service
for service in "${services[@]}"; do
    if [ -d "../$service" ]; then
        echo -e "${BLUE}Deploying $service...${NC}"
        
        # Navigate to service directory
        cd "../$service"
        
        # Copy Vercel configuration
        if [ -f "../vercel/${service}.json" ]; then
            cp "../vercel/${service}.json" vercel.json
            print_status "Vercel configuration copied for $service"
        else
            # Create default vercel.json
            cat > vercel.json << EOF
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
EOF
            print_status "Default Vercel configuration created for $service"
        fi
        
        # Install dependencies
        echo -e "${YELLOW}Installing dependencies for $service...${NC}"
        npm ci --only=production
        
        # Generate Prisma client if schema exists
        if [ -f "prisma/schema.prisma" ]; then
            npx prisma generate
            print_status "Prisma client generated for $service"
        fi
        
        # Build the service
        echo -e "${YELLOW}Building $service...${NC}"
        npm run build
        print_status "$service built successfully"
        
        # Deploy to Vercel
        echo -e "${YELLOW}Deploying $service to Vercel...${NC}"
        vercel --prod --confirm
        print_status "$service deployed to Vercel"
        
        # Go back to vercel directory
        cd ../vercel
        
    else
        print_warning "$service directory not found, skipping"
    fi
done

echo -e "${GREEN}🎉 All services deployed to Vercel successfully!${NC}"
echo -e "${YELLOW}📖 Configure environment variables in Vercel dashboard${NC}"
echo -e "${YELLOW}🔗 Update service URLs in your environment configuration${NC}"

# Display next steps
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Configure environment variables in Vercel dashboard for each service"
echo -e "2. Set up external database (PostgreSQL) - Vercel doesn't provide persistent storage"
echo -e "3. Update CORS_ORIGIN and service URLs in your environment variables"
echo -e "4. Test the deployed services"
echo -e "5. Set up monitoring and alerting"