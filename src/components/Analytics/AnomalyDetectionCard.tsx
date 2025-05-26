import React, { useMemo, useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { anomalyDetectionService, type DetectedAnomaly, type EntityStats } from '../../services/anomalyDetectionService';

interface AnomalyDetectionCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

interface AnomalyMetrics {
  totalAnomalies: number;
  criticalAnomalies: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  mostAffectedEntity: string;
  detectionRate: number;
  healthyEntities: number;
  totalEntities: number;
  detectionMethods: Record<string, number>;
}

const AnomalyDetectionCard: React.FC<AnomalyDetectionCardProps> = ({ 
  data, 
  timeRange, 
  isLoading 
}) => {
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);
  const [entityStats, setEntityStats] = useState<EntityStats[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Run anomaly detection when data changes
  useEffect(() => {
    if (!data || data.length === 0) {
      setAnomalies([]);
      setEntityStats([]);
      return;
    }

    const runAnomalyDetection = async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      
      try {
        console.log('🔍 Running anomaly detection on', data.length, 'data points');
        console.log('📊 Raw data sample:', data.slice(0, 5));
        
        // Transform data to expected format
        const sensorReadings = data.map(item => ({
          timestamp: item.timestamp || item._time || new Date().toISOString(),
          entity_id: item.entity_id || item._field || `unknown_${Math.random().toString(36).substr(2, 9)}`,
          value: typeof item.value === 'number' ? item.value : (typeof item._value === 'number' ? item._value : parseFloat(item.value || item._value || '0')),
          state: item.state || String(item.value || item._value || '0')
        })).filter(reading => 
          reading.entity_id && 
          reading.timestamp && 
          !isNaN(reading.value)
        );

        console.log(`📊 Transformed ${sensorReadings.length} readings from ${data.length} raw data points`);
        if (sensorReadings.length > 0) {
          console.log('📊 Sample transformed data:', sensorReadings.slice(0, 3));
        }

        if (sensorReadings.length === 0) {
          console.warn('⚠️ No valid sensor readings after transformation');
          setAnomalies([]);
          setEntityStats([]);
          setAnalysisError('No valid sensor data found. Check data format and entity IDs.');
          return;
        }

        const result = await anomalyDetectionService.detectAnomalies(sensorReadings);
        
        setAnomalies(result.anomalies);
        setEntityStats(result.entityStats);
        
        console.log(`✅ Anomaly detection complete: ${result.anomalies.length} anomalies found across ${result.entityStats.length} entities`);
        
      } catch (error) {
        console.error('❌ Anomaly detection failed:', error);
        setAnalysisError(error instanceof Error ? error.message : 'Unknown error');
        
        // Fallback to empty results
        setAnomalies([]);
        setEntityStats([]);
      } finally {
        setAnalysisLoading(false);
      }
    };

    runAnomalyDetection();
  }, [data, timeRange]);

  // Calculate metrics from real anomaly data
  const metrics = useMemo((): AnomalyMetrics => {
    const totalAnomalies = anomalies.length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
    const highSeverity = anomalies.filter(a => a.severity === 'high').length;
    const mediumSeverity = anomalies.filter(a => a.severity === 'medium').length;
    const lowSeverity = anomalies.filter(a => a.severity === 'low').length;
    
    // Find most affected entity
    const entityCounts = anomalies.reduce((acc, anomaly) => {
      acc[anomaly.entityId] = (acc[anomaly.entityId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostAffectedEntity = Object.entries(entityCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

    // Calculate detection rate based on healthy entities
    const healthyEntities = entityStats.filter(s => s.isHealthy).length;
    const totalEntities = entityStats.length;
    const detectionRate = totalEntities > 0 ? (healthyEntities / totalEntities) * 100 : 0;

    // Count detection methods
    const detectionMethods = anomalies.reduce((acc, anomaly) => {
      acc[anomaly.method] = (acc[anomaly.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAnomalies,
      criticalAnomalies,
      highSeverity,
      mediumSeverity,
      lowSeverity,
      mostAffectedEntity: mostAffectedEntity.replace(/^(sensor|binary_sensor)\./, '').replace(/_/g, ' '),
      detectionRate,
      healthyEntities,
      totalEntities,
      detectionMethods
    };
  }, [anomalies, entityStats]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return anomalies.slice(0, 20).map((anomaly, index) => ({ // Limit to 20 points for readability
      x: index,
      y: anomaly.deviation,
      severity: anomaly.severity,
      entity: anomaly.entityId.replace(/^(sensor|binary_sensor)\./, '').replace(/_/g, ' '),
      time: new Date(anomaly.timestamp).toLocaleTimeString(),
      description: anomaly.description,
      method: anomaly.method,
      confidence: anomaly.confidence
    }));
  }, [anomalies]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#DC2626'; // red-600
      case 'high': return '#EF4444';     // red-500
      case 'medium': return '#F59E0B';   // amber-500
      case 'low': return '#10B981';      // emerald-500
      default: return '#6B7280';         // gray-500
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🔥';
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return '💡';
      default: return '📊';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'spike': return '📈';
      case 'drop': return '📉';
      case 'pattern': return '🔄';
      case 'missing': return '❌';
      case 'stuck': return '🔒';
      default: return '❓';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'z-score': return '📊';
      case 'iqr': return '📈';
      case 'pattern': return '🔄';
      case 'missing-data': return '❌';
      default: return '🔍';
    }
  };

  if (isLoading || analysisLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="h-32 bg-slate-700 rounded mb-4"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        {analysisLoading && (
          <div className="text-center mt-4">
            <div className="inline-flex items-center gap-2 text-sm text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              Analyzing sensor data for anomalies...
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
            <span className="text-xl">🔍</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Anomaly Detection</h3>
            <p className="text-sm text-slate-400">Unusual patterns & outliers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-green-400">
            <span>🎯</span>
            <span>{metrics.detectionRate.toFixed(1)}%</span>
          </div>
          {data && data.length > 0 && (
            <div className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded">
              📊 Live Data
            </div>
          )}
        </div>
      </div>

      {/* Analysis Error */}
      {analysisError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400">❌</span>
            <span className="text-sm font-medium text-red-400">Analysis Error</span>
          </div>
          <p className="text-xs text-red-300">{analysisError}</p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Total Anomalies</p>
          <p className="text-lg font-semibold text-slate-200">
            {metrics.totalAnomalies}
          </p>
          {metrics.criticalAnomalies > 0 && (
            <p className="text-xs text-red-400">🔥 {metrics.criticalAnomalies} critical</p>
          )}
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Healthy Entities</p>
          <p className="text-lg font-semibold text-green-400">
            {metrics.healthyEntities}/{metrics.totalEntities}
          </p>
          <p className="text-xs text-slate-500">
            {metrics.detectionRate.toFixed(1)}% reporting
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">High Severity</p>
          <p className="text-lg font-semibold text-red-400">
            {metrics.highSeverity}
          </p>
          {metrics.mediumSeverity > 0 && (
            <p className="text-xs text-yellow-400">⚠️ {metrics.mediumSeverity} medium</p>
          )}
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Most Affected</p>
          <p className="text-sm font-medium text-slate-200 capitalize">
            {metrics.mostAffectedEntity}
          </p>
          {Object.keys(metrics.detectionMethods).length > 0 && (
            <p className="text-xs text-slate-500">
              {Object.keys(metrics.detectionMethods).length} methods used
            </p>
          )}
        </div>
      </div>

      {/* Severity Distribution */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {metrics.criticalAnomalies > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span className="text-xs text-slate-400">Critical ({metrics.criticalAnomalies})</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-xs text-slate-400">High ({metrics.highSeverity})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span className="text-xs text-slate-400">Medium ({metrics.mediumSeverity})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-xs text-slate-400">Low ({metrics.lowSeverity})</span>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="h-32 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="x" 
                stroke="#9CA3AF" 
                fontSize={12}
                tick={false}
              />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
                formatter={(value: number, name: string, props: any) => [
                  `Deviation: ${value.toFixed(2)}`,
                  `${props.payload.entity} (${props.payload.method})`
                ]}
                labelFormatter={(label: any, payload: any) => {
                  if (payload && payload.length > 0) {
                    const data = payload[0].payload;
                    return `${data.time} - ${data.severity} severity (${(data.confidence * 100).toFixed(0)}% confidence)`;
                  }
                  return '';
                }}
              />
              <Scatter dataKey="y">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Anomalies */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-slate-300">🚨 Recent Anomalies</h4>
          {anomalies.length > 3 && (
            <span className="text-xs text-slate-500">
              Showing 3 of {anomalies.length}
            </span>
          )}
        </div>
        
        <div className="max-h-64 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
          {anomalies.slice(0, 5).map((anomaly) => (
            <div key={anomaly.id} className="bg-slate-800/30 rounded-lg p-3 hover:bg-slate-800/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getSeverityIcon(anomaly.severity)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-300 capitalize">
                        {anomaly.entityId.replace(/^(sensor|binary_sensor)\./, '').replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs">{getTypeIcon(anomaly.type)}</span>
                      <span className="text-xs text-slate-500">{getMethodIcon(anomaly.method)}</span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{anomaly.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-slate-500">
                        {new Date(anomaly.timestamp).toLocaleString()}
                      </p>
                      <span className="text-xs text-slate-500">
                        {(anomaly.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${
                  anomaly.severity === 'critical' ? 'bg-red-600/30 text-red-300' :
                  anomaly.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                  anomaly.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-green-500/20 text-green-400'
                }`}>
                  {anomaly.severity}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {anomalies.length === 0 && !analysisError && (
          <div className="text-center py-6">
            <span className="text-2xl mb-2 block">✅</span>
            <p className="text-sm text-slate-400">No anomalies detected</p>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.totalEntities > 0 
                ? `Analyzed ${metrics.totalEntities} entities` 
                : 'No sensor data available for analysis'
              }
            </p>

          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyDetectionCard; 