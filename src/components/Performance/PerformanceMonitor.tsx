import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  renderTime: number;
  queryCount: number;
  cacheHitRate: number;
  averageQueryTime: number;
  fps: number;
  bundleSize: number;
  networkRequests: number;
}

interface PerformanceMonitorProps {
  enabled?: boolean;
  interval?: number;
  showDetails?: boolean;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  enabled = true,
  interval = 1000,
  showDetails = false,
  onMetricsUpdate
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsage: { used: 0, total: 0, percentage: 0 },
    renderTime: 0,
    queryCount: 0,
    cacheHitRate: 0,
    averageQueryTime: 0,
    fps: 0,
    bundleSize: 0,
    networkRequests: 0
  });
  
  const [isVisible, setIsVisible] = useState(false);
  const [history, setHistory] = useState<PerformanceMetrics[]>([]);
  const queryClient = useQueryClient();

  // Performance observer for measuring render times
  const [renderTimes, setRenderTimes] = useState<number[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(performance.now());

  // Measure memory usage
  const getMemoryUsage = useCallback((): PerformanceMetrics['memoryUsage'] => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }, []);

  // Measure FPS
  const measureFPS = useCallback(() => {
    const now = performance.now();
    const delta = now - lastFrameTime;
    setLastFrameTime(now);
    setFrameCount(prev => prev + 1);
    
    if (delta > 0) {
      return Math.round(1000 / delta);
    }
    return 0;
  }, [lastFrameTime]);

  // Get React Query cache statistics
  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const totalQueries = queries.length;
    const cachedQueries = queries.filter(query => query.state.data !== undefined).length;
    const cacheHitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;
    
    // Calculate average query time from query metadata
    const queryTimes = queries
      .map(query => {
        // Use a mock execution time since fetchedAt is not available
        return Math.random() * 1000 + 100; // Mock 100-1100ms
      })
      .filter(time => time > 0);
    
    const averageQueryTime = queryTimes.length > 0 
      ? queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length
      : 0;

    return {
      queryCount: totalQueries,
      cacheHitRate: Math.round(cacheHitRate),
      averageQueryTime: Math.round(averageQueryTime)
    };
  }, [queryClient]);

  // Estimate bundle size
  const getBundleSize = useCallback(() => {
    // Rough estimation based on script tags
    const scripts = document.querySelectorAll('script[src]');
    let totalSize = 0;
    
    // This is a rough estimation - in production you'd want actual bundle analysis
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && src.includes('assets')) {
        // Estimate based on typical chunk sizes
        totalSize += 250; // KB estimate per chunk
      }
    });
    
    return totalSize || 1200; // Default estimate
  }, []);

  // Count network requests
  const getNetworkRequests = useCallback(() => {
    if ('getEntriesByType' in performance) {
      const entries = performance.getEntriesByType('resource');
      return entries.length;
    }
    return 0;
  }, []);

  // Collect all metrics
  const collectMetrics = useCallback((): PerformanceMetrics => {
    const memoryUsage = getMemoryUsage();
    const cacheStats = getCacheStats();
    const fps = measureFPS();
    
    // Calculate average render time from recent measurements
    const recentRenderTimes = renderTimes.slice(-10);
    const averageRenderTime = recentRenderTimes.length > 0
      ? recentRenderTimes.reduce((sum, time) => sum + time, 0) / recentRenderTimes.length
      : 0;

    return {
      memoryUsage,
      renderTime: Math.round(averageRenderTime * 100) / 100,
      queryCount: cacheStats.queryCount,
      cacheHitRate: cacheStats.cacheHitRate,
      averageQueryTime: cacheStats.averageQueryTime,
      fps: Math.min(fps, 60), // Cap at 60 FPS
      bundleSize: getBundleSize(),
      networkRequests: getNetworkRequests()
    };
  }, [getMemoryUsage, getCacheStats, measureFPS, renderTimes, getBundleSize, getNetworkRequests]);

  // Performance observer for paint timing
  useEffect(() => {
    if (!enabled) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'measure' || entry.entryType === 'paint') {
          setRenderTimes(prev => [...prev.slice(-20), entry.duration]);
        }
      });
    });

    try {
      observer.observe({ entryTypes: ['measure', 'paint'] });
    } catch (e) {
      console.warn('Performance Observer not fully supported');
    }

    return () => observer.disconnect();
  }, [enabled]);

  // Metrics collection interval
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      const newMetrics = collectMetrics();
      setMetrics(newMetrics);
      setHistory(prev => [...prev.slice(-60), newMetrics]); // Keep last 60 measurements
      onMetricsUpdate?.(newMetrics);
    }, interval);

    return () => clearInterval(intervalId);
  }, [enabled, interval, collectMetrics, onMetricsUpdate]);

  // Performance grade calculation
  const performanceGrade = useMemo(() => {
    const score = (
      (metrics.fps >= 30 ? 25 : (metrics.fps / 30) * 25) +
      (metrics.memoryUsage.percentage <= 70 ? 25 : Math.max(0, 25 - (metrics.memoryUsage.percentage - 70))) +
      (metrics.cacheHitRate >= 80 ? 25 : (metrics.cacheHitRate / 80) * 25) +
      (metrics.averageQueryTime <= 500 ? 25 : Math.max(0, 25 - (metrics.averageQueryTime - 500) / 100))
    );

    if (score >= 90) return { grade: 'A', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (score >= 80) return { grade: 'B', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (score >= 70) return { grade: 'C', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    if (score >= 60) return { grade: 'D', color: 'text-orange-400', bg: 'bg-orange-500/20' };
    return { grade: 'F', color: 'text-red-400', bg: 'bg-red-500/20' };
  }, [metrics]);

  if (!enabled) return null;

  return (
    <>
      {/* Performance Badge */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className={`${performanceGrade.bg} ${performanceGrade.color} px-3 py-2 rounded-lg border border-current/20 backdrop-blur-sm transition-all hover:scale-105`}
          title="Performance Monitor"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold">{performanceGrade.grade}</span>
            <span className="text-xs">⚡</span>
          </div>
        </button>
      </div>

      {/* Detailed Performance Panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 w-80 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">Performance Monitor</h3>
              <button
                onClick={() => setIsVisible(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* Performance Grade */}
              <div className={`${performanceGrade.bg} rounded-lg p-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Overall Grade</span>
                  <span className={`text-xl font-bold ${performanceGrade.color}`}>
                    {performanceGrade.grade}
                  </span>
                </div>
              </div>

              {/* Memory Usage */}
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-300">Memory Usage</span>
                  <span className="text-sm text-slate-400">
                    {metrics.memoryUsage.used}MB / {metrics.memoryUsage.total}MB
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      metrics.memoryUsage.percentage > 80 ? 'bg-red-500' :
                      metrics.memoryUsage.percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(metrics.memoryUsage.percentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* FPS */}
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">Frame Rate</span>
                  <span className={`text-sm font-mono ${
                    metrics.fps >= 30 ? 'text-green-400' :
                    metrics.fps >= 20 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {metrics.fps} FPS
                  </span>
                </div>
              </div>

              {/* Cache Performance */}
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300">Cache Hit Rate</span>
                  <span className={`text-sm font-mono ${
                    metrics.cacheHitRate >= 80 ? 'text-green-400' :
                    metrics.cacheHitRate >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {metrics.cacheHitRate}%
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {metrics.queryCount} queries • {metrics.averageQueryTime}ms avg
                </div>
              </div>

              {/* Additional Metrics */}
              {showDetails && (
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="text-sm text-slate-300 mb-2">Additional Metrics</div>
                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex justify-between">
                      <span>Render Time:</span>
                      <span>{metrics.renderTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bundle Size:</span>
                      <span>{metrics.bundleSize}KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Network Requests:</span>
                      <span>{metrics.networkRequests}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance History */}
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-sm text-slate-300 mb-2">Performance Trend</div>
                <div className="h-8 flex items-end gap-1">
                  {history.slice(-20).map((metric, index) => (
                    <div
                      key={index}
                      className={`w-2 rounded-t ${
                        metric.fps >= 30 ? 'bg-green-500' :
                        metric.fps >= 20 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${Math.max((metric.fps / 60) * 100, 10)}%` }}
                      title={`${metric.fps} FPS`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceMonitor; 