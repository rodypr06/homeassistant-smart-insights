import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import QueryInterface from './components/Dashboard/QueryInterface';
import VisualizationWidget from './components/Dashboard/VisualizationWidget';
import InsightsWidget from './components/Dashboard/InsightsWidget';
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard';
import PerformanceDashboard from './components/Performance/PerformanceDashboard';
import PerformanceMonitor from './components/Performance/PerformanceMonitor';
import { validateEnvironmentVariables, logEnvironmentStatus, getRequiredEnvHelp } from './utils/env-validation';

const queryClient = new QueryClient();

function App() {
  const [queryResults, setQueryResults] = useState<any>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [envError, setEnvError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'performance'>('dashboard');

  // Validate environment variables on startup
  useEffect(() => {
    const validation = validateEnvironmentVariables();
    logEnvironmentStatus();
    
    if (!validation.isValid) {
      const errorMessage = `Configuration Error:\n\n${validation.errors.join('\n')}\n\n${getRequiredEnvHelp()}`;
      setEnvError(errorMessage);
      console.error('❌ Environment validation failed:', validation.errors);
    }
  }, []);

  const handleQueryResults = (results: any, query: string) => {
    console.log('App received query results:', results);
    console.log('Query:', query);
    setQueryResults(results);
    setCurrentQuery(query);
  };

  // Show environment error if configuration is invalid
  if (envError) {
    return (
      <div className="min-h-screen dark bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="card">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold text-red-400 mb-2">Configuration Required</h1>
              <p className="text-slate-300">Please configure your environment variables to continue.</p>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                {envError}
              </pre>
            </div>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => window.location.reload()} 
                className="btn-primary"
              >
                Retry Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen dark">
        <header className="header-gradient">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <span className="text-2xl">🏠</span>
                </div>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                  HomeAssistant Smart Insights
                </h1>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-white/10 rounded-lg p-1 backdrop-blur-sm">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                📊 Query Dashboard
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                🔬 Analytics Dashboard
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'performance'
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                ⚡ Performance
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {activeTab === 'dashboard' ? (
            <>
              <div className="mb-8">
                <QueryInterface onQueryResults={handleQueryResults} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <VisualizationWidget
                  data={(() => {
                    const data = queryResults?.results || [];
                    console.log('Passing data to VisualizationWidget:', data);
                    return data;
                  })()}
                  chartType={queryResults?.processedQuery?.chartType || "line"}
                  title={queryResults ? `${currentQuery}` : "Data Visualization"}
                />
                <InsightsWidget
                  data={(() => {
                    const data = queryResults?.results || [];
                    console.log('Passing data to InsightsWidget:', data);
                    return data;
                  })()}
                  query={currentQuery}
                />
              </div>
            </>
          ) : activeTab === 'analytics' ? (
            <AnalyticsDashboard />
          ) : (
            <PerformanceDashboard />
          )}
        </main>

        {/* Performance Monitor - Always visible */}
        <PerformanceMonitor 
          enabled={true}
          showDetails={activeTab === 'performance'}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;
