import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

interface InfluxDBQueryOptions {
  query: string;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchInterval?: number;
  retryDelay?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface QueryResult {
  timestamp: string;
  value: number;
  entity_id: string;
  [key: string]: any;
}

interface InfluxDBResponse {
  results: QueryResult[];
  totalCount: number;
  executionTime: number;
  cached: boolean;
}

// Mock InfluxDB service - replace with actual implementation
const influxService = {
  async query({ query }: { query: string }): Promise<InfluxDBResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Generate mock data based on query complexity
    const dataPoints = Math.floor(Math.random() * 1000) + 100;
    const results: QueryResult[] = Array.from({ length: dataPoints }, (_, i) => ({
      timestamp: new Date(Date.now() - (dataPoints - i) * 60000).toISOString(),
      value: Math.random() * 100 + 20,
      entity_id: `sensor.mock_sensor_${Math.floor(i / 10)}`,
      measurement: 'temperature',
      field: 'value'
    }));

    return {
      results,
      totalCount: results.length,
      executionTime: Math.random() * 500 + 100,
      cached: Math.random() > 0.7 // 30% chance of being cached
    };
  }
};

// Main hook for InfluxDB queries with advanced caching
export function useInfluxDBQuery(options: InfluxDBQueryOptions) {
  const {
    query,
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 10 * 60 * 1000, // 10 minutes
    refetchInterval = 60 * 1000, // 1 minute
    retryDelay = 1000,
    onSuccess,
    onError
  } = options;

  const queryClient = useQueryClient();

  // Generate cache key based on query hash
  const queryKey = useMemo(() => {
    const queryHash = btoa(query).slice(0, 16); // Simple hash for demo
    return ['influxdb', queryHash, query];
  }, [query]);

  const queryOptions: UseQueryOptions<InfluxDBResponse, Error> = {
    queryKey,
    queryFn: () => influxService.query({ query }),
    enabled: enabled && query.trim().length > 0,
    staleTime,
    gcTime: cacheTime,
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      onSuccess: (data: InfluxDBResponse) => {
        console.log(`✅ Query executed in ${data.executionTime}ms, cached: ${data.cached}`);
        onSuccess?.(data);
      },
      onError: (error: Error) => {
        console.error('❌ InfluxDB query failed:', error);
        onError?.(error);
      },
    },
    // Enable background refetching
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Optimize for performance
    notifyOnChangeProps: ['data', 'error', 'isLoading'],
  };

  const queryResult = useQuery(queryOptions);

  // Prefetch related queries
  const prefetchRelatedQueries = useCallback(async (relatedQueries: string[]) => {
    const prefetchPromises = relatedQueries.map(relatedQuery =>
      queryClient.prefetchQuery({
        queryKey: ['influxdb', btoa(relatedQuery).slice(0, 16), relatedQuery],
        queryFn: () => influxService.query({ query: relatedQuery }),
        staleTime: staleTime / 2, // Shorter stale time for prefetched data
      })
    );
    
    await Promise.allSettled(prefetchPromises);
  }, [queryClient, staleTime]);

  // Invalidate cache for specific patterns
  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      queryClient.invalidateQueries({
        predicate: (query) => 
          query.queryKey[0] === 'influxdb' && 
          Boolean(query.queryKey[2]?.toString().includes(pattern))
      });
    } else {
      queryClient.invalidateQueries({ queryKey: ['influxdb'] });
    }
  }, [queryClient]);

  // Get cached data without triggering a request
  const getCachedData = useCallback(() => {
    return queryClient.getQueryData<InfluxDBResponse>(queryKey);
  }, [queryClient, queryKey]);

  // Performance metrics
  const metrics = useMemo(() => {
    const data = queryResult.data;
    return {
      dataPoints: data?.totalCount || 0,
      executionTime: data?.executionTime || 0,
      cached: data?.cached || false,
      cacheHitRate: !!getCachedData() ? 100 : 0,
      queryComplexity: query.split('|>').length, // Rough complexity measure
    };
  }, [queryResult.data, query, getCachedData]);

  return {
    ...queryResult,
    prefetchRelatedQueries,
    invalidateCache,
    getCachedData,
    metrics,
    // Computed properties for easier access
    results: queryResult.data?.results || [],
    totalCount: queryResult.data?.totalCount || 0,
    isFromCache: queryResult.data?.cached || false,
  };
}

// Hook for multiple queries with batching
export function useInfluxDBBatchQuery(queries: string[], options?: Partial<InfluxDBQueryOptions>) {
  const [batchResults, setBatchResults] = useState<Record<string, InfluxDBResponse>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeBatch = useCallback(async () => {
    if (queries.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      // Execute queries in parallel with concurrency limit
      const BATCH_SIZE = 5;
      const results: Record<string, InfluxDBResponse> = {};

      for (let i = 0; i < queries.length; i += BATCH_SIZE) {
        const batch = queries.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (query) => {
          const result = await influxService.query({ query });
          return { query, result };
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results[batch[index]] = result.value.result;
          } else {
            console.error(`Batch query failed for: ${batch[index]}`, result.reason);
          }
        });
      }

      setBatchResults(results);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [queries]);

  return {
    results: batchResults,
    isLoading,
    error,
    executeBatch,
    totalQueries: queries.length,
    completedQueries: Object.keys(batchResults).length,
  };
}

// Hook for real-time data with WebSocket-like updates
export function useInfluxDBRealtime(query: string, interval: number = 5000) {
  const [realtimeData, setRealtimeData] = useState<QueryResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const baseQuery = useInfluxDBQuery({
    query,
    refetchInterval: interval,
    staleTime: interval / 2,
  });

  // Simulate real-time updates
  const startRealtime = useCallback(() => {
    setIsConnected(true);
    // In a real implementation, this would establish a WebSocket connection
    console.log('🔴 Real-time data stream started');
  }, []);

  const stopRealtime = useCallback(() => {
    setIsConnected(false);
    console.log('⏹️ Real-time data stream stopped');
  }, []);

  // Merge real-time data with base query results
  const combinedData = useMemo(() => {
    const baseData = baseQuery.results || [];
    const combined = [...baseData, ...realtimeData];
    
    // Remove duplicates and sort by timestamp
    const unique = combined.reduce((acc, item) => {
      const key = `${item.timestamp}-${item.entity_id}`;
      if (!acc.has(key)) {
        acc.set(key, item);
      }
      return acc;
    }, new Map());

    return Array.from(unique.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [baseQuery.results, realtimeData]);

  return {
    ...baseQuery,
    results: combinedData,
    realtimeData,
    isConnected,
    startRealtime,
    stopRealtime,
    connectionStatus: isConnected ? 'connected' : 'disconnected',
  };
}

export default useInfluxDBQuery; 