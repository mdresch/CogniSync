#!/bin/bash

# CogniSync Production Deployment Script
# This script automates the deployment process for CogniSync services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE=${1:-docker}  # docker, vercel, azure, aws
ENVIRONMENT=${2:-production}

echo -e "${BLUE}🚀 CogniSync Deployment Script${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Deployment Type: ${YELLOW}$DEPLOYMENT_TYPE${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo ""

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

# Function to check if required tools are installed
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_status "Node.js is installed"
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_status "npm is installed"
    
    case $DEPLOYMENT_TYPE in
        docker)
            if ! command -v docker &> /dev/null; then
                print_error "Docker is not installed"
                exit 1
            fi
            print_status "Docker is installed"
            
            if ! command -v docker-compose &> /dev/null; then
                print_error "Docker Compose is not installed"
                exit 1
            fi
            print_status "Docker Compose is installed"
            ;;
        vercel)
            if ! command -v vercel &> /dev/null; then
                print_error "Vercel CLI is not installed. Run: npm i -g vercel"
                exit 1
            fi
            print_status "Vercel CLI is installed"
            ;;
        azure)
            if ! command -v az &> /dev/null; then
                print_error "Azure CLI is not installed"
                exit 1
            fi
            print_status "Azure CLI is installed"
            ;;
        aws)
            if ! command -v aws &> /dev/null; then
                print_error "AWS CLI is not installed"
                exit 1
            fi
            print_status "AWS CLI is installed"
            ;;
    esac
    
    echo ""
}

# Function to validate environment configuration
validate_environment() {
    echo -e "${BLUE}Validating environment configuration...${NC}"
    
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        print_error "Environment file .env.$ENVIRONMENT not found"
        print_warning "Please copy .env.production.example to .env.$ENVIRONMENT and configure it"
        exit 1
    fi
    print_status "Environment file found"
    
    # Source the environment file
    source ".env.$ENVIRONMENT"
    
    # Check required variables
    required_vars=(
        "POSTGRES_PASSWORD"
        "JWT_SECRET"
        "API_KEY_SALT"
        "OPENAI_API_KEY"
        "PINECONE_API_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    print_status "Required environment variables are set"
    
    echo ""
}

# Function to build services
build_services() {
    echo -e "${BLUE}Building services...${NC}"
    
    services=("atlassian-sync-service" "knowledge-graph-service" "llm-rag-service" "knowledge-graph-server")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            echo -e "${YELLOW}Building $service...${NC}"
            cd "$service"
            
            # Install dependencies
            npm ci --only=production
            
            # Generate Prisma client if schema exists
            if [ -f "prisma/schema.prisma" ]; then
                npx prisma generate
            fi
            
            # Build TypeScript
            npm run build
            
            cd ..
            print_status "$service built successfully"
        else
            print_warning "$service directory not found, skipping"
        fi
    done
    
    echo ""
}

# Function to run database migrations
run_migrations() {
    echo -e "${BLUE}Running database migrations...${NC}"
    
    services_with_db=("atlassian-sync-service" "knowledge-graph-service" "llm-rag-service")
    
    for service in "${services_with_db[@]}"; do
        if [ -d "$service" ] && [ -f "$service/prisma/schema.prisma" ]; then
            echo -e "${YELLOW}Running migrations for $service...${NC}"
            cd "$service"
            
            # Set the appropriate database URL
            case $service in
                "atlassian-sync-service")
                    export DATABASE_URL="postgresql://cogni_sync:$POSTGRES_PASSWORD@localhost:5432/atlassian_sync"
                    ;;
                "knowledge-graph-service")
                    export DATABASE_URL="postgresql://cogni_sync:$POSTGRES_PASSWORD@localhost:5432/knowledge_graph"
                    ;;
                "llm-rag-service")
                    export DATABASE_URL="postgresql://cogni_sync:$POSTGRES_PASSWORD@localhost:5432/llm_rag"
                    ;;
            esac
            
            npx prisma migrate deploy
            cd ..
            print_status "$service migrations completed"
        fi
    done
    
    echo ""
}

