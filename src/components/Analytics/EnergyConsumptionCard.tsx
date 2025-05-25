import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface EnergyConsumptionCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

interface EnergyMetrics {
  totalConsumption: number;
  averageDaily: number;
  peakUsage: number;
  costEstimate: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

const EnergyConsumptionCard: React.FC<EnergyConsumptionCardProps> = ({ 
  data, 
  timeRange, 
  isLoading 
}) => {
  // Calculate energy metrics
  const metrics = useMemo((): EnergyMetrics => {
    if (!data || data.length === 0) {
      return {
        totalConsumption: 0,
        averageDaily: 0,
        peakUsage: 0,
        costEstimate: 0,
        trend: 'stable',
        trendPercentage: 0
      };
    }

    // Mock calculations - replace with real data processing
    const totalConsumption = data.reduce((sum, item) => sum + (item.value || 0), 0);
    const averageDaily = totalConsumption / Math.max(1, getDaysFromTimeRange(timeRange));
    const peakUsage = Math.max(...data.map(item => item.value || 0));
    const costEstimate = totalConsumption * 0.12; // $0.12 per kWh
    
    // Calculate trend (mock)
    const trend: 'up' | 'down' | 'stable' = totalConsumption > 100 ? 'up' : totalConsumption < 50 ? 'down' : 'stable';
    const trendPercentage = Math.random() * 20; // Mock percentage

    return {
      totalConsumption,
      averageDaily,
      peakUsage,
      costEstimate,
      trend,
      trendPercentage
    };
  }, [data, timeRange]);

  // Generate mock chart data for demonstration
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      // Generate mock data for demonstration
      const days = getDaysFromTimeRange(timeRange);
      return Array.from({ length: Math.min(days, 30) }, (_, i) => ({
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        consumption: Math.random() * 50 + 20,
        cost: (Math.random() * 50 + 20) * 0.12
      }));
    }
    
    return data.map(item => ({
      date: new Date(item.timestamp).toLocaleDateString(),
      consumption: item.value || 0,
      cost: (item.value || 0) * 0.12
    }));
  }, [data, timeRange]);

  const getTrendIcon = () => {
    switch (metrics.trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = () => {
    switch (metrics.trend) {
      case 'up': return 'text-red-400';
      case 'down': return 'text-green-400';
      default: return 'text-slate-400';
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
          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
            <span className="text-xl">⚡</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Energy Consumption</h3>
            <p className="text-sm text-slate-400">Power usage analysis</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
          <span>{getTrendIcon()}</span>
          <span>{metrics.trendPercentage.toFixed(1)}%</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Total Consumption</p>
          <p className="text-lg font-semibold text-slate-200">
            {metrics.totalConsumption.toFixed(1)} kWh
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Daily Average</p>
          <p className="text-lg font-semibold text-slate-200">
            {metrics.averageDaily.toFixed(1)} kWh
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Peak Usage</p>
          <p className="text-lg font-semibold text-slate-200">
            {metrics.peakUsage.toFixed(1)} kWh
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Est. Cost</p>
          <p className="text-lg font-semibold text-green-400">
            ${metrics.costEstimate.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF" 
              fontSize={12}
              tickFormatter={(value) => value.split('/').slice(0, 2).join('/')}
            />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F3F4F6'
              }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)} ${name === 'consumption' ? 'kWh' : '$'}`,
                name === 'consumption' ? 'Consumption' : 'Cost'
              ]}
            />
            <Line 
              type="monotone" 
              dataKey="consumption" 
              stroke="#F59E0B" 
              strokeWidth={2}
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#F59E0B', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="bg-slate-800/30 rounded-lg p-3">
        <h4 className="text-sm font-medium text-slate-300 mb-2">💡 Insights</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Peak usage typically occurs during {getPeakHours()}</li>
          <li>• Consider shifting high-energy tasks to off-peak hours</li>
          <li>• {getEfficiencyTip(metrics.trend)}</li>
        </ul>
      </div>
    </div>
  );
};

// Helper functions
function getDaysFromTimeRange(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 1/24;
    case '24h': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    default: return 7;
  }
}

function getPeakHours(): string {
  const hours = ['morning (8-10 AM)', 'evening (6-8 PM)', 'afternoon (2-4 PM)'];
  return hours[Math.floor(Math.random() * hours.length)];
}

function getEfficiencyTip(trend: 'up' | 'down' | 'stable'): string {
  const tips = {
    up: 'Energy usage is increasing - check for inefficient devices',
    down: 'Great job! Energy usage is decreasing',
    stable: 'Energy usage is stable - look for optimization opportunities'
  };
  return tips[trend];
}

export default EnergyConsumptionCard; 