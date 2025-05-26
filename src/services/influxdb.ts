import { InfluxDB, Point } from '@influxdata/influxdb-client';
import type { InfluxConfig, QueryResult, FluxQuery, TimeRange } from '../types/influxdb';

class InfluxDBService {
  private client: InfluxDB;
  public config: InfluxConfig;

  constructor(config: InfluxConfig) {
    this.config = config;
    this.client = new InfluxDB({
      url: config.url,
      token: config.token,
    });
  }

  async query(query: FluxQuery): Promise<QueryResult[]> {
    // First check if this is InfluxDB 1.x by testing the health endpoint
    try {
      const healthResponse = await fetch(`${this.config.url}/health`);
      const healthData = await healthResponse.json();
      
      if (healthData.version && healthData.version.startsWith('v1.')) {
        console.log(`🔍 Detected InfluxDB ${healthData.version}, using InfluxQL instead of Flux`);
        
        // Convert Flux-like query to InfluxQL for HomeAssistant data
        const database = this.config.bucket.split('/')[0] || 'homeassistant';
        
        // InfluxQL query for HomeAssistant sensor data
        const influxQLQuery = `
          SELECT time, entity_id, value, friendly_name, domain
          FROM "%", "W", "Wh", "°C", "°F", "A", "V", "Hz"
          WHERE time > now() - 7d 
          AND domain = 'sensor'
          AND entity_id =~ /sensor\..*/ 
          ORDER BY time DESC 
          LIMIT 1000
        `;
        
        console.log('📊 Using InfluxQL query:', influxQLQuery);
        return await this.queryInfluxQLForSensors(database, influxQLQuery);
      }
    } catch (healthError) {
      console.log('⚠️ Could not determine InfluxDB version, trying Flux query');
    }

    // Original Flux query logic for InfluxDB 2.x
    const queryApi = this.client.getQueryApi(this.config.org);
    const results: QueryResult[] = [];

    try {
      for await (const { values, tableMeta } of queryApi.iterateRows(query.query)) {
        const timeIndex = tableMeta.columns.findIndex(col => col.label === '_time');
        const valueIndex = tableMeta.columns.findIndex(col => col.label === '_value');
        const entityIndex = tableMeta.columns.findIndex(col => col.label === 'entity_id');
        const unitIndex = tableMeta.columns.findIndex(col => col.label === 'unit');

        const timestamp = values[timeIndex] as string;
        const value = parseFloat(values[valueIndex] as string);
        const entity_id = values[entityIndex] as string;
        const unit = unitIndex >= 0 ? values[unitIndex] as string : undefined;

        results.push({
          timestamp,
          value,
          entity_id,
          unit,
        });
      }
    } catch (error) {
      console.error('Error querying InfluxDB with Flux:', error);
      
      // If Flux is disabled, try to provide helpful error message
      if (error instanceof Error && error.message.includes('Flux query service disabled')) {
        throw new Error('Flux queries are disabled in InfluxDB. Please enable flux-enabled=true in the [http] section of your InfluxDB configuration, or contact your administrator.');
      }
      
      throw error;
    }

    return results;
  }

