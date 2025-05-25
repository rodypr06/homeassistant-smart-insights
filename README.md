# 🏠 HomeAssistant Smart Insights

A sophisticated web application that transforms your HomeAssistant sensor data into actionable insights using AI-powered natural language queries and beautiful visualizations.

![HomeAssistant Smart Insights](https://img.shields.io/badge/HomeAssistant-Smart%20Insights-blue?style=for-the-badge&logo=home-assistant)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)

## ✨ Features

### 🤖 AI-Powered Query Processing
- **Natural Language Queries**: Ask questions in plain English about your sensor data
- **OpenAI Integration**: GPT-4 converts your questions into optimized Flux queries
- **Conversational Insights**: Chat with AI to refine and modify your reports

### 📊 Advanced Data Visualization
- **Interactive Charts**: Beautiful, responsive charts with gradient styling
- **Real-time Data**: Live connection to your InfluxDB instance
- **Friendly Entity Names**: Automatic conversion of technical IDs to readable names
- **CSV Export**: Download your data for further analysis

### 🎨 Modern UI/UX
- **Glass-morphism Design**: Sophisticated gradient backgrounds and backdrop blur effects
- **Dark/Light Mode**: Seamless theme switching
- **Responsive Layout**: Works perfectly on desktop and mobile
- **Smooth Animations**: Polished interactions with hover effects and transitions

### 📈 Smart Analytics
- **AI-Generated Reports**: Comprehensive insights with trends and recommendations
- **PDF Export**: Professional reports with branded layout
- **Chat Interface**: Interactive conversations to modify and enhance reports
- **Data Summarization**: Intelligent processing of large datasets

## 🚀 Quick Start

### Prerequisites
- **For Docker deployment:** Docker and Docker Compose
- **For development:** Node.js 18+ and npm
- InfluxDB v1.x with Flux queries enabled
- HomeAssistant (optional - for entity metadata)
- OpenAI API key

## 🐳 Docker Deployment (Recommended)

> ✅ **Docker support is fully tested and working!** The application builds into a lightweight 49.7MB image with nginx serving the React app.

### Option 1: Docker Compose (Easiest)

1. **Clone the repository**
   ```bash
   git clone https://github.com/rodypr06/homeassistant-smart-insights.git
   cd homeassistant-smart-insights
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   VITE_OPENAI_API_KEY=your_openai_api_key_here
   VITE_INFLUXDB_URL=http://your-influxdb-host:8086
   VITE_INFLUXDB_TOKEN=your_influxdb_token
   VITE_INFLUXDB_ORG=your_org
   VITE_INFLUXDB_BUCKET=home_assistant/autogen
   VITE_HOMEASSISTANT_URL=http://your-homeassistant:8123
   VITE_HOMEASSISTANT_TOKEN=your_long_lived_access_token
   ```

3. **Deploy with Docker Compose**
   ```bash
   # Quick start with interactive script
   ./docker-start.sh
   
   # Or manually:
   # For development/testing
   docker-compose up -d
   
   # For production with SSL and Traefik
   docker-compose -f docker-compose.prod.yml up -d
   ```

4. **Access the application**
   - Development: `http://localhost:3000`
   - Production: `http://your-domain.com` (after configuring domain)

### Option 2: Docker Build & Run

```bash
# Build the image
docker build -t homeassistant-smart-insights .

# Run the container
docker run -d \
  --name smart-insights \
  -p 3000:80 \
  --env-file .env \
  homeassistant-smart-insights
```

### Option 3: Quick Start Script

```bash
# Use the interactive setup script
chmod +x docker-start.sh
./docker-start.sh
```

### Option 4: Pre-built Image (Coming Soon)

```bash
# Pull and run the pre-built image
docker run -d \
  --name smart-insights \
  -p 3000:80 \
  --env-file .env \
  ghcr.io/rodypr06/homeassistant-smart-insights:latest
```

## 💻 Development Setup

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/rodypr06/homeassistant-smart-insights.git
   cd homeassistant-smart-insights
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration (same as Docker setup above)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🐳 Docker Configuration Details

### Environment Variables for Docker

When using Docker, all environment variables are baked into the build. Make sure your `.env` file is properly configured before building:

```env
# Required
VITE_OPENAI_API_KEY=sk-your-openai-api-key
VITE_INFLUXDB_URL=http://192.168.1.100:8086
VITE_INFLUXDB_TOKEN=your-influxdb-token
VITE_INFLUXDB_ORG=your-org
VITE_INFLUXDB_BUCKET=home_assistant/autogen

# Optional (for enhanced features)
VITE_HOMEASSISTANT_URL=http://192.168.1.100:8123
VITE_HOMEASSISTANT_TOKEN=your-long-lived-access-token
```

### Docker Compose Services

#### Development (`docker-compose.yml`)
- **smart-insights**: Main application on port 3000
- **Optional InfluxDB**: Uncomment to include InfluxDB service

#### Production (`docker-compose.prod.yml`)
- **smart-insights**: Main application with production optimizations
- **traefik**: Reverse proxy with automatic SSL certificates
- **influxdb**: Full InfluxDB service with persistence

### Production Deployment

For production deployment, update the following in `docker-compose.prod.yml`:

1. **Domain Configuration**:
   ```yaml
   - "traefik.http.routers.smart-insights.rule=Host(`your-domain.com`)"
   ```

2. **Email for SSL Certificates**:
   ```yaml
   - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
   ```

3. **InfluxDB Credentials**:
   ```env
   INFLUXDB_ADMIN_PASSWORD=your-secure-password
   ```

### Docker Commands

```bash
# View logs
docker-compose logs -f smart-insights

# Rebuild after changes
docker-compose build --no-cache

# Stop services
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Scale for high availability (production)
docker-compose -f docker-compose.prod.yml up -d --scale smart-insights=3
```

### Docker Architecture
- **Multi-stage build**: Optimized production builds with Node.js build stage and Nginx serving stage
- **Nginx**: High-performance static file serving with gzip compression
- **Health checks**: Container health monitoring with `/health` endpoint
- **Security headers**: Production-ready security configuration
- **SSL/TLS**: Automatic certificate management with Traefik (production)

## 🔧 Configuration

### InfluxDB Setup
Ensure Flux queries are enabled in your InfluxDB configuration:
```toml
[http]
flux-enabled = true
```

### HomeAssistant Integration (Optional)
Generate a Long-Lived Access Token in HomeAssistant:
1. Go to Profile → Security → Long-Lived Access Tokens
2. Create new token and add to your `.env` file

## 📱 Usage Examples

### Natural Language Queries
- "Show me office temperature vs living room for the last 7 days"
- "Generate humidity report for bedroom this month"
- "Compare energy usage between weekdays and weekends"
- "What's the battery level trend for all sensors?"

### AI Chat Features
After generating initial insights, you can:
- "Make this report shorter"
- "Add more details about temperature patterns"
- "Focus on energy efficiency recommendations"
- "Create a summary for the last week"

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **Recharts** for data visualization
- **React Query** for data fetching and caching

### AI & Data Processing
- **OpenAI GPT-4** for natural language processing
- **InfluxDB Flux** for time-series data queries
- **jsPDF & html2canvas** for PDF report generation

### Key Components
- `QueryInterface` - Natural language input and query processing
- `VisualizationWidget` - Interactive charts with friendly entity names
- `InsightsWidget` - AI-powered chat interface and report generation
- `OpenAIService` - GPT-4 integration for query conversion and insights

## 🎨 Design System

The application features a sophisticated design system with:
- **Gradient Backgrounds**: Beautiful color transitions throughout the UI
- **Glass-morphism Effects**: Backdrop blur and transparency for modern aesthetics
- **Consistent Typography**: Gradient text effects and proper hierarchy
- **Interactive Elements**: Hover animations and smooth transitions
- **Professional Color Palette**: Carefully chosen colors for accessibility

## 🔒 Security & Privacy

> ⚠️ **CRITICAL SECURITY WARNING**: This is a client-side application that exposes API keys in the browser. See [SECURITY.md](SECURITY.md) for detailed security considerations.

### Current Security Status
- **⚠️ API Key Exposure**: OpenAI API keys are visible in browser (development/personal use only)
- **✅ Environment Validation**: Validates API key formats and required variables
- **✅ Input Sanitization**: Validates and sanitizes user inputs
- **✅ Error Handling**: Prevents sensitive data leakage in error messages
- **✅ Local Data**: Your InfluxDB data stays in your infrastructure

### For Production Use
- **Implement a backend proxy service** to handle API calls securely
- **Use server-side environment variables** that are not exposed to clients
- **Implement proper authentication** and authorization
- **Use HTTPS** for all communications
- **See [SECURITY.md](SECURITY.md)** for comprehensive security guidelines

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **HomeAssistant Community** for the amazing home automation platform
- **InfluxData** for the powerful time-series database
- **OpenAI** for the incredible GPT-4 API
- **Tailwind CSS** for the utility-first CSS framework

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/homeassistant-smart-insights/issues) page
2. Create a new issue with detailed information
3. Join the discussion in our community

---

**Made with ❤️ for the HomeAssistant community**