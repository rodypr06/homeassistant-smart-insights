interface EnvConfig {
  VITE_OPENAI_API_KEY: string;
  VITE_INFLUXDB_URL: string;
  VITE_INFLUXDB_TOKEN: string;
  VITE_INFLUXDB_ORG: string;
  VITE_INFLUXDB_BUCKET: string;
  VITE_HOMEASSISTANT_URL?: string;
  VITE_HOMEASSISTANT_TOKEN?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: Partial<EnvConfig>;
}

export function validateEnvironmentVariables(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Partial<EnvConfig> = {};

  // Required variables
  const requiredVars = [
    'VITE_OPENAI_API_KEY',
    'VITE_INFLUXDB_URL',
    'VITE_INFLUXDB_TOKEN',
    'VITE_INFLUXDB_ORG',
    'VITE_INFLUXDB_BUCKET'
  ] as const;

  // Optional variables
  const optionalVars = [
    'VITE_HOMEASSISTANT_URL',
    'VITE_HOMEASSISTANT_TOKEN'
  ] as const;

  // Check required variables
  for (const varName of requiredVars) {
    const value = import.meta.env[varName];
    
    if (!value || value === 'NOT SET' || value.includes('your_') || value.includes('_here')) {
      errors.push(`${varName} is required but not properly configured. Please check your .env file.`);
    } else {
      config[varName] = value;
      
      // Specific validations
      if (varName === 'VITE_OPENAI_API_KEY') {
        if (!value.startsWith('sk-')) {
          errors.push('VITE_OPENAI_API_KEY must start with "sk-"');
        } else if (value.length < 50) {
          errors.push('VITE_OPENAI_API_KEY appears to be invalid (too short)');
        }
      }
      
      if (varName === 'VITE_INFLUXDB_URL') {
        try {
          new URL(value);
        } catch {
          errors.push('VITE_INFLUXDB_URL must be a valid URL (e.g., http://localhost:8086)');
        }
      }
      
      if (varName === 'VITE_INFLUXDB_TOKEN' && value.length < 10) {
        errors.push('VITE_INFLUXDB_TOKEN appears to be invalid (too short)');
      }
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    const value = import.meta.env[varName];
    
    if (value && value !== 'NOT SET' && !value.includes('your_') && !value.includes('_here')) {
      config[varName] = value;
      
      // Specific validations for optional vars
      if (varName === 'VITE_HOMEASSISTANT_URL') {
        try {
          new URL(value);
        } catch {
          warnings.push('VITE_HOMEASSISTANT_URL is set but appears to be invalid URL format');
        }
      }
      
      if (varName === 'VITE_HOMEASSISTANT_TOKEN' && value.length < 50) {
        warnings.push('VITE_HOMEASSISTANT_TOKEN is set but appears to be invalid (too short)');
      }
    } else {
      warnings.push(`${varName} is not configured. HomeAssistant integration will be limited.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config
  };
}

export function logEnvironmentStatus(): void {
  const validation = validateEnvironmentVariables();
  
  console.group('🔧 Environment Configuration Status');
  
  if (validation.isValid) {
    console.log('✅ All required environment variables are configured');
  } else {
    console.error('❌ Environment configuration issues found:');
    validation.errors.forEach(error => console.error(`  • ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`  • ${warning}`));
  }
  
  console.groupEnd();
}

export function getRequiredEnvHelp(): string {
  return `
🔧 Required Environment Variables:

Create a .env file in your project root with:

VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
VITE_INFLUXDB_URL=http://your-influxdb-host:8086
VITE_INFLUXDB_TOKEN=your-influxdb-token
VITE_INFLUXDB_ORG=your-organization
VITE_INFLUXDB_BUCKET=home_assistant/autogen

Optional (for enhanced features):
VITE_HOMEASSISTANT_URL=http://your-homeassistant:8123
VITE_HOMEASSISTANT_TOKEN=your-long-lived-access-token

📚 For setup instructions, see the README.md file.
  `.trim();
} 