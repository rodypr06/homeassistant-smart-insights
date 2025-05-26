import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  
  // API Keys (stored securely on backend)
  OPENAI_API_KEY: z.string().optional(),
  HOMEASSISTANT_TOKEN: z.string().optional(),
  
  // Database/Cache
  REDIS_URL: z.string().optional(),
  
  // InfluxDB
  INFLUXDB_URL: z.string().default('http://192.168.50.101:8086'),
  INFLUXDB_TOKEN: z.string().optional(),
  INFLUXDB_ORG: z.string().default('home_assistant'),
  INFLUXDB_BUCKET: z.string().default('home_assistant/autogen'),
  
  // HomeAssistant
  HOMEASSISTANT_URL: z.string().optional(),
  
  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:5177,http://192.168.50.141:5177'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Security Headers
  ENABLE_HSTS: z.string().transform(Boolean).default('true'),
  ENABLE_CSP: z.string().transform(Boolean).default('true'),
});

// Validate environment variables
const env = envSchema.parse(process.env);

export const securityConfig = {
  // Server
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  
  // Authentication
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  
  session: {
    secret: env.SESSION_SECRET,
    name: 'ha-smart-insight-session',
    cookie: {
      secure: env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' as const,
    },
  },
  
  // API Keys
  apiKeys: {
    openai: env.OPENAI_API_KEY,
    homeassistant: env.HOMEASSISTANT_TOKEN,
  },
  
  // External Services
  influxdb: {
    url: env.INFLUXDB_URL,
    token: env.INFLUXDB_TOKEN,
    org: env.INFLUXDB_ORG,
    bucket: env.INFLUXDB_BUCKET,
  },
  
  homeassistant: {
    url: env.HOMEASSISTANT_URL,
  },
  
  // CORS
  cors: {
    origin: env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
    credentials: true,
    optionsSuccessStatus: 200,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Security Headers
  helmet: {
    hsts: env.ENABLE_HSTS ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    } : false,
    
    contentSecurityPolicy: env.ENABLE_CSP ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", env.INFLUXDB_URL, env.HOMEASSISTANT_URL].filter(Boolean),
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    } : false,
    
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
  },
  
  // Cache
  cache: {
    redis: {
      url: env.REDIS_URL,
    },
    ttl: {
      default: 300, // 5 minutes
      influxData: 60, // 1 minute for real-time data
      homeassistantEntities: 300, // 5 minutes
      automationSuggestions: 1800, // 30 minutes
    },
  },
};

// Validation functions
export const validateApiKey = (key: string | undefined, serviceName: string): void => {
  if (!key) {
    throw new Error(`${serviceName} API key is required but not configured`);
  }
  
  if (key.length < 10) {
    throw new Error(`${serviceName} API key appears to be invalid (too short)`);
  }
};

export const validateEnvironment = (): void => {
  const requiredInProduction = [
    'JWT_SECRET',
    'SESSION_SECRET',
  ];
  
  if (securityConfig.isProduction) {
    for (const key of requiredInProduction) {
      if (!process.env[key]) {
        throw new Error(`${key} is required in production environment`);
      }
    }
    
    // Validate JWT secret strength in production
    if (securityConfig.jwt.secret.length < 64) {
      throw new Error('JWT secret should be at least 64 characters in production');
    }
  }
};

// Initialize security validation
validateEnvironment(); 