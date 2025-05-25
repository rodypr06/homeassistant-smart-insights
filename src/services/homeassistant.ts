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

const homeAssistantConfig = {
  url: import.meta.env.VITE_HOMEASSISTANT_URL || 'http://192.168.50.150',
  token: import.meta.env.VITE_HOMEASSISTANT_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIzZTlhNWM5OTQxOGU0Y2I0YmMxMzVkMTFhOGFjNWUzNSIsImlhdCI6MTc0ODE4NzU3MCwiZXhwIjoyMDYzNTQ3NTcwfQ.S80v6LmZOMaCvDtehYReduiuxBoj6_axSXm7FdBHVP8',
};

export const homeAssistantService = new HomeAssistantService(homeAssistantConfig);
export default HomeAssistantService; 