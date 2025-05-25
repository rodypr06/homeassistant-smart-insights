import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import EnergyConsumptionCard from './EnergyConsumptionCard';
import CostAnalysisCard from './CostAnalysisCard';
import PredictiveMaintenanceCard from './PredictiveMaintenanceCard';
import AnomalyDetectionCard from './AnomalyDetectionCard';
import AutomationSuggestionsCard from './AutomationSuggestionsCard';
import WeatherCorrelationCard from './WeatherCorrelationCard';
import { validateEnvironmentVariables } from '../../utils/env-validation';

interface AnalyticsData {
  energyData: any[];
  costData: any[];
  maintenanceData: any[];
  anomalies: any[];
  automationSuggestions: any[];
  weatherData: any[];
}

export function AnalyticsDashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [refreshInterval, setRefreshInterval] = useState(300000); // 5 minutes
  const [isConfigured, setIsConfigured] = useState(false);

  // Check if environment is properly configured
  useEffect(() => {
    const validation = validateEnvironmentVariables();
    setIsConfigured(validation.isValid);
  }, []);

  // Fetch analytics data
  const { data: analyticsData, isLoading, error, refetch } = useQuery({
    queryKey: ['analyticsData', selectedTimeRange],
    queryFn: async (): Promise<AnalyticsData> => {
      // This would typically fetch from your analytics API
      // For now, we'll return mock data structure
      return {
        energyData: [],
        costData: [],
        maintenanceData: [],
        anomalies: [],
        automationSuggestions: [],
        weatherData: []
      };
    },
    enabled: isConfigured,
    refetchInterval: refreshInterval,
    staleTime: 60000, // 1 minute
  });

  // Auto-refresh toggle
  const toggleAutoRefresh = () => {
    setRefreshInterval(prev => prev === 0 ? 300000 : 0);
  };

  if (!isConfigured) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚙️</span>
          </div>
          <h3 className="text-xl font-semibold text-slate-200 mb-2">Configuration Required</h3>
          <p className="text-slate-400">
            Please configure your environment variables to access the analytics dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h3 className="text-xl font-semibold text-red-400 mb-2">Error Loading Analytics</h3>
          <p className="text-slate-400 mb-4">
            {error instanceof Error ? error.message : 'Failed to load analytics data'}
          </p>
          <button onClick={() => refetch()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Analytics Dashboard
          </h2>
          <p className="text-slate-400 mt-1">
            Comprehensive insights into your home automation system
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="input-field text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 3 Months</option>
          </select>

          {/* Auto-refresh Toggle */}
          <button
            onClick={toggleAutoRefresh}
            className={`btn-secondary text-sm ${refreshInterval > 0 ? 'bg-green-600 hover:bg-green-700' : ''}`}
            title={refreshInterval > 0 ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            {refreshInterval > 0 ? '🔄' : '⏸️'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="btn-primary text-sm"
            title="Refresh data"
          >
            {isLoading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-4"></div>
              <div className="h-32 bg-slate-700 rounded mb-4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics Cards Grid */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <EnergyConsumptionCard 
            data={analyticsData.energyData}
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
          
          <CostAnalysisCard 
            data={analyticsData.costData}
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
          
          <PredictiveMaintenanceCard 
            data={analyticsData.maintenanceData}
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
          
          <AnomalyDetectionCard 
            data={analyticsData.anomalies}
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
          
          <AutomationSuggestionsCard 
            data={analyticsData.automationSuggestions}
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
          
          <WeatherCorrelationCard 
            data={analyticsData.weatherData}
            timeRange={selectedTimeRange}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Dashboard Footer */}
      <div className="text-center text-sm text-slate-500 pt-4 border-t border-slate-700">
        <p>
          Last updated: {new Date().toLocaleString()} • 
          Auto-refresh: {refreshInterval > 0 ? `Every ${refreshInterval / 1000 / 60} minutes` : 'Disabled'}
        </p>
      </div>
    </div>
  );
}

export default AnalyticsDashboard; 