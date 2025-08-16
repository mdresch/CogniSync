#!/bin/bash

# Kubernetes Deployment Script for CogniSync
# This script deploys all CogniSync services to a Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 CogniSync Kubernetes Deployment${NC}"
echo -e "${BLUE}===================================${NC}"

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

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "Connected to Kubernetes cluster"

# Create namespace
echo -e "${BLUE}Creating namespace...${NC}"
kubectl apply -f namespace.yaml
print_status "Namespace created"

# Apply secrets (make sure to update secrets.yaml with real values first)
echo -e "${BLUE}Applying secrets...${NC}"
if [ ! -f "secrets.yaml" ]; then
    print_error "secrets.yaml not found. Please create it from the template."
    exit 1
fi

print_warning "Make sure you've updated secrets.yaml with real values!"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Deployment cancelled"
    exit 1
fi

kubectl apply -f secrets.yaml
print_status "Secrets applied"

# Apply config map
echo -e "${BLUE}Applying configuration...${NC}"
kubectl apply -f configmap.yaml
print_status "ConfigMap applied"

# Deploy PostgreSQL
echo -e "${BLUE}Deploying PostgreSQL...${NC}"
kubectl apply -f postgres-deployment.yaml
print_status "PostgreSQL deployment created"

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
kubectl wait --for=condition=ready pod -l app=postgres -n cogni-sync --timeout=300s
print_status "PostgreSQL is ready"

# Deploy services
services=("atlassian-sync" "knowledge-graph" "llm-rag")

for service in "${services[@]}"; do
    echo -e "${BLUE}Deploying $service...${NC}"
    kubectl apply -f "${service}-deployment.yaml"
    print_status "$service deployment created"
done

# Wait for all deployments to be ready
echo -e "${YELLOW}Waiting for all services to be ready...${NC}"
for service in "${services[@]}"; do
    kubectl wait --for=condition=available deployment/$service -n cogni-sync --timeout=300s
    print_status "$service is ready"
done

# Display service information
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}==================${NC}"

echo -e "${YELLOW}Pods:${NC}"
kubectl get pods -n cogni-sync

echo -e "\n${YELLOW}Services:${NC}"
kubectl get services -n cogni-sync

echo -e "\n${YELLOW}Ingresses:${NC}"
kubectl get ingress -n cogni-sync

echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📖 Check the ingress URLs above for service endpoints${NC}"

# Optional: Port forwarding for local testing
read -p "Set up port forwarding for local testing? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Setting up port forwarding...${NC}"
    echo -e "${YELLOW}Run these commands in separate terminals:${NC}"
    echo "kubectl port-forward -n cogni-sync service/atlassian-sync 3002:3002"
    echo "kubectl port-forward -n cogni-sync service/knowledge-graph 3001:3001"
    echo "kubectl port-forward -n cogni-sync service/llm-rag 3003:3003"
    echo "kubectl port-forward -n cogni-sync service/postgres 5432:5432"
fi