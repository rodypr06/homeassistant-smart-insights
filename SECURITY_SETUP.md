# Enhanced Security Setup Guide

This guide walks you through setting up the enhanced security backend for the HomeAssistant Smart Insight WebApp.

## 🔒 Security Architecture Overview

The enhanced security system provides:

- **Backend API Proxy**: Secure server that handles all external API calls
- **JWT Authentication**: Token-based authentication with configurable expiration
- **API Key Protection**: API keys stored securely on backend, never exposed to frontend
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Request Validation**: Input validation and sanitization
- **Security Logging**: Comprehensive audit trail
- **CORS Protection**: Configurable cross-origin resource sharing
- **Caching Layer**: Redis-backed caching for performance

## 🚀 Quick Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env
echo "SESSION_SECRET=$(openssl rand -base64 64)" >> .env

# Add your API keys (optional)
echo "OPENAI_API_KEY=your-openai-key-here" >> .env
echo "HOMEASSISTANT_TOKEN=your-ha-token-here" >> .env

# Start development server
npm run dev
```

### 2. Frontend Configuration

Add to your frontend `.env` file:

```env
VITE_BACKEND_URL=http://localhost:3001
```

### 3. Test the Setup

```bash
# Check backend health
curl http://localhost:3001/health

# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@homeassistant.local","password":"admin123"}'
```

## 📋 Complete Setup Instructions

### Prerequisites

- Node.js 18+
- Redis (optional, for caching)
- OpenSSL (for generating secrets)

### Backend Environment Configuration

Create `backend/.env` with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Security Configuration (REQUIRED)
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-64-characters-long
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-super-secure-session-secret-key-at-least-32-characters-long

# API Keys (Optional - enables proxy features)
OPENAI_API_KEY=sk-your-openai-api-key-here
HOMEASSISTANT_TOKEN=your-homeassistant-long-lived-access-token

# InfluxDB Configuration
INFLUXDB_URL=http://192.168.50.101:8086
INFLUXDB_TOKEN=your-influxdb-token-if-needed
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
REDIS_URL=redis://localhost:6379
```

### Generate Secure Secrets

```bash
# Generate JWT secret (64+ characters recommended)
openssl rand -base64 64

# Generate session secret (32+ characters minimum)
openssl rand -base64 32

# Generate API key for service-to-service communication
echo "ha-si-$(openssl rand -hex 16)"
```

### Frontend Environment Configuration

Create or update your frontend `.env` file:

```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:3001

# Optional: Enable debug logging
VITE_DEBUG=true
```

## 🔐 Authentication Setup

### Default Users

The system comes with two default users:

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| `admin@homeassistant.local` | `admin123` | admin | `*` (all permissions) |
| `user@homeassistant.local` | `user123` | user | `influxdb:read`, `homeassistant:read` |

### Creating Custom Users

In production, replace the mock user database with a real database. For development, you can modify the users in `backend/src/routes/auth.ts`.

### Password Hashing

Generate password hashes for new users:

```bash
node -e "
const bcrypt = require('bcryptjs');
const password = 'your-password-here';
const hash = bcrypt.hashSync(password, 10);
console.log('Password hash:', hash);
"
```

## 🛡️ Security Configuration

### Rate Limiting

Configure rate limiting in your environment:

```env
# 100 requests per 15 minutes (default)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### CORS Configuration

Add your frontend URLs to allowed origins:

```env
ALLOWED_ORIGINS=http://localhost:5177,http://192.168.50.141:5177,https://yourdomain.com
```

### Security Headers

Enable security headers for production:

```env
ENABLE_HSTS=true
ENABLE_CSP=true
```

## 🚀 Production Deployment

### Docker Deployment

```bash
# Build and start with Docker Compose
cd backend
docker-compose up -d

