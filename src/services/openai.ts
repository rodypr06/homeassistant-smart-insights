import OpenAI from 'openai';
import type { QueryRequest, ProcessedQuery } from '../types/dashboard';

class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string) {
    // Debug logging
    console.log('OpenAI API Key provided:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NO KEY PROVIDED');
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required but not provided');
    }
    
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async processQuery(request: QueryRequest): Promise<ProcessedQuery> {
    try {
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

      const response = await this.client.chat.completions.create({
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
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as ProcessedQuery;
    } catch (error) {
      console.error('Error processing query with OpenAI:', error);
      throw error;
    }
  }

  async generateInsights(data: any[], query: string): Promise<string> {
    try {
      console.log('Generating insights for', data.length, 'records');
      console.log('Query:', query);
      
      if (!data || data.length === 0) {
        throw new Error('No data provided for analysis');
      }
      
      // Summarize the data instead of sending all raw data
      let dataSummary;
      try {
        dataSummary = this.summarizeData(data);
      } catch (error) {
        console.error('Error summarizing data:', error);
        throw new Error('Failed to process data for analysis');
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
      
      const response = await this.client.chat.completions.create({
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

      const result = response.choices[0].message.content || 'No insights available.';
      console.log('OpenAI response received successfully');
      return result;
      
    } catch (error) {
      console.error('Error generating insights with OpenAI:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('rate_limit')) {
          throw new Error('OpenAI rate limit exceeded. Please try again in a moment.');
        } else if (error.message.includes('insufficient_quota')) {
          throw new Error('OpenAI quota exceeded. Please check your API usage.');
        } else if (error.message.includes('invalid_api_key')) {
          throw new Error('Invalid OpenAI API key. Please check your configuration.');
        } else if (error.message.includes('No data provided')) {
          throw new Error('No data available for analysis. Please run a query first.');
        } else if (error.message.includes('Failed to process data')) {
          throw new Error('Data processing error. Please try with a different query.');
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
      
      // Summarize the data
      const dataSummary = this.summarizeData(data);
      
      // Build conversation context
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        {
          role: 'system',
          content: `You are an AI assistant specialized in analyzing HomeAssistant sensor data. You are having a conversation with a user about their data analysis report. 
          
          Original Query: "${originalQuery}"
          Data Summary: ${JSON.stringify(dataSummary, null, 2)}
          
          The user can ask you to modify the report, add more details, focus on specific aspects, change the format, or ask follow-up questions. Always maintain context from the previous conversation and provide updated, comprehensive responses.`
        },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: userRequest
        }
      ];

      const response = await this.client.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 1200,
      });

      const result = response.choices[0].message.content || 'No response available.';
      console.log('Updated insights generated successfully');
      return result;
      
    } catch (error) {
      console.error('Error updating insights with OpenAI:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('rate_limit')) {
          throw new Error('OpenAI rate limit exceeded. Please try again in a moment.');
        } else if (error.message.includes('insufficient_quota')) {
          throw new Error('OpenAI quota exceeded. Please check your API usage.');
        } else if (error.message.includes('invalid_api_key')) {
          throw new Error('Invalid OpenAI API key. Please check your configuration.');
        }
      }
      
      throw new Error('Failed to update insights. Please try again.');
    }
  }

  private summarizeData(data: any[]): {
    timeRange: string;
    entities: string[];
    statistics: Record<string, any>;
    sampleData: any[];
  } {
    console.log('Starting data summarization...');
    console.log('Input data:', data);
    
    if (!data || data.length === 0) {
      console.log('No data provided, returning empty summary');
      return {
        timeRange: 'No data',
        entities: [],
        statistics: {},
        sampleData: []
      };
    }

    try {
      // Extract unique entities with safety checks
      const entities = [...new Set(data.map(d => d?.entity_id).filter(Boolean))];
      console.log('Extracted entities:', entities);
      
      // Calculate time range with safety checks
      const validTimestamps = data
        .map(d => d?.timestamp)
        .filter(Boolean)
        .map(t => new Date(t))
        .filter(date => !isNaN(date.getTime()))
        .sort();
      
      const timeRange = validTimestamps.length > 0 
        ? `${validTimestamps[0].toLocaleString()} to ${validTimestamps[validTimestamps.length - 1].toLocaleString()}`
        : 'Unknown time range';
      
      console.log('Calculated time range:', timeRange);
      
      // Calculate statistics for each entity with safety checks
      const statistics: Record<string, any> = {};
      entities.forEach(entity => {
        try {
          const entityData = data.filter(d => d?.entity_id === entity);
          const values = entityData
            .map(d => d?.value)
            .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
            .map(v => Number(v));
          
          if (values.length > 0) {
            statistics[entity] = {
              count: values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
              latest: entityData[entityData.length - 1]?.value
            };
          }
        } catch (error) {
          console.error(`Error processing entity ${entity}:`, error);
          statistics[entity] = { error: 'Processing failed' };
        }
      });
      
      console.log('Calculated statistics:', statistics);
      
      // Get sample data with safety checks
      const sampleData = [];
      try {
        if (data.length > 0) {
          sampleData.push(...data.slice(0, Math.min(3, data.length)));
          
          if (data.length > 6) {
            const midPoint = Math.floor(data.length / 2);
            sampleData.push(...data.slice(midPoint, midPoint + 2));
          }
          
          if (data.length > 3) {
            sampleData.push(...data.slice(-Math.min(3, data.length)));
          }
        }
      } catch (error) {
        console.error('Error creating sample data:', error);
      }
      
      console.log('Sample data created:', sampleData);
      
      const result = {
        timeRange,
        entities,
        statistics,
        sampleData
      };
      
      console.log('Data summarization completed successfully:', result);
      return result;
      
    } catch (error) {
      console.error('Error in summarizeData:', error);
      return {
        timeRange: 'Error processing data',
        entities: [],
        statistics: { error: 'Data processing failed' },
        sampleData: []
      };
    }
  }
}

export default OpenAIService; 