import { useState, useRef } from 'react';
import { Lightbulb, Loader2, Download, Send, MessageSquare, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import OpenAIService from '../../services/openai';
import type { QueryResult } from '../../types/influxdb';

const openaiService = new OpenAIService(import.meta.env.VITE_OPENAI_API_KEY || '');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface InsightsWidgetProps {
  data: QueryResult[];
  query: string;
}

export default function InsightsWidget({ data, query }: InsightsWidgetProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatMode, setIsChatMode] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const hasData = data && data.length > 0;

  const generateInitialInsights = async () => {
    if (!hasData) {
      setError('No data available for analysis. Please run a query first.');
      return;
    }

    console.log('Starting initial insights generation...');
    setIsLoading(true);
    setError(null);
    setInsights(null);
    setChatMessages([]);

    try {
      // Validate data before processing
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received');
      }

      const validData = data.filter(item => 
        item && 
        typeof item === 'object' && 
        item.timestamp && 
        item.entity_id && 
        (item.value !== null && item.value !== undefined)
      );

      if (validData.length === 0) {
        throw new Error('No valid data points found for analysis');
      }

      console.log(`Processing ${validData.length} valid data points out of ${data.length} total`);
      
      const result = await openaiService.generateInsights(validData, query);
      
      if (!result || result.trim().length === 0) {
        throw new Error('Empty response received from AI service');
      }
      
      console.log('Initial insights generated successfully');
      setInsights(result);
      
      // Add initial message to chat history
      setChatMessages([
        {
          role: 'assistant',
          content: result,
          timestamp: new Date()
        }
      ]);
      
      setIsChatMode(true);
      
    } catch (err) {
      console.error('Error generating insights:', err);
      
      let errorMessage = 'Failed to generate insights';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      if (errorMessage.includes('rate_limit')) {
        errorMessage = 'OpenAI rate limit exceeded. Please wait a moment and try again.';
      } else if (errorMessage.includes('quota')) {
        errorMessage = 'OpenAI quota exceeded. Please check your API usage.';
      } else if (errorMessage.includes('api_key')) {
        errorMessage = 'OpenAI API key issue. Please check your configuration.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Create conversation context
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const updatedInsights = await openaiService.updateInsights(
        data,
        query,
        conversationHistory,
        userMessage.content
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: updatedInsights,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      setInsights(updatedInsights);

    } catch (err) {
      console.error('Error in chat:', err);
      setError(err instanceof Error ? err.message : 'Failed to process chat message');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!insights || !reportRef.current) return;

    try {
      setIsLoading(true);
      
      // Create a temporary container with better styling for PDF
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 800px;
        padding: 40px;
        background: white;
        color: black;
        font-family: Arial, sans-serif;
        line-height: 1.6;
      `;
      
      tempContainer.innerHTML = `
        <div style="margin-bottom: 30px; border-bottom: 2px solid #3B82F6; padding-bottom: 20px;">
          <h1 style="color: #3B82F6; font-size: 24px; margin: 0;">HomeAssistant Smart Insights Report</h1>
          <p style="color: #666; margin: 10px 0 0 0;">Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #333; font-size: 18px; margin-bottom: 10px;">Query</h2>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 0;">${query}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #333; font-size: 18px; margin-bottom: 10px;">Data Summary</h2>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Total Records: ${data.length}</li>
            <li>Time Range: ${new Date(data[0]?.timestamp).toLocaleString()} to ${new Date(data[data.length - 1]?.timestamp).toLocaleString()}</li>
            <li>Entities: ${[...new Set(data.map(d => d.entity_id))].join(', ')}</li>
          </ul>
        </div>
        
        <div>
          <h2 style="color: #333; font-size: 18px; margin-bottom: 15px;">Analysis</h2>
          <div style="white-space: pre-wrap; line-height: 1.8;">${insights.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/## (.*?)$/gm, '<h3 style="color: #3B82F6; font-size: 16px; margin: 20px 0 10px 0;">$1</h3>').replace(/- (.*?)$/gm, '• $1')}</div>
        </div>
      `;
      
      document.body.appendChild(tempContainer);
      
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(tempContainer);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`homeassistant-insights-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setIsChatMode(false);
    setChatMessages([]);
    setInsights(null);
    setError(null);
  };

  return (
    <div className="card flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="text-primary-blue" />
          AI Insights
          {isChatMode && <MessageSquare className="w-4 h-4 text-green-500" />}
        </h3>
        <div className="flex gap-2">
          {insights && (
            <>
              <button
                onClick={downloadPDF}
                disabled={isLoading}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <FileText className="w-4 h-4" />
                Download PDF
              </button>
              <button
                onClick={resetChat}
                className="btn-secondary text-sm"
              >
                New Analysis
              </button>
            </>
          )}
          {!isChatMode && (
            <button
              onClick={generateInitialInsights}
              disabled={isLoading || !hasData}
              className={`btn-primary text-sm ${!hasData ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Generate Insights'
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {!hasData && (
          <div className="flex items-center justify-center flex-1 text-text-secondary">
            <div className="text-center">
              <p className="mb-2">📊 No data available</p>
              <p>Run a query to enable AI insights.</p>
            </div>
          </div>
        )}

        {hasData && !isChatMode && !isLoading && (
          <div className="flex items-center justify-center flex-1 text-text-secondary">
            <div className="text-center">
              <p className="mb-2">📊 Data Status: {data.length} records available</p>
              <p className="mb-2">Query: "{query}"</p>
              <p>Click "Generate Insights" to start AI analysis.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message text-sm mb-4">
            {error}
          </div>
        )}

        {isChatMode && (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-xl ${
                      message.role === 'user'
                        ? 'chat-message-user'
                        : 'chat-message-assistant'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div 
                        ref={index === chatMessages.length - 1 ? reportRef : null}
                        className="prose prose-sm max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/## (.*?)$/gm, '<h3 class="text-primary-blue font-semibold mt-4 mb-2">$1</h3>')
                            .replace(/### (.*?)$/gm, '<h4 class="font-medium mt-3 mb-1">$1</h4>')
                            .replace(/- (.*?)$/gm, '• $1')
                            .replace(/\n/g, '<br>')
                        }}
                      />
                    ) : (
                      <p className="text-sm font-medium">{message.content}</p>
                    )}
                    <p className="text-xs opacity-70 mt-3 font-medium">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="chat-message-assistant p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 loading-spinner"></div>
                      <span className="text-sm font-medium">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask for changes to the report..."
                className="flex-1 input-field text-sm"
                disabled={isLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={isLoading || !chatInput.trim()}
                className="btn-primary px-4 py-3 flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {isLoading && !isChatMode && (
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <div className="w-6 h-6 loading-spinner"></div>
              <span className="font-medium">Generating insights...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 