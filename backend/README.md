# HomeAssistant Smart Insight Backend

A secure backend API proxy service for the HomeAssistant Smart Insight WebApp that provides enhanced security, authentication, and API key management.

## 🔒 Security Features

- **JWT Authentication** with configurable expiration
- **Rate Limiting** to prevent abuse
- **CORS Protection** with configurable origins
- **Security Headers** (HSTS, CSP, etc.)
- **Request Validation** with express-validator
- **Structured Logging** with security event tracking
- **API Key Management** (stored securely on backend)
- **Session Management** with Redis support
- **Suspicious Activity Detection**
- **Graceful Error Handling**

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Redis (optional, for caching and sessions)

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3001

# Security Configuration (REQUIRED)
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
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
# Generate JWT secret
openssl rand -base64 64

# Generate session secret
openssl rand -base64 64
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Security audit
npm run security-audit
```

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Login with email/password | No |
| POST | `/api/auth/logout` | Logout and invalidate session | Yes |
| GET | `/api/auth/me` | Get current user info | Yes |
| POST | `/api/auth/refresh` | Refresh JWT token | Yes |
| POST | `/api/auth/change-password` | Change user password | Yes |

### API Proxies

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/health` | Service health check | No |
| POST | `/api/openai/chat` | OpenAI chat completion proxy | Yes |
| POST | `/api/influxdb/query` | InfluxDB query proxy | Optional |
| ALL | `/api/homeassistant/*` | HomeAssistant API proxy | Yes |

### Cache Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| DELETE | `/api/cache/:key` | Delete specific cache key | Yes (Admin) |
| DELETE | `/api/cache` | Flush all cache | Yes (Admin) |

## 🔐 Authentication

### JWT Authentication

```javascript
// Login request
POST /api/auth/login
{
  "email": "admin@homeassistant.local",
  "password": "admin123"
}

// Response
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "email": "admin@homeassistant.local",
    "role": "admin",
    "permissions": ["*"]
  }
}

// Use token in subsequent requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Default Users

| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| `admin@homeassistant.local` | `admin123` | admin | `*` (all) |
| `user@homeassistant.local` | `user123` | user | `influxdb:read`, `homeassistant:read` |

## 🛡️ Security Configuration

### Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Configurable** via environment variables
- **Bypass** for authenticated admin users

### CORS Policy

```javascript
// Allowed origins (configurable)
const allowedOrigins = [
  'http://localhost:5177',
  'http://192.168.50.141:5177'
];
```

### Security Headers

- **HSTS**: Force HTTPS in production
- **CSP**: Content Security Policy
- **X-Frame-Options**: Prevent clickjacking
- **X-Content-Type-Options**: Prevent MIME sniffing

### Suspicious Activity Detection

Automatically detects and logs:
- SQL injection attempts
- XSS attempts
- Security scanning tools
- Unusual user agents
- Malformed requests

## 📊 Logging

### Log Files

- `logs/combined.log` - All application logs
- `logs/error.log` - Error logs only
- `logs/security.log` - Security events
- `logs/http.log` - HTTP request logs
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

### Log Levels

- **error**: Application errors
- **warn**: Warnings and suspicious activity
- **security**: Authentication and authorization events
- **info**: General application information
- **http**: HTTP request/response logs
- **debug**: Detailed debugging information

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY logs ./logs

EXPOSE 3001
CMD ["npm", "start"]
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong JWT and session secrets
- [ ] Configure proper CORS origins
- [ ] Set up Redis for caching and sessions
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Enable HTTPS with proper certificates
- [ ] Configure firewall rules
- [ ] Set up backup for logs and data

### Environment Variables Validation

The application validates all environment variables on startup:

- **Required in production**: `JWT_SECRET`, `SESSION_SECRET`
- **Minimum lengths**: JWT secret (64 chars), Session secret (32 chars)
- **Format validation**: URLs, email addresses, numbers

## 🔧 Configuration

### Cache Configuration

```javascript
// Hybrid caching (Redis + Memory)
const cacheConfig = {
  redis: {
    url: process.env.REDIS_URL, // Optional
  },
  ttl: {
    default: 300,        // 5 minutes
    influxData: 60,      // 1 minute
    homeassistantEntities: 300,  // 5 minutes
    automationSuggestions: 1800, // 30 minutes
  }
};
```

### Rate Limiting Configuration

```javascript
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // requests per window
  message: {
    error: 'Too many requests',
    retryAfter: 900
  }
};
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Security Tests

```bash
npm run security-audit
npm audit
snyk test
```

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Metrics Endpoint

```bash
curl http://localhost:3001/api/metrics
```

### Log Monitoring

```bash
# Follow logs in real-time
tail -f logs/combined.log

# Monitor security events
tail -f logs/security.log

# Check for errors
tail -f logs/error.log
```

## 🔍 Troubleshooting

### Common Issues

1. **JWT Secret Too Short**
   ```
   Error: JWT secret must be at least 32 characters
   ```
   Solution: Generate a longer secret with `openssl rand -base64 64`

2. **CORS Errors**
   ```
   Access to fetch at 'http://localhost:3001/api/...' has been blocked by CORS policy
   ```
   Solution: Add your frontend URL to `ALLOWED_ORIGINS`

3. **Rate Limit Exceeded**
   ```
   HTTP 429: Too many requests
   ```
   Solution: Wait for the rate limit window to reset or increase limits

4. **InfluxDB Connection Failed**
   ```
   InfluxDB service not configured
   ```
   Solution: Check `INFLUXDB_URL` and network connectivity

### Debug Mode

```bash
# Enable debug logging
NODE_ENV=development npm run dev

# Check logs
tail -f logs/combined.log | grep debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run security audit
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and API docs at `/api/docs`
- **Logs**: Check application logs in the `logs/` directory
- **Issues**: Create an issue on GitHub with logs and configuration details 