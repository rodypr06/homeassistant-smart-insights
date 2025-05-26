import React, { useState, useMemo } from 'react';
import VirtualDataTable from './VirtualDataTable';
import OptimizedDataVisualization from './OptimizedDataVisualization';
import useInfluxDBQuery, { useInfluxDBBatchQuery, useInfluxDBRealtime } from '../../hooks/useInfluxDBQuery';

interface PerformanceDashboardProps {}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = () => {
  const [selectedDemo, setSelectedDemo] = useState<'table' | 'chart' | 'realtime' | 'batch'>('table');
  const [dataSize, setDataSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Generate mock data for performance testing
  const mockData = useMemo(() => {
    const sizes = {
      small: 100,
      medium: 1000,
      large: 10000
    };
    
    const count = sizes[dataSize];
    return Array.from({ length: count }, (_, i) => ({
      id: `row-${i}`,
      timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
      entity_id: `sensor.demo_sensor_${Math.floor(i / 10)}`,
      value: Math.random() * 100 + 20,
      measurement: 'temperature',
      field: 'value',
      location: ['living_room', 'bedroom', 'kitchen', 'bathroom'][Math.floor(Math.random() * 4)],
      status: ['online', 'offline'][Math.floor(Math.random() * 2)]
    }));
  }, [dataSize]);

  // Performance query examples
  const singleQuery = useInfluxDBQuery({
    query: `from(bucket: "demo") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "temperature")`,
    enabled: selectedDemo === 'realtime',
    refetchInterval: 5000,
  });

  const batchQuery = useInfluxDBBatchQuery([
    `from(bucket: "demo") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "temperature")`,
    `from(bucket: "demo") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "humidity")`,
    `from(bucket: "demo") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "pressure")`,
  ]);

  const realtimeQuery = useInfluxDBRealtime(
    `from(bucket: "demo") |> range(start: -5m) |> filter(fn: (r) => r._measurement == "temperature")`,
    2000 // 2 second interval
  );

  // Table columns configuration
  const tableColumns = [
    { key: 'timestamp', label: 'Timestamp', width: 180, formatter: (value: string) => new Date(value).toLocaleString() },
    { key: 'entity_id', label: 'Entity ID', width: 200 },
    { key: 'value', label: 'Value', width: 100, align: 'right' as const, formatter: (value: number) => value.toFixed(2) },
    { key: 'location', label: 'Location', width: 120 },
    { key: 'status', label: 'Status', width: 100, formatter: (value: string) => (
      <span className={`px-2 py-1 rounded-full text-xs ${
        value === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
      }`}>
        {value}
      </span>
    )}
  ];

  const handleRowClick = (row: any) => {
    console.log('Row clicked:', row);
  };

  const handleRowSelect = (selectedRows: any[]) => {
    console.log('Selected rows:', selectedRows);
  };

  const handleDataPointClick = (point: any) => {
    console.log('Data point clicked:', point);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Performance Dashboard
          </h2>
          <p className="text-slate-400 mt-1">
            Showcase of performance optimizations and virtual scrolling
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Data Size Selector */}
          <select
            value={dataSize}
            onChange={(e) => setDataSize(e.target.value as 'small' | 'medium' | 'large')}
            className="input-field text-sm"
          >
            <option value="small">Small (100 rows)</option>
            <option value="medium">Medium (1K rows)</option>
            <option value="large">Large (10K rows)</option>
          </select>

          {/* Demo Type Selector */}
          <select
            value={selectedDemo}
            onChange={(e) => setSelectedDemo(e.target.value as any)}
            className="input-field text-sm"
          >
            <option value="table">Virtual Table</option>
            <option value="chart">Optimized Charts</option>
            <option value="realtime">Real-time Data</option>
            <option value="batch">Batch Queries</option>
          </select>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Data Points</p>
              <p className="text-lg font-semibold text-slate-200">
                {mockData.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Virtual Scrolling</p>
              <p className="text-lg font-semibold text-green-400">Enabled</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">🔄</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Cache Hit Rate</p>
              <p className="text-lg font-semibold text-purple-400">
                {singleQuery.metrics?.cacheHitRate || 0}%
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">⏱️</span>
            </div>
            <div>
              <p className="text-sm text-slate-400">Avg Query Time</p>
              <p className="text-lg font-semibold text-orange-400">
                {singleQuery.metrics?.executionTime || 0}ms
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Content */}
      {selectedDemo === 'table' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              🚀 Virtual Data Table Demo
            </h3>
            <p className="text-slate-400 mb-4">
              This table uses virtual scrolling to efficiently render {mockData.length.toLocaleString()} rows. 
              Only visible rows are rendered in the DOM, providing smooth scrolling performance.
            </p>
            
            <VirtualDataTable
              data={mockData}
              columns={tableColumns}
              height={600}
              rowHeight={50}
              onRowClick={handleRowClick}
              onRowSelect={handleRowSelect}
              selectable={true}
              searchable={true}
              sortable={true}
            />
          </div>
        </div>
      )}

