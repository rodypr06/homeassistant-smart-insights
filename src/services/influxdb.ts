import { InfluxDB, Point } from '@influxdata/influxdb-client';
import type { InfluxConfig, QueryResult, FluxQuery, TimeRange } from '../types/influxdb';

class InfluxDBService {
  private client: InfluxDB;
  private config: InfluxConfig;

  constructor(config: InfluxConfig) {
    this.config = config;
    this.client = new InfluxDB({
      url: config.url,
      token: config.token,
    });
  }

  async query(query: FluxQuery): Promise<QueryResult[]> {
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
}

const influxConfig = {
  url: import.meta.env.VITE_INFLUXDB_URL || 'http://192.168.50.101:8086',
  token: import.meta.env.VITE_INFLUXDB_TOKEN || '',
  org: import.meta.env.VITE_INFLUXDB_ORG || 'home_assistant',
  bucket: import.meta.env.VITE_INFLUXDB_BUCKET || 'home_assistant/autogen',
};

export const influxService = new InfluxDBService(influxConfig);
export default InfluxDBService; 