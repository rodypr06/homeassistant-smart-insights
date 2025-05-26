import React, { useState, useEffect } from 'react';
import { homeAssistantAutomationService, type AutomationSuggestion, type AutomationValidationResult } from '../../services/homeAssistantAutomationService';

interface AutomationCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: AutomationSuggestion | null;
  onSuccess: (automationId: string) => void;
}

const AutomationCreationModal: React.FC<AutomationCreationModalProps> = ({
  isOpen,
  onClose,
  suggestion,
  onSuccess
}) => {
  const [step, setStep] = useState<'preview' | 'customize' | 'validate' | 'create'>('preview');
  const [isCreating, setIsCreating] = useState(false);
  const [validation, setValidation] = useState<AutomationValidationResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; version?: string; error?: string } | null>(null);
  const [customAutomation, setCustomAutomation] = useState(suggestion?.automation);
  const [showYaml, setShowYaml] = useState(false);

  // Test HomeAssistant connection when modal opens
  useEffect(() => {
    if (isOpen && suggestion) {
      testConnection();
      setCustomAutomation(suggestion.automation);
      setStep('preview');
      setValidation(null);
    }
  }, [isOpen, suggestion]);

  const testConnection = async () => {
    const status = await homeAssistantAutomationService.testConnection();
    setConnectionStatus(status);
  };

  const validateAutomation = async () => {
    if (!customAutomation) return;
    
    setStep('validate');
    const result = await homeAssistantAutomationService.validateAutomation(customAutomation);
    setValidation(result);
  };

  const createAutomation = async () => {
    if (!customAutomation || !validation?.isValid) return;
    
    setIsCreating(true);
    setStep('create');
    
    try {
      const result = await homeAssistantAutomationService.createAutomation(customAutomation);
      
      if (result.success && result.id) {
        onSuccess(result.id);
        onClose();
      } else {
        console.error('Failed to create automation:', result.error);
      }
    } catch (error) {
      console.error('Error creating automation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const updateAutomationField = (field: string, value: any) => {
    if (!customAutomation) return;
    
    setCustomAutomation({
      ...customAutomation,
      [field]: value
    });
  };

  if (!isOpen || !suggestion) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-200">Create Automation</h2>
              <p className="text-slate-400 mt-1">{suggestion.title}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl"
            >
              ✕
            </button>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-4 mt-4">
            {['preview', 'customize', 'validate', 'create'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === stepName ? 'bg-blue-500 text-white' :
                  ['preview', 'customize', 'validate'].indexOf(step) > index ? 'bg-green-500 text-white' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    ['preview', 'customize', 'validate'].indexOf(step) > index ? 'bg-green-500' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Connection Status */}
          {connectionStatus && (
            <div className={`mb-6 p-4 rounded-lg border ${
              connectionStatus.connected 
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                <span>{connectionStatus.connected ? '✅' : '❌'}</span>
                <span className="font-medium">
                  {connectionStatus.connected 
                    ? `Connected to HomeAssistant ${connectionStatus.version || ''}`
                    : 'HomeAssistant Connection Failed'
                  }
                </span>
              </div>
              {connectionStatus.error && (
                <p className="text-sm mt-2 opacity-80">{connectionStatus.error}</p>
              )}
            </div>
          )}

          {/* Step 1: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Automation Preview</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <h4 className="font-medium text-slate-300 mb-2">Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Category:</span>
                          <span className="text-slate-200 capitalize">{suggestion.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Priority:</span>
                          <span className={`capitalize ${
                            suggestion.priority === 'high' ? 'text-red-400' :
                            suggestion.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
                          }`}>{suggestion.priority}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Impact:</span>
                          <span className="text-slate-200">{suggestion.impact}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <h4 className="font-medium text-slate-300 mb-2">Required Entities</h4>
                      <div className="space-y-1">
                        {suggestion.requiredEntities.map((entity, index) => (
                          <div key={index} className="text-sm text-slate-400 font-mono">
                            {entity}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-300 mb-2">Description</h4>
                    <p className="text-sm text-slate-400 mb-4">{suggestion.description}</p>
                    
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-slate-300">Tags</h5>
                      <div className="flex flex-wrap gap-2">
                        {suggestion.tags.map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Customize */}
          {step === 'customize' && customAutomation && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Customize Automation</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Automation Name
                    </label>
                    <input
                      type="text"
                      value={customAutomation.alias}
                      onChange={(e) => updateAutomationField('alias', e.target.value)}
                      className="input-field w-full"
                      placeholder="Enter automation name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={customAutomation.description || ''}
                      onChange={(e) => updateAutomationField('description', e.target.value)}
                      className="input-field w-full h-24 resize-none"
                      placeholder="Enter automation description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Mode
                    </label>
                    <select
                      value={customAutomation.mode || 'single'}
                      onChange={(e) => updateAutomationField('mode', e.target.value)}
                      className="input-field w-full"
                    >
                      <option value="single">Single</option>
                      <option value="restart">Restart</option>
                      <option value="queued">Queued</option>
                      <option value="parallel">Parallel</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-300">YAML Preview</h4>
                    <button
                      onClick={() => setShowYaml(!showYaml)}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      {showYaml ? 'Hide' : 'Show'} YAML
                    </button>
                  </div>
                  
                  {showYaml && (
                    <pre className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded overflow-x-auto">
                      {homeAssistantAutomationService.automationToYaml(customAutomation)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Validate */}
          {step === 'validate' && validation && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Validation Results</h3>
              
              <div className={`p-4 rounded-lg border ${
                validation.isValid 
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span>{validation.isValid ? '✅' : '❌'}</span>
                  <span className={`font-medium ${
                    validation.isValid ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {validation.isValid ? 'Validation Passed' : 'Validation Failed'}
                  </span>
                </div>
                
                {validation.errors.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-red-400 mb-2">Errors:</h5>
                    <ul className="space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index} className="text-sm text-red-300">• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {validation.warnings.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-yellow-400 mb-2">Warnings:</h5>
                    <ul className="space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index} className="text-sm text-yellow-300">• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {validation.missingEntities.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-orange-400 mb-2">Missing Entities:</h5>
                    <ul className="space-y-1">
                      {validation.missingEntities.map((entity, index) => (
                        <li key={index} className="text-sm text-orange-300 font-mono">• {entity}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Create */}
          {step === 'create' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Creating Automation</h3>
              
              <div className="text-center py-8">
                {isCreating ? (
                  <div>
                    <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-400">Creating automation in HomeAssistant...</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-white text-2xl">✓</span>
                    </div>
                    <p className="text-green-400 font-medium">Automation created successfully!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {step !== 'preview' && step !== 'create' && (
              <button
                onClick={() => {
                  if (step === 'customize') setStep('preview');
                  if (step === 'validate') setStep('customize');
                }}
                className="btn-secondary"
              >
                ← Back
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={isCreating}
            >
              {step === 'create' && !isCreating ? 'Close' : 'Cancel'}
            </button>
            
            {step === 'preview' && (
              <button
                onClick={() => setStep('customize')}
                className="btn-primary"
                disabled={!connectionStatus?.connected}
              >
                Customize →
              </button>
            )}
            
            {step === 'customize' && (
              <button
                onClick={validateAutomation}
                className="btn-primary"
              >
                Validate →
              </button>
            )}
            
            {step === 'validate' && validation?.isValid && (
              <button
                onClick={createAutomation}
                className="btn-primary"
                disabled={isCreating}
              >
                Create Automation
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationCreationModal; 