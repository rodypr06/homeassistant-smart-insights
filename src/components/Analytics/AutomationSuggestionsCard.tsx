import React, { useState, useEffect } from 'react';
import { homeAssistantAutomationService, type AutomationSuggestion } from '../../services/homeAssistantAutomationService';
import AutomationCreationModal from './AutomationCreationModal';

interface AutomationSuggestionsCardProps {
  data: any[];
  timeRange: string;
  isLoading: boolean;
}

const AutomationSuggestionsCard: React.FC<AutomationSuggestionsCardProps> = ({ data, timeRange, isLoading }) => {
  const [suggestions, setSuggestions] = useState<AutomationSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutomationSuggestion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; version?: string; error?: string } | null>(null);
  const [createdAutomations, setCreatedAutomations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load automation suggestions when component mounts
  useEffect(() => {
    loadSuggestions();
    testConnection();
  }, []);

  const testConnection = async () => {
    const status = await homeAssistantAutomationService.testConnection();
    setConnectionStatus(status);
  };

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Loading automation suggestions...');
      
      // Test HomeAssistant connection first
      const connectionTest = await homeAssistantAutomationService.testConnection();
      console.log('🔗 HomeAssistant connection test:', connectionTest);
      
      if (!connectionTest.connected) {
        console.warn('⚠️ HomeAssistant not available, showing offline message');
        setError(`HomeAssistant API not available: ${connectionTest.error || 'Connection failed'}`);
        setSuggestions([]);
        return;
      }
      
      const suggestions = await homeAssistantAutomationService.generateAutomationSuggestions();
      console.log(`✅ Generated ${suggestions.length} automation suggestions`);
      setSuggestions(suggestions);
      
    } catch (error) {
      console.error('❌ Failed to load automation suggestions:', error);
      
      // Check if it's a CORS error
      if (error instanceof Error && error.message.includes('CORS')) {
        setError('HomeAssistant CORS configuration needed. Please add your app URL to HomeAssistant\'s allowed origins.');
      } else if (error instanceof Error && error.message.includes('fetch')) {
        setError('Cannot connect to HomeAssistant. Check if it\'s running and accessible.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load automation suggestions');
      }
      
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAutomation = (suggestion: AutomationSuggestion) => {
    setSelectedSuggestion(suggestion);
    setIsModalOpen(true);
  };

  const handleAutomationCreated = (automationId: string) => {
    setCreatedAutomations(prev => [...prev, automationId]);
    // Refresh suggestions to update counts
    loadSuggestions();
  };

  if (isLoading || loadingSuggestions) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-3/4 mb-4"></div>
        <div className="h-32 bg-slate-700 rounded mb-4"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
            <span className="text-xl">🤖</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-200">Automation Suggestions</h3>
            <p className="text-sm text-slate-400">AI-powered recommendations</p>
          </div>
          
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus?.connected ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className="text-xs text-slate-400">
              {connectionStatus?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Available Suggestions</p>
            <p className="text-lg font-semibold text-slate-200">{suggestions.length}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Potential Savings</p>
            <p className="text-lg font-semibold text-green-400">
              ${suggestions.reduce((sum, s) => sum + (s.estimatedSavings || 0), 0)}/mo
            </p>
          </div>
        </div>
        
        {/* Connection Error */}
        {(connectionStatus && !connectionStatus.connected) || error && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-yellow-400">⚠️</span>
              <span className="text-sm font-medium text-yellow-400">HomeAssistant Integration Offline</span>
            </div>
            <p className="text-xs text-yellow-300 mb-2">
              {error || 'CORS policy is blocking HomeAssistant API access. This is normal for security.'}
            </p>
            <details className="text-xs text-yellow-300">
              <summary className="cursor-pointer hover:text-yellow-200">How to enable (optional)</summary>
              <div className="mt-2 pl-2 border-l-2 border-yellow-500/30">
                <p>Add to your HomeAssistant configuration.yaml:</p>
                <pre className="mt-1 text-xs bg-slate-800/50 p-2 rounded">
{`http:
  cors_allowed_origins:
    - "http://localhost:5177"
    - "http://192.168.50.141:5177"`}
                </pre>
                <p className="mt-1">Then restart HomeAssistant.</p>
              </div>
            </details>
          </div>
        )}
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-300">💡 New Suggestions</h4>
            <div className="flex items-center gap-2">
              {suggestions.length > 0 && (
                <span className="text-xs text-slate-500">
                  Showing {Math.min(suggestions.length, 4)} of {suggestions.length}
                </span>
              )}
              <button
                onClick={loadSuggestions}
                className="text-xs text-blue-400 hover:text-blue-300"
                disabled={loadingSuggestions}
              >
                {loadingSuggestions ? '⟳' : '🔄'} Refresh
              </button>
            </div>
          </div>
          
          {suggestions.length === 0 ? (
            <div className="text-center py-6">
              <span className="text-4xl mb-2 block">🤖</span>
              <p className="text-slate-400 text-sm">No automation suggestions available</p>
              <p className="text-slate-500 text-xs mt-1">
                Connect to HomeAssistant to get personalized suggestions
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="bg-slate-800/30 rounded-lg p-3 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-slate-200">{suggestion.title}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          suggestion.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          suggestion.priority === 'critical' ? 'bg-red-600/30 text-red-300' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {suggestion.priority}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          suggestion.category === 'energy' ? 'bg-green-500/20 text-green-400' :
                          suggestion.category === 'security' ? 'bg-red-500/20 text-red-400' :
                          suggestion.category === 'comfort' ? 'bg-blue-500/20 text-blue-400' :
                          suggestion.category === 'maintenance' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>
                          {suggestion.category}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{suggestion.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-green-400">{suggestion.impact}</span>
                      {suggestion.requiredEntities.length > 0 && (
                        <span className="text-xs text-slate-500">
                          {suggestion.requiredEntities.length} entities
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleCreateAutomation(suggestion)}
                      disabled={!connectionStatus?.connected}
                      className={`text-xs px-3 py-1 rounded transition-colors ${
                        connectionStatus?.connected
                          ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                          : 'text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Create →
                    </button>
                  </div>
                  
                  {/* Tags */}
                  {suggestion.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {suggestion.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="text-xs px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                          {tag}
                        </span>
                      ))}
                      {suggestion.tags.length > 3 && (
                        <span className="text-xs text-slate-500">+{suggestion.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Automation Creation Modal */}
      <AutomationCreationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSuggestion(null);
        }}
        suggestion={selectedSuggestion}
        onSuccess={handleAutomationCreated}
      />
    </>
  );
};

export default AutomationSuggestionsCard; 