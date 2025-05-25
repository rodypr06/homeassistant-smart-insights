import React from 'react';

interface WeatherCorrelationCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

const WeatherCorrelationCard: React.FC<WeatherCorrelationCardProps> = ({ data, timeRange, isLoading }) => {
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
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
          <span className="text-xl">🌤️</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Weather Correlation</h3>
          <p className="text-sm text-slate-400">Climate impact analysis</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Current Temp</p>
          <p className="text-lg font-semibold text-slate-200">72°F</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Energy Impact</p>
          <p className="text-lg font-semibold text-blue-400">+12%</p>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">🌡️ Temperature</span>
          <span className="text-blue-400">Strong correlation</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">💨 Humidity</span>
          <span className="text-yellow-400">Moderate correlation</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">☀️ Solar Radiation</span>
          <span className="text-green-400">Weak correlation</span>
        </div>
      </div>
      
      <div className="bg-slate-800/30 rounded-lg p-3">
        <h4 className="text-sm font-medium text-slate-300 mb-2">🌤️ Weather Insights</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Cold front arriving - expect 20% higher heating costs</li>
          <li>• Optimal solar generation window: 10 AM - 3 PM</li>
          <li>• High humidity may trigger dehumidifier</li>
        </ul>
      </div>
    </div>
  );
};

export default WeatherCorrelationCard; 