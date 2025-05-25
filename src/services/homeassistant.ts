interface HomeAssistantConfig {
  url: string;
  token: string;
}

class HomeAssistantService {
  private config: HomeAssistantConfig;

  constructor(config: HomeAssistantConfig) {
    this.config = config;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.url}/api/${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HomeAssistant API error: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error calling HomeAssistant API:', error);
      throw error;
    }
  }

  async getStates(): Promise<any[]> {
    return this.fetch('states');
  }

  async getEntityHistory(entityId: string, startTime: string, endTime: string): Promise<any[]> {
    return this.fetch(`history/period/${startTime}?filter_entity_id=${entityId}&end_time=${endTime}`);
  }

  async getServices(): Promise<any> {
    return this.fetch('services');
  }

  async getEntities(): Promise<any[]> {
    const states = await this.getStates();
    return states.map(state => ({
      entity_id: state.entity_id,
      friendly_name: state.attributes.friendly_name,
      state: state.state,
      last_updated: state.last_updated,
      attributes: state.attributes,
    }));
  }
}

// Validate environment variables
const validateConfig = () => {
  const url = import.meta.env.VITE_HOMEASSISTANT_URL;
  const token = import.meta.env.VITE_HOMEASSISTANT_TOKEN;
  
  if (!url || url === 'NOT SET' || url === 'your_homeassistant_url_here') {
    console.warn('⚠️ HomeAssistant URL not configured. HomeAssistant integration will be disabled.');
    return null;
  }
  
  if (!token || token === 'NOT SET' || token === 'your_homeassistant_token_here') {
    console.warn('⚠️ HomeAssistant token not configured. HomeAssistant integration will be disabled.');
    return null;
  }
  
  // Validate token format (should be a JWT or long-lived access token)
  if (token.length < 50) {
    console.warn('⚠️ HomeAssistant token appears to be invalid (too short). Please check your configuration.');
    return null;
  }
  
  return { url, token };
};

const homeAssistantConfig = validateConfig();

export const homeAssistantService = homeAssistantConfig ? new HomeAssistantService(homeAssistantConfig) : null;
export default HomeAssistantService; 