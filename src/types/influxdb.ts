export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export interface QueryResult {
  timestamp: string;
  value: number;
  entity_id: string;
  unit?: string;
  friendly_name?: string;
}

export interface FluxQuery {
  query: string;
  params?: Record<string, any>;
}

export interface TimeRange {
  start: string;
  stop: string;
}

export interface EntityData {
  entity_id: string;
  friendly_name: string;
  unit_of_measurement?: string;
  device_class?: string;
  state_class?: string;
} 