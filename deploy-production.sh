#!/bin/bash

# Production Deployment Script for AI Agent API
# This script sets up and deploys the AI Agent API for production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_status "Starting production deployment..."

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Docker and Docker Compose are available"

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

print_success ".env file found"

# Create SSL directory if it doesn't exist
if [ ! -d ssl ]; then
    print_status "Creating SSL directory..."
    mkdir -p ssl
fi

# Check if SSL certificates exist
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    print_warning "SSL certificates not found. Creating self-signed certificates for development..."
    
    # Generate self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    
    print_success "Self-signed SSL certificates created"
    print_warning "For production, replace these with proper SSL certificates from a trusted CA"
fi

# Build the Docker image
print_status "Building Docker image..."
docker-compose build --no-cache

if [ $? -eq 0 ]; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Stop any existing containers
print_status "Stopping existing containers..."
docker-compose down

# Start the services
print_status "Starting services..."
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 30

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_success "Services are running"
else
    print_error "Some services failed to start"
    docker-compose logs
    exit 1
fi

# Check health endpoint
print_status "Checking API health..."
if curl -f -s http://localhost/health > /dev/null; then
    print_success "API is healthy and responding"
else
    print_warning "API health check failed, but services are running"
fi

# Display service information
print_status "Deployment completed successfully!"
echo ""
echo "Service Information:"
echo "==================="
echo "API URL: https://localhost"
echo "Health Check: https://localhost/health"
echo "API Documentation: https://localhost/docs"
echo "API Status: https://localhost/api/status"
echo ""
echo "Container Status:"
docker-compose ps
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop services: docker-compose down"
echo "To restart services: docker-compose restart"
echo ""
print_warning "Remember to:"
echo "1. Replace self-signed SSL certificates with proper ones for production"
echo "2. Update ALLOWED_ORIGINS in .env with your production domain"
echo "3. Set up proper monitoring and logging"
echo "4. Configure backup strategies for Redis data"
echo "5. Set up proper firewall rules" 