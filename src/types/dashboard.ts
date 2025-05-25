export type ChartType = 'line' | 'bar' | 'area' | 'gauge';

export interface QueryRequest {
  userInput: string;
  timestamp: Date;
  context?: string;
}

export interface ProcessedQuery {
  fluxQuery: string;
  chartType: ChartType;
  timeRange: string;
  entities: string[];
  aggregation: 'mean' | 'max' | 'min' | 'sum';
}

export interface WidgetConfig {
  id: string;
  type: 'visualization' | 'insights' | 'dataTable' | 'timeline';
  title: string;
  config: Record<string, any>;
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string;
  }[];
} 