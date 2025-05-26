// Simple logger for frontend
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
};

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  lastLogin?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  message: string;
  token: string;
  user: AuthUser;
}

class SecureApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    // Use environment variable or default to localhost
    this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
    
    logger.info('SecureApiService initialized', { baseUrl: this.baseUrl });
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await this.request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      if (response.data) {
        this.token = response.data.token;
        localStorage.setItem('auth_token', this.token);
        logger.info('User logged in successfully', { userId: response.data.user.id });
        return response.data;
      }

      throw new Error(response.error || 'Login failed');
    } catch (error) {
      logger.error('Login failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.token) {
        await this.request('/api/auth/logout', {
          method: 'POST',
        });
      }
    } catch (error) {
      logger.warn('Logout request failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      this.token = null;
      localStorage.removeItem('auth_token');
      logger.info('User logged out');
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    try {
      if (!this.token) return null;

      const response = await this.request<AuthUser>('/api/auth/me');
      return response.data || null;
    } catch (error) {
      logger.error('Failed to get current user', { error: error instanceof Error ? error.message : 'Unknown error' });
      // Clear invalid token
      this.token = null;
      localStorage.removeItem('auth_token');
      return null;
    }
  }

  async refreshToken(): Promise<string | null> {
    try {
      if (!this.token) return null;

      const response = await this.request<{ token: string }>('/api/auth/refresh', {
        method: 'POST',
      });

      if (response.data) {
        this.token = response.data.token;
        localStorage.setItem('auth_token', this.token);
        logger.info('Token refreshed successfully');
        return this.token;
      }

      return null;
    } catch (error) {
      logger.error('Token refresh failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      this.token = null;
      localStorage.removeItem('auth_token');
      return null;
    }
  }

  // OpenAI proxy methods
  async chatCompletion(messages: any[], options: any = {}): Promise<any> {
    try {
      const response = await this.request('/api/openai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          model: options.model || 'gpt-3.5-turbo',
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1000,
        }),
      });

      if (response.data) {
        logger.info('OpenAI chat completion successful');
        return response.data;
      }

      throw new Error(response.error || 'Chat completion failed');
    } catch (error) {
      logger.error('OpenAI chat completion failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // InfluxDB proxy methods
  async queryInfluxDB(query: string, database?: string): Promise<any> {
    try {
      const response = await this.request('/api/influxdb/query', {
        method: 'POST',
        body: JSON.stringify({ query, database }),
      });

      if (response.data) {
        logger.info('InfluxDB query successful', { query: query.substring(0, 100) });
        return response.data;
      }

      throw new Error(response.error || 'InfluxDB query failed');
    } catch (error) {
      logger.error('InfluxDB query failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        query: query.substring(0, 100)
      });
      throw error;
    }
  }

  // HomeAssistant proxy methods
  async homeAssistantRequest(path: string, options: RequestInit = {}): Promise<any> {
    try {
      const response = await this.request(`/api/homeassistant/${path}`, options);

      if (response.data) {
        logger.info('HomeAssistant request successful', { path });
        return response.data;
      }

      throw new Error(response.error || 'HomeAssistant request failed');
    } catch (error) {
      logger.error('HomeAssistant request failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        path
      });
      throw error;
    }
  }

  // Cache management methods
  async clearCache(key?: string): Promise<void> {
    try {
      const endpoint = key ? `/api/cache/${key}` : '/api/cache';
      await this.request(endpoint, { method: 'DELETE' });
      logger.info('Cache cleared', { key: key || 'all' });
    } catch (error) {
      logger.error('Cache clear failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<any> {
    try {
      const response = await this.request('/api/health');
      return response.data;
    } catch (error) {
      logger.error('Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Generic request method
  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add authorization header if token exists
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for session-based auth
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 401) {
          // Unauthorized - clear token and redirect to login
          this.token = null;
          localStorage.removeItem('auth_token');
          
          // Emit custom event for auth failure
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        } else if (response.status === 429) {
          // Rate limited
          window.dispatchEvent(new CustomEvent('api:rateLimit', { 
            detail: { retryAfter: data.retryAfter } 
          }));
        }

        return {
          error: data.error || `HTTP ${response.status}`,
          code: data.code,
        };
      }

      return { data };
    } catch (error) {
      logger.error('Request failed', { 
        url, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        error: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      };
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
    logger.info('Base URL updated', { baseUrl: url });
  }
}

// Create singleton instance
export const secureApiService = new SecureApiService();

// Export types
export type { AuthUser, LoginCredentials, LoginResponse, ApiResponse };

export default secureApiService; 