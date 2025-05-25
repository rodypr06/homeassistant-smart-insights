import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AnomalyDetectionCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

interface Anomaly {
  id: string;
  timestamp: string;
  entityId: string;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'drop' | 'pattern' | 'missing';
  description: string;
}

interface AnomalyMetrics {
  totalAnomalies: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  mostAffectedEntity: string;
  detectionRate: number;
}

const AnomalyDetectionCard: React.FC<AnomalyDetectionCardProps> = ({ 
  data, 
  timeRange, 
  isLoading 
}) => {
  // Generate mock anomalies for demonstration
  const anomalies = useMemo((): Anomaly[] => {
    // In a real implementation, this would analyze the actual data
    const mockAnomalies: Anomaly[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        entityId: 'sensor.living_room_temperature',
        value: 35.2,
        expectedValue: 22.5,
        severity: 'high',
        type: 'spike',
        description: 'Temperature spike detected - possible sensor malfunction'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        entityId: 'sensor.energy_meter',
        value: 0,
        expectedValue: 2.3,
        severity: 'medium',
        type: 'drop',
        description: 'Unexpected energy consumption drop'
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        entityId: 'sensor.humidity_bathroom',
        value: 95.8,
        expectedValue: 65.0,
        severity: 'medium',
        type: 'spike',
        description: 'Humidity spike - check ventilation system'
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        entityId: 'binary_sensor.door_sensor',
        value: 0,
        expectedValue: 1,
        severity: 'low',
        type: 'missing',
        description: 'Sensor communication lost for 30 minutes'
      }
    ];

    return mockAnomalies.slice(0, getAnomalyCount(timeRange));
  }, [timeRange]);

  // Calculate metrics
  const metrics = useMemo((): AnomalyMetrics => {
    const totalAnomalies = anomalies.length;
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

    const detectionRate = Math.random() * 20 + 80; // Mock detection rate 80-100%

    return {
      totalAnomalies,
      highSeverity,
      mediumSeverity,
      lowSeverity,
      mostAffectedEntity: mostAffectedEntity.replace('sensor.', '').replace(/_/g, ' '),
      detectionRate
    };
  }, [anomalies]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return anomalies.map((anomaly, index) => ({
      x: index,
      y: Math.abs(anomaly.value - anomaly.expectedValue),
      severity: anomaly.severity,
      entity: anomaly.entityId.replace('sensor.', '').replace(/_/g, ' '),
      time: new Date(anomaly.timestamp).toLocaleTimeString(),
      description: anomaly.description
    }));
  }, [anomalies]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
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
      default: return '❓';
    }
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="h-32 bg-slate-700 rounded mb-4"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
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
        <div className="flex items-center gap-1 text-sm text-green-400">
          <span>🎯</span>
          <span>{metrics.detectionRate.toFixed(1)}%</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Total Anomalies</p>
          <p className="text-lg font-semibold text-slate-200">
            {metrics.totalAnomalies}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Detection Rate</p>
          <p className="text-lg font-semibold text-green-400">
            {metrics.detectionRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">High Severity</p>
          <p className="text-lg font-semibold text-red-400">
            {metrics.highSeverity}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Most Affected</p>
          <p className="text-sm font-medium text-slate-200 capitalize">
            {metrics.mostAffectedEntity}
          </p>
        </div>
      </div>

      {/* Severity Distribution */}
      <div className="flex items-center gap-4 mb-6">
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
                  `${props.payload.entity} at ${props.payload.time}`
                ]}
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
        <h4 className="text-sm font-medium text-slate-300 mb-3">🚨 Recent Anomalies</h4>
        {anomalies.slice(0, 3).map((anomaly) => (
          <div key={anomaly.id} className="bg-slate-800/30 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <span className="text-lg">{getSeverityIcon(anomaly.severity)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-300 capitalize">
                      {anomaly.entityId.replace('sensor.', '').replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs">{getTypeIcon(anomaly.type)}</span>
                  </div>
                  <p className="text-xs text-slate-400">{anomaly.description}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(anomaly.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full ${
                anomaly.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                anomaly.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {anomaly.severity}
              </div>
            </div>
          </div>
        ))}
        
        {anomalies.length === 0 && (
          <div className="text-center py-4">
            <span className="text-2xl mb-2 block">✅</span>
            <p className="text-sm text-slate-400">No anomalies detected</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper functions
function getAnomalyCount(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 1;
    case '24h': return 2;
    case '7d': return 4;
    case '30d': return 6;
    case '90d': return 8;
    default: return 4;
  }
}

export default AnomalyDetectionCard; 