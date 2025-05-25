import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { QueryRequest } from '../../types/dashboard';
import OpenAIService from '../../services/openai';
import { useHomeAssistant } from '../../hooks/useHomeAssistant';
import { useInfluxDB } from '../../hooks/useInfluxDB';

// Debug logging
console.log('Environment variables:', {
  VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY ? `${import.meta.env.VITE_OPENAI_API_KEY.substring(0, 10)}...` : 'NOT SET',
  VITE_INFLUXDB_URL: import.meta.env.VITE_INFLUXDB_URL || 'NOT SET',
  VITE_HOMEASSISTANT_URL: import.meta.env.VITE_HOMEASSISTANT_URL || 'NOT SET'
});

const openaiService = new OpenAIService(import.meta.env.VITE_OPENAI_API_KEY || '');

const exampleQueries = [
  'Show me office temperature vs living room for the last 7 days',
  'Generate humidity report for bedroom this month',
  'Compare energy usage between weekdays and weekends',
];

interface QueryInterfaceProps {
  onQueryResults?: (results: any, query: string) => void;
}

export default function QueryInterface({ onQueryResults }: QueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Checking connections...');
  const [processingStep, setProcessingStep] = useState<string>('');
  const [queryResults, setQueryResults] = useState<any>(null);
  const { useEntities } = useHomeAssistant();
  const { queryData } = useInfluxDB();

  const { data: entities, isLoading: isLoadingEntities, error: entitiesError } = useEntities();

  // Test connections on component mount
  useEffect(() => {
    const testConnections = async () => {
      try {
        // Test InfluxDB connection
        const influxResponse = await fetch(import.meta.env.VITE_INFLUXDB_URL + '/health');
        const influxHealth = await influxResponse.json();
        
        let status = `InfluxDB: ✅ ${influxHealth.status} (${influxHealth.version})`;
        
        // Test HomeAssistant connection (optional)
        const haUrl = import.meta.env.VITE_HOMEASSISTANT_URL;
        if (haUrl && haUrl !== 'NOT SET') {
          try {
            const haResponse = await fetch(haUrl + '/api/', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_HOMEASSISTANT_TOKEN || ''}`,
              },
            });
            if (haResponse.ok) {
              status += ' | HomeAssistant: ✅ Connected';
            } else if (haResponse.status === 401) {
              status += ' | HomeAssistant: ⚠️ Auth Error (Check Token)';
            } else {
              status += ' | HomeAssistant: ⚠️ Error (' + haResponse.status + ')';
            }
          } catch (error) {
            // Check if it's a CORS error
            if (error instanceof TypeError && error.message.includes('fetch')) {
              status += ' | HomeAssistant: ⚠️ CORS Blocked (Server Reachable)';
            } else {
              status += ' | HomeAssistant: ❌ Unreachable';
            }
            console.log('HomeAssistant connection error:', error);
          }
        } else {
          status += ' | HomeAssistant: ⚪ Not Configured (Optional)';
        }
        
        setConnectionStatus(status);
      } catch (err) {
        setConnectionStatus('InfluxDB: ❌ Connection failed');
        console.error('Connection test failed:', err);
      }
    };

    testConnections();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsProcessing(true);
    setError(null);
    setQueryResults(null);
    setProcessingStep('Initializing...');

    try {
      setProcessingStep('Preparing query context...');
      const request: QueryRequest = {
        userInput: query,
        timestamp: new Date(),
        context: entities ? JSON.stringify(entities) : undefined,
      };

      setProcessingStep('Processing with OpenAI...');
      console.log('Sending request to OpenAI:', request);
      
      const processedQuery = await openaiService.processQuery(request);
      console.log('OpenAI response:', processedQuery);
      
      setProcessingStep('Executing Flux query...');
      
      // Execute the Flux query
      if (processedQuery.fluxQuery) {
        console.log('Executing Flux query:', processedQuery.fluxQuery);
        const results = await queryData(processedQuery.fluxQuery);
        console.log('Query results:', results);
        
        setQueryResults({
          originalQuery: query,
          fluxQuery: processedQuery.fluxQuery,
          results: results,
          processedQuery: processedQuery
        });
        
        setProcessingStep('Query completed successfully!');
        
        // Pass results to parent component
        if (onQueryResults) {
          onQueryResults({
            originalQuery: query,
            fluxQuery: processedQuery.fluxQuery,
            results: results,
            processedQuery: processedQuery
          }, query);
        }
      } else {
        throw new Error('No Flux query generated by OpenAI');
      }
    } catch (err) {
      console.error('Query execution error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setProcessingStep('');
    } finally {
      setIsProcessing(false);
      // Clear processing step after a delay
      setTimeout(() => setProcessingStep(''), 3000);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <div className="text-sm text-text-secondary mb-1">
          Status: {connectionStatus}
        </div>
        {connectionStatus.includes('Not Configured') && (
          <div className="text-xs text-text-secondary opacity-75">
            💡 HomeAssistant connection is optional - all sensor data is queried from InfluxDB
          </div>
        )}
        {connectionStatus.includes('CORS Blocked') && (
          <div className="text-xs text-text-secondary opacity-75">
            💡 HomeAssistant server is reachable but blocks browser requests (CORS). This is normal and doesn't affect functionality.
          </div>
        )}
        {connectionStatus.includes('Auth Error') && (
          <div className="text-xs text-text-secondary opacity-75">
            💡 Check your VITE_HOMEASSISTANT_TOKEN in .env file. Generate a Long-Lived Access Token in HomeAssistant.
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              console.log('Input changed:', e.target.value);
              setQuery(e.target.value);
            }}
            placeholder="Ask me anything about your HomeAssistant data..."
            className="input-field pl-12"
            disabled={isProcessing}
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-text-secondary" />
        </div>

        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        {processingStep && (
          <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400 text-sm mt-4">
            <div className="w-4 h-4 loading-spinner"></div>
            <span className="font-medium">{processingStep}</span>
          </div>
        )}

        {queryResults && (
          <div className="query-results-card mt-6">
            <h3 className="font-semibold mb-3 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Query Results</h3>
            <div className="space-y-3 text-sm">
              <div>
                <strong className="text-slate-700 dark:text-slate-300">Original Query:</strong> 
                <span className="ml-2 text-slate-600 dark:text-slate-400">{queryResults.originalQuery}</span>
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-300">Generated Flux Query:</strong>
                <pre className="mt-2 p-3 bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-700/80 dark:to-slate-800/80 rounded-lg text-xs overflow-x-auto border border-slate-200/50 dark:border-slate-600/50 backdrop-blur-sm">
                  {queryResults.fluxQuery}
                </pre>
              </div>
              <div>
                <strong className="text-slate-700 dark:text-slate-300">Results:</strong> 
                <span className="ml-2 px-2 py-1 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium">
                  {queryResults.results?.length || 0} records found
                </span>
                {queryResults.results?.length > 0 && (
                  <pre className="mt-2 p-3 bg-gradient-to-r from-slate-100/80 to-slate-200/80 dark:from-slate-700/80 dark:to-slate-800/80 rounded-lg text-xs overflow-x-auto max-h-40 border border-slate-200/50 dark:border-slate-600/50 backdrop-blur-sm">
                    {JSON.stringify(queryResults.results.slice(0, 5), null, 2)}
                    {queryResults.results.length > 5 && '\n... and more'}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-text-secondary">
          <p className="mb-2">Try asking:</p>
          <ul className="space-y-1">
            {exampleQueries.map((example, index) => (
              <li
                key={index}
                className="cursor-pointer hover:text-primary-blue"
                onClick={() => setQuery(example)}
              >
                {example}
              </li>
            ))}
          </ul>
        </div>
      </form>
    </div>
  );
} 