  // Enhanced InfluxQL method for sensor data
  private async queryInfluxQLForSensors(database: string, query: string): Promise<QueryResult[]> {
    try {
      const response = await fetch(`${this.config.url}/query?db=${database}&q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: this.config.token ? {
          'Authorization': `Token ${this.config.token}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error(`InfluxQL query failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 InfluxQL response:', data);

      const results: QueryResult[] = [];

      if (data.results && data.results[0] && data.results[0].series) {
        for (const series of data.results[0].series) {
          const columns = series.columns;
          const timeIndex = columns.indexOf('time');
          const entityIndex = columns.indexOf('entity_id');
          const valueIndex = columns.indexOf('value');
          const friendlyNameIndex = columns.indexOf('friendly_name');

          // The measurement name (series.name) is the unit
          const unit = series.name;

          for (const values of series.values) {
            const timestamp = values[timeIndex];
            const entity_id = values[entityIndex];
            const value = parseFloat(values[valueIndex]);
            const friendly_name = friendlyNameIndex >= 0 ? values[friendlyNameIndex] : undefined;

            if (!isNaN(value) && entity_id && entity_id.startsWith('sensor.')) {
              results.push({
                timestamp,
                value,
                entity_id,
                unit,
                friendly_name,
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error querying InfluxDB with InfluxQL:', error);
      throw error;
    }
  }

  // Alternative method using InfluxQL for InfluxDB 1.x
  async queryInfluxQL(database: string, query: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.url}/query?db=${database}&q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${this.config.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`InfluxQL query failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error querying InfluxDB with InfluxQL:', error);
      throw error;
    }
  }

  async writePoint(point: Point): Promise<void> {
    const writeApi = this.client.getWriteApi(this.config.org, this.config.bucket, 'ns');
    try {
      await writeApi.writePoint(point);
      await writeApi.close();
    } catch (error) {
      console.error('Error writing to InfluxDB:', error);
      throw error;
    }
  }

  async getTimeRangeData(timeRange: TimeRange, entityIds: string[]): Promise<QueryResult[]> {
    const query = `
      from(bucket: "${this.config.bucket}")
        |> range(start: ${timeRange.start}, stop: ${timeRange.stop})
        |> filter(fn: (r) => r["entity_id"] =~ /${entityIds.join('|')}/)
        |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
    `;

    return this.query({ query });
  }

  // Test connection method
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/health`);
      return response.ok;
    } catch (error) {
      console.error('InfluxDB connection test failed:', error);
      return false;
    }
  }

  // Method specifically for InfluxDB 1.x with InfluxQL
  async queryInfluxDB1x(timeRange: string = '7d'): Promise<QueryResult[]> {
    try {
      const database = this.config.bucket.split('/')[0] || 'home_assistant';
      
      // Query multiple measurements that contain sensor data
      const measurements = ['"%"', '"W"', '"Wh"', '"°C"', '"°F"', '"A"', '"V"', '"Hz"', '"Mbit/s"', '"KiB/s"'];
      
      const influxQLQuery = `
        SELECT time, entity_id, value, friendly_name
        FROM ${measurements.join(', ')}
        WHERE time > now() - ${timeRange}
        AND domain = 'sensor'
        AND entity_id =~ /sensor\..*/
        ORDER BY time DESC
        LIMIT 1000
      `;

      console.log('📊 InfluxQL Query:', influxQLQuery);

      const response = await fetch(`${this.config.url}/query?db=${database}&q=${encodeURIComponent(influxQLQuery)}`, {
        method: 'GET',
        headers: this.config.token ? {
          'Authorization': `Token ${this.config.token}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error(`InfluxQL query failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 InfluxQL Response:', data);

      const results: QueryResult[] = [];

      if (data.results && data.results[0] && data.results[0].series) {
        for (const series of data.results[0].series) {
          const columns = series.columns;
          const timeIndex = columns.indexOf('time');
          const entityIndex = columns.indexOf('entity_id');
          const valueIndex = columns.indexOf('value');
          const friendlyNameIndex = columns.indexOf('friendly_name');

          // The measurement name (series.name) is the unit
          const unit = series.name;

          for (const values of series.values) {
            const timestamp = values[timeIndex];
            const entity_id = values[entityIndex];
            const value = parseFloat(values[valueIndex]);
            const friendly_name = friendlyNameIndex >= 0 ? values[friendlyNameIndex] : undefined;

            if (!isNaN(value) && entity_id && entity_id.startsWith('sensor.')) {
              results.push({
                timestamp,
                value,
                entity_id,
                unit,
                friendly_name,
              });
            }
          }
        }
      }

      console.log(`✅ Retrieved ${results.length} sensor data points from InfluxDB 1.x`);
      return results;

    } catch (error) {
      console.error('❌ Error querying InfluxDB 1.x:', error);
      throw error;
    }
  }
}

const influxConfig = {
  url: import.meta.env.VITE_INFLUXDB_URL || 'http://192.168.50.101:8086',
  token: import.meta.env.VITE_INFLUXDB_TOKEN || '',
  org: import.meta.env.VITE_INFLUXDB_ORG || 'home_assistant',
  bucket: import.meta.env.VITE_INFLUXDB_BUCKET || 'home_assistant/autogen',
};

export const influxService = new InfluxDBService(influxConfig);
export default InfluxDBService; 