# Function to deploy with Docker
deploy_docker() {
    echo -e "${BLUE}Deploying with Docker...${NC}"
    
    # Copy environment file
    cp ".env.$ENVIRONMENT" ".env"
    
    # Stop existing containers
    docker-compose -f docker-compose.production.yml down
    
    # Build and start services
    docker-compose -f docker-compose.production.yml up --build -d
    
    # Wait for services to be healthy
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 30
    
    # Check service health
    services=("atlassian-sync:3002" "knowledge-graph:3001" "llm-rag:3003" "graph-server:4001")
    for service in "${services[@]}"; do
        service_name=$(echo $service | cut -d: -f1)
        port=$(echo $service | cut -d: -f2)
        
        if curl -f "http://localhost:$port/health" &> /dev/null; then
            print_status "$service_name is healthy"
        else
            print_error "$service_name health check failed"
        fi
    done
    
    print_status "Docker deployment completed"
}

# Function to deploy to Vercel
deploy_vercel() {
    echo -e "${BLUE}Deploying to Vercel...${NC}"
    
    services=("atlassian-sync-service" "knowledge-graph-service" "llm-rag-service" "knowledge-graph-server")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            echo -e "${YELLOW}Deploying $service to Vercel...${NC}"
            cd "$service"
            
            # Create vercel.json if it doesn't exist
            if [ ! -f "vercel.json" ]; then
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
            fi
            
            # Deploy to Vercel
            vercel --prod --confirm
            
            cd ..
            print_status "$service deployed to Vercel"
        fi
    done
}

# Function to deploy to Azure
deploy_azure() {
    echo -e "${BLUE}Deploying to Azure...${NC}"
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure. Run: az login"
        exit 1
    fi
    
    # Create resource group if it doesn't exist
    RESOURCE_GROUP="cogni-sync-rg"
    LOCATION="eastus"
    
    if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
        az group create --name $RESOURCE_GROUP --location $LOCATION
        print_status "Created resource group $RESOURCE_GROUP"
    fi
    
    # Deploy using ARM template or Azure CLI commands
    print_warning "Azure deployment requires additional configuration"
    print_warning "Please refer to the deployment guide for detailed Azure setup"
}

# Function to deploy to AWS
deploy_aws() {
    echo -e "${BLUE}Deploying to AWS...${NC}"
    
    # Check if AWS CLI is configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Run: aws configure"
        exit 1
    fi
    
    print_warning "AWS deployment requires additional configuration"
    print_warning "Please refer to the deployment guide for detailed AWS setup"
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    echo -e "${BLUE}Running post-deployment tests...${NC}"
    
    # Basic health checks
    if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
        endpoints=(
            "http://localhost:3002/health"
            "http://localhost:3001/api/v1/health"
            "http://localhost:3003/health"
            "http://localhost:4001/health"
        )
        
        for endpoint in "${endpoints[@]}"; do
            if curl -f "$endpoint" &> /dev/null; then
                print_status "Health check passed: $endpoint"
            else
                print_error "Health check failed: $endpoint"
            fi
        done
    fi
    
    echo ""
}

# Function to display deployment summary
display_summary() {
    echo -e "${BLUE}Deployment Summary${NC}"
    echo -e "${BLUE}==================${NC}"
    echo -e "Deployment Type: ${GREEN}$DEPLOYMENT_TYPE${NC}"
    echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
    echo -e "Status: ${GREEN}Completed${NC}"
    echo ""
    
    if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
        echo -e "${BLUE}Service URLs:${NC}"
        echo -e "Atlassian Sync Service: ${YELLOW}http://localhost:3002${NC}"
        echo -e "Knowledge Graph Service: ${YELLOW}http://localhost:3001${NC}"
        echo -e "LLM-RAG Service: ${YELLOW}http://localhost:3003${NC}"
        echo -e "Knowledge Graph Server: ${YELLOW}http://localhost:4001${NC}"
        echo ""
        echo -e "${BLUE}Management URLs:${NC}"
        echo -e "PostgreSQL: ${YELLOW}localhost:5432${NC}"
        echo -e "Neo4j Browser: ${YELLOW}http://localhost:7474${NC}"
        echo -e "Redis: ${YELLOW}localhost:6379${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo -e "${YELLOW}📖 For more information, see PRODUCTION_DEPLOYMENT_GUIDE.md${NC}"
}

# Main deployment flow
main() {
    check_prerequisites
    validate_environment
    build_services
    
    case $DEPLOYMENT_TYPE in
        docker)
            deploy_docker
            run_post_deployment_tests
            ;;
        vercel)
            deploy_vercel
            ;;
        azure)
            deploy_azure
            ;;
        aws)
            deploy_aws
            ;;
        *)
            print_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            echo "Supported types: docker, vercel, azure, aws"
            exit 1
            ;;
    esac
    
    display_summary
}

# Handle script interruption
trap 'echo -e "\n${RED}Deployment interrupted${NC}"; exit 1' INT

# Run main function
main