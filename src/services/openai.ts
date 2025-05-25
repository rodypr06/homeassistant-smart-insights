import type { QueryRequest, ProcessedQuery } from '../types/dashboard';

// Security Warning: This is a client-side implementation that should be replaced
// with a backend proxy service in production to avoid exposing API keys
class OpenAIService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'NOT SET') {
      throw new Error('OpenAI API key is required. Please set VITE_OPENAI_API_KEY in your .env file.');
    }
    
    // Validate API key format
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. API keys should start with "sk-"');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
    
    console.warn('⚠️ SECURITY WARNING: OpenAI API key is exposed in browser. Use a backend proxy in production!');
  }

  private async makeRequest(endpoint: string, data: any, retries = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 401) {
            throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY.');
          } else if (response.status === 429) {
            if (attempt < retries) {
              const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
              console.log(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt}/${retries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw new Error('OpenAI rate limit exceeded. Please try again later.');
          } else if (response.status === 403) {
            throw new Error('OpenAI quota exceeded. Please check your API usage.');
          }
          
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Only retry on network errors, not API errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Network error. Retrying in ${delay}ms... (attempt ${attempt}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  async processQuery(request: QueryRequest): Promise<ProcessedQuery> {
    try {
      // Validate input
      if (!request.userInput || request.userInput.trim().length === 0) {
        throw new Error('Query input is required');
      }

      if (request.userInput.length > 1000) {
        throw new Error('Query is too long. Please keep it under 1000 characters.');
      }

      const prompt = `
        Convert this natural language query about HomeAssistant data into a Flux query for InfluxDB v1.x:
        "${request.userInput}"
        
        Database Structure:
        - Bucket: "home_assistant/autogen"
        - Measurements: Various (state, °F, µg/m³, steps, etc.)
        - Common fields: _time, _value, entity_id, _field, _measurement, domain
        - Available entities include temperature sensors, weather data, switches, etc.
        
        Context: ${request.context || 'No additional context provided'}
        
        Important Notes:
        - Use bucket "home_assistant/autogen" in from() function
        - Filter by entity_id for specific sensors (e.g., office_window_magnet_sensor_device_temperature)
        - Use _field="value" for numeric sensor values
        - Use appropriate time ranges (e.g., -1h, -24h, -7d)
        - Temperature sensors often have "temperature" in their entity_id
        
        Return a JSON object with the following structure:
        {
          "fluxQuery": "The complete Flux query string",
          "chartType": "line|bar|area|gauge",
          "timeRange": "The time range string",
          "entities": ["array", "of", "entity", "ids"],
          "aggregation": "mean|max|min|sum"
        }
        
        Example for office temperature:
        {
          "fluxQuery": "from(bucket: \\"home_assistant/autogen\\") |> range(start: -24h) |> filter(fn: (r) => r[\\"entity_id\\"] =~ /office.*temperature/ and r[\\"_field\\"] == \\"value\\") |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)",
          "chartType": "line",
          "timeRange": "-24h",
          "entities": ["office_window_magnet_sensor_device_temperature"],
          "aggregation": "mean"
        }
      `;

      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that converts natural language queries about HomeAssistant data into Flux queries for InfluxDB. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      try {
        const result = JSON.parse(content);
        
        // Validate the response structure
        if (!result.fluxQuery || typeof result.fluxQuery !== 'string') {
          throw new Error('Invalid response: missing or invalid fluxQuery');
        }
        
        return result as ProcessedQuery;
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        throw new Error('Invalid JSON response from OpenAI');
      }
    } catch (error) {
      console.error('Error processing query with OpenAI:', error);
      throw error;
    }
  }

  async generateInsights(data: any[], query: string): Promise<string> {
    try {
      console.log('Generating insights for', data?.length || 0, 'records');
      
      // Validate inputs
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No data provided for analysis. Please run a query first.');
      }
      
      if (!query || query.trim().length === 0) {
        throw new Error('Query is required for context');
      }
      
      // Summarize the data safely
      let dataSummary;
      try {
        dataSummary = this.summarizeData(data);
      } catch (error) {
        console.error('Error summarizing data:', error);
        throw new Error('Failed to process data for analysis. Please check your data format.');
      }
      
      console.log('Data summary created:', dataSummary);
      
      const prompt = `
        Analyze this HomeAssistant sensor data summary and provide insights:
        
        Data Summary:
        - Total Records: ${data.length}
        - Time Range: ${dataSummary.timeRange}
        - Entities: ${dataSummary.entities.join(', ')}
        - Value Statistics: ${JSON.stringify(dataSummary.statistics, null, 2)}
        - Sample Data Points: ${JSON.stringify(dataSummary.sampleData, null, 2)}
        
        User Query: "${query}"
        
        Please provide a comprehensive analysis in **markdown format** with the following sections:

        ## 🔍 Key Trends and Patterns
        - Analyze the data trends over time
        - Identify patterns in sensor readings
        
        ## 📊 Notable Observations
        - Highlight significant differences between sensors
        - Point out any unusual readings or anomalies
        
        ## 💡 Recommendations
        - Provide actionable insights for energy efficiency
        - Suggest comfort optimization strategies
        - Recommend any maintenance or monitoring actions
        
        ## 📈 Summary Statistics
        - Present key metrics in an easy-to-understand format
        
        Use proper markdown formatting with headers, bullet points, **bold text** for emphasis, and clear sections. Keep the tone professional but accessible.
      `;

      console.log('Sending request to OpenAI...');
      
      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant specialized in analyzing HomeAssistant sensor data. Provide practical, actionable insights about home automation, energy efficiency, and comfort optimization.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const result = response.choices?.[0]?.message?.content;
      if (!result) {
        throw new Error('No insights generated by OpenAI');
      }
      
      console.log('OpenAI response received successfully');
      return result;
      
    } catch (error) {
      console.error('Error generating insights with OpenAI:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('rate_limit') || error.message.includes('rate limit')) {
          throw new Error('OpenAI rate limit exceeded. Please try again in a moment.');
        } else if (error.message.includes('quota')) {
          throw new Error('OpenAI quota exceeded. Please check your API usage.');
        } else if (error.message.includes('API key') || error.message.includes('401')) {
          throw new Error('Invalid OpenAI API key. Please check your configuration.');
        } else if (error.message.includes('No data provided')) {
          throw error; // Re-throw as is
        } else if (error.message.includes('Failed to process data')) {
          throw error; // Re-throw as is
        }
      }
      
      throw new Error('Failed to generate insights. Please try again.');
    }
  }

  async updateInsights(
    data: any[], 
    originalQuery: string, 
    conversationHistory: Array<{role: string, content: string}>, 
    userRequest: string
  ): Promise<string> {
    try {
      console.log('Updating insights based on user request:', userRequest);
      
      // Validate inputs
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No data available for analysis');
      }
      
      if (!userRequest || userRequest.trim().length === 0) {
        throw new Error('User request is required');
      }
      
      // Summarize the data safely
      const dataSummary = this.summarizeData(data);
      
      // Build conversation context (limit to last 10 messages to avoid token limits)
      const recentHistory = conversationHistory.slice(-10);
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        {
          role: 'system',
          content: `You are an AI assistant specialized in analyzing HomeAssistant sensor data. You are having a conversation with a user about their data analysis report. 
          
          Original Query: "${originalQuery}"
          Data Summary: ${JSON.stringify(dataSummary, null, 2)}
          
          The user wants to modify or enhance the analysis. Provide updated insights in markdown format.`,
        },
        ...recentHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: userRequest
        }
      ];

      const response = await this.makeRequest('/chat/completions', {
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      const result = response.choices?.[0]?.message?.content;
      if (!result) {
        throw new Error('No response generated by OpenAI');
      }

      return result;

    } catch (error) {
      console.error('Error in chat:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to process chat message. Please try again.');
    }
  }

  private summarizeData(data: any[]): {
    timeRange: string;
    entities: string[];
    statistics: Record<string, any>;
    sampleData: any[];
  } {
    try {
      // Validate input
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('No data to summarize');
      }

      // Filter out invalid data points
      const validData = data.filter(item => 
        item && 
        typeof item === 'object' && 
        item.timestamp && 
        item.entity_id && 
        (item.value !== null && item.value !== undefined && !isNaN(Number(item.value)))
      );

      if (validData.length === 0) {
        throw new Error('No valid data points found');
      }

      // Sort by timestamp to ensure proper time range calculation
      const sortedData = validData.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Calculate time range safely
      const startTime = new Date(sortedData[0].timestamp);
      const endTime = new Date(sortedData[sortedData.length - 1].timestamp);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new Error('Invalid timestamp format in data');
      }

      const timeRange = `${startTime.toISOString()} to ${endTime.toISOString()}`;

      // Get unique entities
      const entities = [...new Set(sortedData.map(item => item.entity_id))].filter(Boolean);

      // Calculate statistics by entity
      const statistics: Record<string, any> = {};
      entities.forEach(entity => {
        const entityData = sortedData.filter(item => item.entity_id === entity);
        const values = entityData.map(item => Number(item.value)).filter(v => !isNaN(v));
        
        if (values.length > 0) {
          statistics[entity] = {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((sum, val) => sum + val, 0) / values.length,
            latest: values[values.length - 1]
          };
        }
      });

      // Get sample data (first 5 and last 5 records)
      const sampleData = [
        ...sortedData.slice(0, Math.min(5, sortedData.length)),
        ...(sortedData.length > 10 ? sortedData.slice(-5) : [])
      ];

      return {
        timeRange,
        entities,
        statistics,
        sampleData
      };
    } catch (error) {
      console.error('Error in summarizeData:', error);
      throw new Error(`Data summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default OpenAIService; 