      {selectedDemo === 'chart' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              📈 Optimized Data Visualization
            </h3>
            <p className="text-slate-400 mb-4">
              Charts with automatic downsampling, memoization, and zoom controls for optimal performance.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OptimizedDataVisualization
              data={mockData}
              chartType="line"
              title="Line Chart (Optimized)"
              height={400}
              enableDownsampling={true}
              downsampleThreshold={500}
              onDataPointClick={handleDataPointClick}
            />
            
            <OptimizedDataVisualization
              data={mockData}
              chartType="bar"
              title="Bar Chart (Optimized)"
              height={400}
              enableDownsampling={true}
              downsampleThreshold={500}
            />
          </div>
        </div>
      )}

      {selectedDemo === 'realtime' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              🔴 Real-time Data Streaming
            </h3>
            <p className="text-slate-400 mb-4">
              Live data updates with optimized caching and background refetching.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Connection Status</p>
                <p className={`text-lg font-semibold ${
                  realtimeQuery.isConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {realtimeQuery.connectionStatus}
                </p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Data Points</p>
                <p className="text-lg font-semibold text-slate-200">
                  {realtimeQuery.results?.length || 0}
                </p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Update Interval</p>
                <p className="text-lg font-semibold text-blue-400">2s</p>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <button
                onClick={realtimeQuery.startRealtime}
                disabled={realtimeQuery.isConnected}
                className="btn-primary"
              >
                Start Stream
              </button>
              <button
                onClick={realtimeQuery.stopRealtime}
                disabled={!realtimeQuery.isConnected}
                className="btn-secondary"
              >
                Stop Stream
              </button>
            </div>

            <OptimizedDataVisualization
              data={realtimeQuery.results || []}
              chartType="line"
              title="Real-time Data Stream"
              height={400}
              loading={realtimeQuery.isLoading}
            />
          </div>
        </div>
      )}

      {selectedDemo === 'batch' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              📦 Batch Query Processing
            </h3>
            <p className="text-slate-400 mb-4">
              Execute multiple queries in parallel with concurrency control and progress tracking.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Total Queries</p>
                <p className="text-lg font-semibold text-slate-200">
                  {batchQuery.totalQueries}
                </p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Completed</p>
                <p className="text-lg font-semibold text-green-400">
                  {batchQuery.completedQueries}
                </p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-sm text-slate-400">Status</p>
                <p className={`text-lg font-semibold ${
                  batchQuery.isLoading ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {batchQuery.isLoading ? 'Processing...' : 'Complete'}
                </p>
              </div>
            </div>

            <button
              onClick={batchQuery.executeBatch}
              disabled={batchQuery.isLoading}
              className="btn-primary mb-6"
            >
              {batchQuery.isLoading ? 'Processing...' : 'Execute Batch Queries'}
            </button>

            {Object.keys(batchQuery.results).length > 0 && (
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-slate-300">Batch Results</h4>
                {Object.entries(batchQuery.results).map(([query, result], index) => (
                  <div key={index} className="bg-slate-800/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-sm font-medium text-slate-300">
                        Query {index + 1}
                      </h5>
                      <span className="text-xs text-slate-400">
                        {result.totalCount} results • {result.executionTime}ms
                      </span>
                    </div>
                    <code className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded block">
                      {query.slice(0, 80)}...
                    </code>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Tips */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">
          💡 Performance Optimization Tips
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Virtual Scrolling</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• Only renders visible rows in DOM</li>
              <li>• Handles 10K+ rows smoothly</li>
              <li>• Configurable row height and overscan</li>
              <li>• Built-in search and sorting</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Data Caching</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• React Query with 5-minute stale time</li>
              <li>• Automatic background refetching</li>
              <li>• Query deduplication and batching</li>
              <li>• Cache invalidation patterns</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Chart Optimization</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• Automatic data downsampling</li>
              <li>• Memoized chart components</li>
              <li>• Disabled dots for large datasets</li>
              <li>• Zoom and pan controls</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-300">Memory Management</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• Cleanup intervals and observers</li>
              <li>• Efficient data structures</li>
              <li>• Garbage collection optimization</li>
              <li>• Memory usage monitoring</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard; 