#!/bin/sh

# Enhanced Docker entrypoint script for HomeAssistant Smart Insights
# This script handles runtime environment variable injection and building

set -e

echo "🏠 HomeAssistant Smart Insights - Enhanced Runtime Setup..."

# Function to validate required environment variables
validate_env() {
    local missing_vars=""
    
    # Check required variables
    if [ -z "$VITE_OPENAI_API_KEY" ] || [ "$VITE_OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
        missing_vars="$missing_vars VITE_OPENAI_API_KEY"
    fi
    
    if [ -z "$VITE_INFLUXDB_URL" ] || [ "$VITE_INFLUXDB_URL" = "your_influxdb_url_here" ]; then
        missing_vars="$missing_vars VITE_INFLUXDB_URL"
    fi
    
    if [ -z "$VITE_INFLUXDB_TOKEN" ] || [ "$VITE_INFLUXDB_TOKEN" = "your_influxdb_token_here" ]; then
        missing_vars="$missing_vars VITE_INFLUXDB_TOKEN"
    fi
    
    if [ -z "$VITE_INFLUXDB_ORG" ] || [ "$VITE_INFLUXDB_ORG" = "your_org_here" ]; then
        missing_vars="$missing_vars VITE_INFLUXDB_ORG"
    fi
    
    if [ -z "$VITE_INFLUXDB_BUCKET" ] || [ "$VITE_INFLUXDB_BUCKET" = "your_bucket_here" ]; then
        missing_vars="$missing_vars VITE_INFLUXDB_BUCKET"
    fi
    
    if [ -n "$missing_vars" ]; then
        echo "❌ Missing required environment variables:$missing_vars"
        echo ""
        echo "🔧 Please set the following environment variables:"
        echo "   VITE_OPENAI_API_KEY=sk-your-openai-api-key"
        echo "   VITE_INFLUXDB_URL=http://your-influxdb:8086"
        echo "   VITE_INFLUXDB_TOKEN=your-influxdb-token"
        echo "   VITE_INFLUXDB_ORG=your-organization"
        echo "   VITE_INFLUXDB_BUCKET=home_assistant/autogen"
        echo ""
        echo "📚 See README.md for detailed setup instructions"
        exit 1
    fi
    
    echo "✅ Required environment variables are configured"
}

# Function to inject environment variables into built files
inject_env_vars() {
    echo "🔧 Injecting runtime environment variables..."
    
    # Find all JS files in the built application
    find /usr/share/nginx/html -name "*.js" -type f | while read -r file; do
        # Replace placeholder values with actual environment variables
        sed -i "s|VITE_OPENAI_API_KEY_PLACEHOLDER|$VITE_OPENAI_API_KEY|g" "$file"
        sed -i "s|VITE_INFLUXDB_URL_PLACEHOLDER|$VITE_INFLUXDB_URL|g" "$file"
        sed -i "s|VITE_INFLUXDB_TOKEN_PLACEHOLDER|$VITE_INFLUXDB_TOKEN|g" "$file"
        sed -i "s|VITE_INFLUXDB_ORG_PLACEHOLDER|$VITE_INFLUXDB_ORG|g" "$file"
        sed -i "s|VITE_INFLUXDB_BUCKET_PLACEHOLDER|$VITE_INFLUXDB_BUCKET|g" "$file"
        
        # Optional variables (only replace if set)
        if [ -n "$VITE_HOMEASSISTANT_URL" ] && [ "$VITE_HOMEASSISTANT_URL" != "your_homeassistant_url_here" ]; then
            sed -i "s|VITE_HOMEASSISTANT_URL_PLACEHOLDER|$VITE_HOMEASSISTANT_URL|g" "$file"
        else
            sed -i "s|VITE_HOMEASSISTANT_URL_PLACEHOLDER|NOT_SET|g" "$file"
        fi
        
        if [ -n "$VITE_HOMEASSISTANT_TOKEN" ] && [ "$VITE_HOMEASSISTANT_TOKEN" != "your_homeassistant_token_here" ]; then
            sed -i "s|VITE_HOMEASSISTANT_TOKEN_PLACEHOLDER|$VITE_HOMEASSISTANT_TOKEN|g" "$file"
        else
            sed -i "s|VITE_HOMEASSISTANT_TOKEN_PLACEHOLDER|NOT_SET|g" "$file"
        fi
    done
    
    echo "✅ Environment variables injected successfully"
}

# Function to show configuration summary
show_config_summary() {
    echo ""
    echo "📋 Configuration Summary:"
    echo "   OpenAI API Key: ${VITE_OPENAI_API_KEY:0:10}..."
    echo "   InfluxDB URL: $VITE_INFLUXDB_URL"
    echo "   InfluxDB Org: $VITE_INFLUXDB_ORG"
    echo "   InfluxDB Bucket: $VITE_INFLUXDB_BUCKET"
    
    if [ -n "$VITE_HOMEASSISTANT_URL" ] && [ "$VITE_HOMEASSISTANT_URL" != "NOT_SET" ]; then
        echo "   HomeAssistant URL: $VITE_HOMEASSISTANT_URL"
        echo "   HomeAssistant Token: ${VITE_HOMEASSISTANT_TOKEN:0:10}..."
    else
        echo "   HomeAssistant: Not configured (optional)"
    fi
    echo ""
}

# Function to build application with runtime environment variables
build_application() {
    echo "🔨 Building application with runtime environment variables..."
    
    cd /usr/src/app
    
    # Create .env file with runtime variables
    cat > .env << EOF
VITE_OPENAI_API_KEY=$VITE_OPENAI_API_KEY
VITE_INFLUXDB_URL=$VITE_INFLUXDB_URL
VITE_INFLUXDB_TOKEN=$VITE_INFLUXDB_TOKEN
VITE_INFLUXDB_ORG=$VITE_INFLUXDB_ORG
VITE_INFLUXDB_BUCKET=$VITE_INFLUXDB_BUCKET
VITE_HOMEASSISTANT_URL=${VITE_HOMEASSISTANT_URL:-NOT_SET}
VITE_HOMEASSISTANT_TOKEN=${VITE_HOMEASSISTANT_TOKEN:-NOT_SET}
EOF
    
    echo "📦 Running npm build with runtime environment..."
    npm run build
    
    echo "📁 Copying built files to nginx directory..."
    cp -r dist/* /usr/share/nginx/html/
    
    echo "✅ Application built successfully with runtime configuration"
}

# Function to create health endpoint
create_health_endpoint() {
    echo "🏥 Creating health check endpoint..."
    cat > /usr/share/nginx/html/health << 'EOF'
{
  "status": "healthy",
  "timestamp": "$(date -Iseconds)",
  "service": "homeassistant-smart-insights",
  "version": "1.0.0"
}
EOF
}

# Main execution
echo "🔍 Validating environment configuration..."
validate_env

show_config_summary

echo "🔨 Building application with runtime environment variables..."
build_application

echo "🏥 Setting up health check..."
create_health_endpoint

echo "🚀 Starting nginx..."

# Execute the original nginx entrypoint
exec /docker-entrypoint.sh "$@" 