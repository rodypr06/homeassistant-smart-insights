import React from 'react';

interface AutomationSuggestionsCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

const AutomationSuggestionsCard: React.FC<AutomationSuggestionsCardProps> = ({ data, timeRange, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="h-32 bg-slate-700 rounded mb-4"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
      </div>
    );
  }

  const suggestions = [
    {
      id: 1,
      title: "Smart Lighting Schedule",
      description: "Automate lights based on occupancy patterns",
      impact: "15% energy savings",
      priority: "high"
    },
    {
      id: 2,
      title: "Climate Optimization",
      description: "Adjust thermostat when nobody's home",
      impact: "$25/month savings",
      priority: "medium"
    },
    {
      id: 3,
      title: "Water Leak Detection",
      description: "Alert when unusual water usage detected",
      impact: "Prevent damage",
      priority: "high"
    }
  ];

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
          <span className="text-xl">🤖</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-200">Automation Suggestions</h3>
          <p className="text-sm text-slate-400">AI-powered recommendations</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Active Automations</p>
          <p className="text-lg font-semibold text-slate-200">12</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Potential Savings</p>
          <p className="text-lg font-semibold text-green-400">$45/mo</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-300">💡 New Suggestions</h4>
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="bg-slate-800/30 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
              <h5 className="text-sm font-medium text-slate-200">{suggestion.title}</h5>
              <span className={`text-xs px-2 py-1 rounded-full ${
                suggestion.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {suggestion.priority}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">{suggestion.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400">{suggestion.impact}</span>
              <button className="text-xs text-blue-400 hover:text-blue-300">
                Create →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AutomationSuggestionsCard; 