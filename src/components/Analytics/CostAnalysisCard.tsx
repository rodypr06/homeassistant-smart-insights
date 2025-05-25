import React from 'react';

interface CostAnalysisCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

const CostAnalysisCard: React.FC<CostAnalysisCardProps> = ({ data, timeRange, isLoading }) => {
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
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
          <span className="text-xl">💰</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Cost Analysis</h3>
          <p className="text-sm text-slate-400">Energy costs & savings</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">This Month</p>
          <p className="text-lg font-semibold text-green-400">$127.45</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Potential Savings</p>
          <p className="text-lg font-semibold text-blue-400">$23.80</p>
        </div>
      </div>
      
      <div className="bg-slate-800/30 rounded-lg p-3">
        <h4 className="text-sm font-medium text-slate-300 mb-2">💡 Cost Insights</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Peak rate hours: 4-9 PM weekdays</li>
          <li>• Consider time-of-use optimization</li>
          <li>• HVAC accounts for 45% of costs</li>
        </ul>
      </div>
    </div>
  );
};

export default CostAnalysisCard; 