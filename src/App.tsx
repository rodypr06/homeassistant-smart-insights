import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import QueryInterface from './components/Dashboard/QueryInterface';
import VisualizationWidget from './components/Dashboard/VisualizationWidget';
import InsightsWidget from './components/Dashboard/InsightsWidget';

const queryClient = new QueryClient();

function App() {
  const [queryResults, setQueryResults] = useState<any>(null);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  const handleQueryResults = (results: any, query: string) => {
    console.log('App received query results:', results);
    console.log('Query:', query);
    setQueryResults(results);
    setCurrentQuery(query);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen dark">
        <header className="header-gradient">
          <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/20">
                <span className="text-2xl">🏠</span>
              </div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                HomeAssistant Smart Insights
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
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
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
