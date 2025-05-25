import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QueryResult, TimeRange } from '../types/influxdb';
import InfluxDBService from '../services/influxdb';

const influxConfig = {
  url: import.meta.env.VITE_INFLUXDB_URL || 'http://localhost:8086',
  token: import.meta.env.VITE_INFLUXDB_TOKEN || '',
  org: import.meta.env.VITE_INFLUXDB_ORG || 'home-assistant',
  bucket: import.meta.env.VITE_INFLUXDB_BUCKET || 'homeassistant',
};

const influxService = new InfluxDBService(influxConfig);

export function useInfluxDB() {
  const [error, setError] = useState<Error | null>(null);

  const queryData = useCallback(async (query: string) => {
    try {
      setError(null);
      return await influxService.query({ query });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const getTimeRangeData = useCallback(async (timeRange: TimeRange, entityIds: string[]) => {
    try {
      setError(null);
      return await influxService.getTimeRangeData(timeRange, entityIds);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const useTimeRangeData = (timeRange: TimeRange, entityIds: string[]) => {
    return useQuery<QueryResult[]>({
      queryKey: ['influxData', timeRange, entityIds],
      queryFn: () => getTimeRangeData(timeRange, entityIds),
      enabled: entityIds.length > 0,
    });
  };

  return {
    queryData,
    getTimeRangeData,
    useTimeRangeData,
    error,
  };
} 