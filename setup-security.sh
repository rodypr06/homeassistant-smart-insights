#!/bin/bash

# HomeAssistant Smart Insight - Enhanced Security Setup Script
# This script sets up the secure backend API proxy service

set -e

echo "🔒 HomeAssistant Smart Insight - Enhanced Security Setup"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check openssl
    if ! command -v openssl &> /dev/null; then
        log_warning "OpenSSL not found. You'll need to generate secrets manually."
    fi
    
    log_success "Prerequisites check passed"
}

# Setup backend
setup_backend() {
    log_info "Setting up backend..."
    
    # Create backend directory if it doesn't exist
    if [ ! -d "backend" ]; then
        log_error "Backend directory not found. Please run this script from the project root."
        exit 1
    fi
    
    cd backend
    
    # Install dependencies
    log_info "Installing backend dependencies..."
    npm install
    
    # Create logs directory
    mkdir -p logs
    
    # Generate environment file
    if [ ! -f ".env" ]; then
        log_info "Creating environment configuration..."
        
        # Generate secure secrets
        if command -v openssl &> /dev/null; then
            JWT_SECRET=$(openssl rand -base64 64)
            SESSION_SECRET=$(openssl rand -base64 64)
        else
            log_warning "OpenSSL not available. Using placeholder secrets."
            JWT_SECRET="your-super-secure-jwt-secret-key-at-least-64-characters-long-please-change-this"
            SESSION_SECRET="your-super-secure-session-secret-key-at-least-32-characters-long"
        fi
        
        cat > .env << EOF
# Server Configuration
NODE_ENV=development
PORT=3001

# Security Configuration (REQUIRED)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
SESSION_SECRET=${SESSION_SECRET}

# API Keys (Optional - add your keys here)
# OPENAI_API_KEY=sk-your-openai-api-key-here
# HOMEASSISTANT_TOKEN=your-homeassistant-long-lived-access-token

# InfluxDB Configuration
INFLUXDB_URL=http://192.168.50.101:8086
# INFLUXDB_TOKEN=your-influxdb-token-if-needed
INFLUXDB_ORG=home_assistant
INFLUXDB_BUCKET=home_assistant/autogen

# HomeAssistant Configuration
HOMEASSISTANT_URL=http://192.168.50.150:8123

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5177,http://192.168.50.141:5177

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security Headers
ENABLE_HSTS=true
ENABLE_CSP=true

# Cache Configuration (Optional)
# REDIS_URL=redis://localhost:6379
EOF
        
        log_success "Environment file created at backend/.env"
    else
        log_warning "Environment file already exists. Skipping creation."
    fi
    
    cd ..
}

# Setup frontend configuration
setup_frontend() {
    log_info "Setting up frontend configuration..."
    
    # Check if .env exists, create if not
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001

# Optional: Enable debug logging
VITE_DEBUG=true
EOF
        log_success "Frontend environment file created"
    else
        # Check if VITE_BACKEND_URL exists
        if ! grep -q "VITE_BACKEND_URL" .env; then
            echo "" >> .env
            echo "# Backend API URL" >> .env
            echo "VITE_BACKEND_URL=http://localhost:3001" >> .env
            log_success "Added backend URL to existing .env file"
        else
            log_warning "Frontend environment already configured"
        fi
    fi
}

# Test setup
test_setup() {
    log_info "Testing setup..."
    
    cd backend
    
    # Build the backend
    log_info "Building backend..."
    npm run build
    
    # Start backend in background for testing
    log_info "Starting backend for testing..."
    npm start &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 5
    
    # Test health endpoint
    if curl -s http://localhost:3001/health > /dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    # Test authentication endpoint
    AUTH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@homeassistant.local","password":"admin123"}' \
        -w "%{http_code}")
    
    if [[ $AUTH_RESPONSE == *"200" ]]; then
        log_success "Authentication test passed"
    else
        log_error "Authentication test failed"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    
    # Stop test backend
    kill $BACKEND_PID 2>/dev/null || true
    
    cd ..
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo "================================"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Start the backend server:"
    echo "   cd backend && npm run dev"
    echo ""
    echo "2. Start the frontend server (in another terminal):"
    echo "   npm run dev"
    echo ""
    echo "3. Open your browser and navigate to:"
    echo "   http://localhost:5177"
    echo ""
    echo "4. Test authentication with default credentials:"
    echo "   Email: admin@homeassistant.local"
    echo "   Password: admin123"
    echo ""
    echo "5. Configure your API keys in backend/.env:"
    echo "   - OPENAI_API_KEY (for AI features)"
    echo "   - HOMEASSISTANT_TOKEN (for HomeAssistant integration)"
    echo ""
    echo "📚 Documentation:"
    echo "   - Backend: backend/README.md"
    echo "   - Security: SECURITY_SETUP.md"
    echo ""
    echo "🔍 Monitoring:"
    echo "   - Health check: http://localhost:3001/health"
    echo "   - API docs: http://localhost:3001/api/docs"
    echo "   - Logs: backend/logs/"
    echo ""
    echo "⚠️  Security Notes:"
    echo "   - Change default passwords in production"
    echo "   - Add your API keys to backend/.env"
    echo "   - Enable HTTPS for production deployment"
    echo "   - Monitor security logs regularly"
}

# Main execution
main() {
    echo ""
    log_info "Starting enhanced security setup..."
    echo ""
    
    check_prerequisites
    setup_backend
    setup_frontend
    test_setup
    show_next_steps
    
    echo ""
    log_success "Enhanced security setup completed! 🔒✨"
}

# Run main function
main "$@" 