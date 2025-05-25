#!/bin/bash

# HomeAssistant Smart Insights - Docker Deployment Script
# This script helps you get started with Docker deployment

set -e

echo "🏠 HomeAssistant Smart Insights - Docker Setup"
echo "=============================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit .env file with your configuration:"
        echo "   - VITE_OPENAI_API_KEY=your_openai_api_key"
        echo "   - VITE_INFLUXDB_URL=http://your-influxdb:8086"
        echo "   - VITE_INFLUXDB_TOKEN=your_token"
        echo "   - And other required variables..."
        echo ""
        read -p "Press Enter after you've configured .env file..."
    else
        echo "❌ .env.example file not found. Please create .env file manually."
        exit 1
    fi
else
    echo "✅ .env file found"
fi

# Ask user which deployment type
echo ""
echo "Choose deployment type:"
echo "1) Development (docker-compose.yml) - Port 3000"
echo "2) Production (docker-compose.prod.yml) - Port 80 with SSL"
echo ""
read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        echo "🚀 Starting development deployment..."
        docker-compose up -d
        echo ""
        echo "✅ Development deployment started!"
        echo "🌐 Access your application at: http://localhost:3000"
        echo ""
        echo "Useful commands:"
        echo "  View logs: docker-compose logs -f smart-insights"
        echo "  Stop: docker-compose down"
        echo "  Rebuild: docker-compose build --no-cache"
        ;;
    2)
        echo "🚀 Starting production deployment..."
        echo "⚠️  Make sure you've configured your domain in docker-compose.prod.yml"
        echo "⚠️  Make sure you've set your email for SSL certificates"
        echo ""
        read -p "Continue with production deployment? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            docker-compose -f docker-compose.prod.yml up -d
            echo ""
            echo "✅ Production deployment started!"
            echo "🌐 Access your application at: http://your-domain.com"
            echo "🔒 SSL certificates will be automatically generated"
            echo ""
            echo "Useful commands:"
            echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f smart-insights"
            echo "  Stop: docker-compose -f docker-compose.prod.yml down"
            echo "  Rebuild: docker-compose -f docker-compose.prod.yml build --no-cache"
        else
            echo "❌ Production deployment cancelled"
            exit 1
        fi
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📚 For more information, check the README.md file"
echo "🐛 If you encounter issues, check the logs with the commands above" 