# Or build manually
docker build -t ha-smart-insight-backend .
docker run -d -p 3001:3001 --env-file .env ha-smart-insight-backend
```

### Production Environment Variables

```env
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret-64-characters-minimum
SESSION_SECRET=your-production-session-secret-32-characters-minimum
REDIS_URL=redis://your-redis-server:6379
ALLOWED_ORIGINS=https://yourdomain.com
ENABLE_HSTS=true
ENABLE_CSP=true
```

### SSL/TLS Configuration

For production, use HTTPS with proper certificates:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📊 Monitoring and Logging

### Log Files

The backend creates several log files:

- `logs/combined.log` - All application logs
- `logs/error.log` - Error logs only
- `logs/security.log` - Security events
- `logs/http.log` - HTTP request logs

### Health Monitoring

```bash
# Check backend health
curl http://localhost:3001/health

# Check with authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3001/api/health
```

### Security Event Monitoring

Monitor security events in real-time:

```bash
tail -f backend/logs/security.log
```

## 🔧 Frontend Integration

### Using the Secure API Service

```typescript
import { secureApiService } from './services/secureApiService';

// Login
const loginResponse = await secureApiService.login({
  email: 'admin@homeassistant.local',
  password: 'admin123'
});

// Make authenticated requests
const influxData = await secureApiService.queryInfluxDB(
  'SELECT * FROM "%" WHERE time > now() - 1h',
  'home_assistant'
);

// OpenAI requests (API key handled securely on backend)
const chatResponse = await secureApiService.chatCompletion([
  { role: 'user', content: 'Analyze my home energy usage' }
]);
```

### Authentication State Management

```typescript
// Check if user is authenticated
if (secureApiService.isAuthenticated()) {
  const user = await secureApiService.getCurrentUser();
  console.log('Current user:', user);
}

// Listen for auth events
window.addEventListener('auth:unauthorized', () => {
  // Redirect to login page
  window.location.href = '/login';
});

window.addEventListener('api:rateLimit', (event) => {
  const { retryAfter } = event.detail;
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
});
```

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Security audit
npm run security-audit
```

### API Testing

```bash
# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@homeassistant.local","password":"admin123"}'

# Test InfluxDB proxy
curl -X POST http://localhost:3001/api/influxdb/query \
  -H "Content-Type: application/json" \
  -d '{"query":"SHOW DATABASES","database":"home_assistant"}'

# Test with authentication
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔍 Troubleshooting

### Common Issues

1. **Backend won't start**
   ```
   Error: JWT secret must be at least 32 characters
   ```
   Solution: Generate proper secrets with `openssl rand -base64 64`

2. **CORS errors**
   ```
   Access blocked by CORS policy
   ```
   Solution: Add your frontend URL to `ALLOWED_ORIGINS`

3. **Authentication fails**
   ```
   Invalid credentials
   ```
   Solution: Check default credentials or create new user

4. **Rate limit exceeded**
   ```
   HTTP 429: Too many requests
   ```
   Solution: Wait for rate limit window to reset

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development npm run dev
```

Check logs:

```bash
tail -f backend/logs/combined.log
```

## 📈 Performance Optimization

### Caching

Enable Redis caching for better performance:

```env
REDIS_URL=redis://localhost:6379
```

### Rate Limiting Tuning

Adjust rate limits based on your needs:

```env
# Higher limits for production
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=500  # 500 requests per window
```

## 🔒 Security Best Practices

1. **Use strong secrets**: Generate with `openssl rand -base64 64`
2. **Enable HTTPS**: Use proper SSL certificates in production
3. **Regular updates**: Keep dependencies updated
4. **Monitor logs**: Watch for suspicious activity
5. **Backup secrets**: Store secrets securely
6. **Rotate tokens**: Regularly rotate JWT and API keys
7. **Limit permissions**: Use principle of least privilege
8. **Network security**: Use firewalls and VPNs

## 📞 Support

- **Documentation**: Check backend README.md
- **Logs**: Monitor `backend/logs/` directory
- **Health check**: `GET /health` endpoint
- **API docs**: `GET /api/docs` endpoint

## 🎯 Next Steps

1. Set up monitoring with Prometheus/Grafana
2. Implement user management interface
3. Add two-factor authentication
4. Set up automated backups
5. Configure log rotation
6. Implement audit trails
7. Add API versioning
8. Set up CI/CD pipeline 