import React from 'react';

interface PredictiveMaintenanceCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

const PredictiveMaintenanceCard: React.FC<PredictiveMaintenanceCardProps> = ({ data, timeRange, isLoading }) => {
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
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
          <span className="text-xl">🔧</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Predictive Maintenance</h3>
          <p className="text-sm text-slate-400">Device health monitoring</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Devices Monitored</p>
          <p className="text-lg font-semibold text-slate-200">24</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Health Score</p>
          <p className="text-lg font-semibold text-green-400">87%</p>
        </div>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">HVAC Filter</span>
          <span className="text-yellow-400">Replace Soon</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">Water Heater</span>
          <span className="text-green-400">Good</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300">Smart Thermostat</span>
          <span className="text-green-400">Excellent</span>
        </div>
      </div>
      
      <div className="bg-slate-800/30 rounded-lg p-3">
        <h4 className="text-sm font-medium text-slate-300 mb-2">🔧 Maintenance Tips</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• HVAC filter due for replacement in 2 weeks</li>
          <li>• Schedule annual water heater inspection</li>
          <li>• Battery levels normal across all sensors</li>
        </ul>
      </div>
    </div>
  );
};

export default PredictiveMaintenanceCard; 