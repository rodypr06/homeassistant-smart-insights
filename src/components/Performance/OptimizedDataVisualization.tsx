import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, Cell } from 'recharts';
import { useVirtualizer } from '@tanstack/react-virtual';

interface DataPoint {
  timestamp: string;
  value: number;
  entity_id: string;
  [key: string]: any;
}

interface OptimizedDataVisualizationProps {
  data: DataPoint[];
  chartType: 'line' | 'bar' | 'scatter' | 'heatmap';
  title: string;
  height?: number;
  maxDataPoints?: number;
  enableVirtualization?: boolean;
  enableDownsampling?: boolean;
  downsampleThreshold?: number;
  onDataPointClick?: (point: DataPoint) => void;
  loading?: boolean;
}

// Memoized chart components for better performance
const MemoizedLineChart = React.memo(({ data, height, onDataPointClick }: {
  data: DataPoint[];
  height: number;
  onDataPointClick?: (point: DataPoint) => void;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
      <XAxis 
        dataKey="timestamp" 
        stroke="#9CA3AF" 
        fontSize={12}
        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
      />
      <YAxis stroke="#9CA3AF" fontSize={12} />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1F2937', 
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#F3F4F6'
        }}
        labelFormatter={(value) => new Date(value).toLocaleString()}
        formatter={(value: number) => [value.toFixed(2), 'Value']}
      />
      <Line 
        type="monotone" 
        dataKey="value" 
        stroke="#3B82F6" 
        strokeWidth={2}
        dot={false} // Disable dots for better performance with large datasets
        activeDot={{ r: 4, stroke: '#3B82F6', strokeWidth: 2 }}
      />
    </LineChart>
  </ResponsiveContainer>
));

const MemoizedBarChart = React.memo(({ data, height }: {
  data: DataPoint[];
  height: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
      <XAxis 
        dataKey="timestamp" 
        stroke="#9CA3AF" 
        fontSize={12}
        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
      />
      <YAxis stroke="#9CA3AF" fontSize={12} />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1F2937', 
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#F3F4F6'
        }}
        labelFormatter={(value) => new Date(value).toLocaleString()}
        formatter={(value: number) => [value.toFixed(2), 'Value']}
      />
      <Bar dataKey="value" fill="#3B82F6" />
    </BarChart>
  </ResponsiveContainer>
));

const MemoizedScatterChart = React.memo(({ data, height }: {
  data: DataPoint[];
  height: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <ScatterChart data={data}>
      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
      <XAxis 
        dataKey="timestamp" 
        stroke="#9CA3AF" 
        fontSize={12}
        type="number"
        scale="time"
        domain={['dataMin', 'dataMax']}
        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
      />
      <YAxis stroke="#9CA3AF" fontSize={12} />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1F2937', 
          border: '1px solid #374151',
          borderRadius: '8px',
          color: '#F3F4F6'
        }}
        formatter={(value: number) => [value.toFixed(2), 'Value']}
      />
      <Scatter dataKey="value" fill="#3B82F6" />
    </ScatterChart>
  </ResponsiveContainer>
));

// Data processing utilities
const downsampleData = (data: DataPoint[], maxPoints: number): DataPoint[] => {
  if (data.length <= maxPoints) return data;
  
  const step = Math.ceil(data.length / maxPoints);
  const downsampled: DataPoint[] = [];
  
  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);
    if (chunk.length === 0) continue;
    
    // Use LTTB (Largest Triangle Three Buckets) algorithm for better downsampling
    if (chunk.length === 1) {
      downsampled.push(chunk[0]);
    } else {
      // For simplicity, we'll use average for this demo
      const avgValue = chunk.reduce((sum, point) => sum + point.value, 0) / chunk.length;
      downsampled.push({
        ...chunk[Math.floor(chunk.length / 2)],
        value: avgValue
      });
    }
  }
  
  return downsampled;
};

const OptimizedDataVisualization: React.FC<OptimizedDataVisualizationProps> = ({
  data,
  chartType,
  title,
  height = 400,
  maxDataPoints = 1000,
  enableVirtualization = false,
  enableDownsampling = true,
  downsampleThreshold = 500,
  onDataPointClick,
  loading = false
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoized data processing
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    let processed = [...data];

    // Apply time range filtering if selected
    if (selectedRange) {
      const [start, end] = selectedRange;
      processed = processed.filter((point, index) => index >= start && index <= end);
    }

    // Apply downsampling if enabled and data exceeds threshold
    if (enableDownsampling && processed.length > downsampleThreshold) {
      processed = downsampleData(processed, maxDataPoints);
    }

    // Sort by timestamp to ensure proper ordering
    processed.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return processed;
  }, [data, selectedRange, enableDownsampling, downsampleThreshold, maxDataPoints]);

  // Memoized statistics
  const dataStats = useMemo(() => {
    if (processedData.length === 0) return null;

    const values = processedData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

    return { min, max, avg, median, count: processedData.length };
  }, [processedData]);

  // Virtual scrolling for data table view
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  // Handle chart click for data point selection
  const handleChartClick = useCallback((event: any) => {
    if (event && event.activePayload && event.activePayload[0]) {
      const dataPoint = event.activePayload[0].payload;
      onDataPointClick?.(dataPoint);
    }
  }, [onDataPointClick]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setSelectedRange(null);
  }, []);

  // Range selection
  const handleRangeSelect = useCallback((start: number, end: number) => {
    setSelectedRange([start, end]);
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading visualization...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <span className="text-4xl mb-4 block">📊</span>
            <p className="text-slate-400">No data available for visualization</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          {dataStats && (
            <p className="text-sm text-slate-400">
              {dataStats.count.toLocaleString()} points • 
              Min: {dataStats.min.toFixed(2)} • 
              Max: {dataStats.max.toFixed(2)} • 
              Avg: {dataStats.avg.toFixed(2)}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={handleZoomIn}
            className="btn-secondary text-sm"
            title="Zoom In"
          >
            🔍+
          </button>
          <button
            onClick={handleZoomOut}
            className="btn-secondary text-sm"
            title="Zoom Out"
          >
            🔍-
          </button>
          <button
            onClick={handleResetZoom}
            className="btn-secondary text-sm"
            title="Reset Zoom"
          >
            ↺
          </button>
          
          {/* Performance indicators */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            {enableDownsampling && processedData.length < data.length && (
              <span title="Data downsampled for performance">📉</span>
            )}
            {enableVirtualization && (
              <span title="Virtual scrolling enabled">⚡</span>
            )}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div 
        className="relative"
        style={{ 
          height: height - 100,
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
          overflow: 'hidden'
        }}
      >
        {chartType === 'line' && (
          <MemoizedLineChart 
            data={processedData} 
            height={height - 100}
            onDataPointClick={handleChartClick}
          />
        )}
        
        {chartType === 'bar' && (
          <MemoizedBarChart 
            data={processedData} 
            height={height - 100}
          />
        )}
        
        {chartType === 'scatter' && (
          <MemoizedScatterChart 
            data={processedData} 
            height={height - 100}
          />
        )}
        
        {chartType === 'heatmap' && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Heatmap visualization coming soon...</p>
          </div>
        )}
      </div>

      {/* Performance info */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div>
            Original: {data.length.toLocaleString()} points • 
            Displayed: {processedData.length.toLocaleString()} points
            {enableDownsampling && processedData.length < data.length && (
              <span className="text-yellow-400 ml-2">
                (Downsampled for performance)
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <span>Zoom: {(zoomLevel * 100).toFixed(0)}%</span>
            {selectedRange && (
              <span>
                Range: {selectedRange[0]} - {selectedRange[1]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedDataVisualization; 