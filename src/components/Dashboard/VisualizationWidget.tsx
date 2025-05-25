import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import type { QueryResult } from '../../types/influxdb';
import type { ChartType } from '../../types/dashboard';

interface VisualizationWidgetProps {
  data: QueryResult[];
  chartType: ChartType;
  title: string;
}

export default function VisualizationWidget({
  data,
  chartType,
  title,
}: VisualizationWidgetProps) {
  
  // Function to convert entity_id to friendly name
  const getFriendlyName = (entityId: string): string => {
    if (!entityId) return 'Unknown';
    
    // Remove common prefixes and suffixes
    let friendlyName = entityId
      .replace(/^sensor\./, '')
      .replace(/_sensor$/, '')
      .replace(/_device$/, '')
      .replace(/_temperature$/, ' Temp')
      .replace(/_humidity$/, ' Humidity')
      .replace(/_battery$/, ' Battery')
      .replace(/_motion$/, ' Motion')
      .replace(/bedroom_temperature_humidity_sensor/, 'Bedroom')
      .replace(/living_room_motion/, 'Living Room')
      .replace(/office_window_magnet_sensor/, 'Office')
      .replace(/trina_bedroom_sensor/, 'Trina Bedroom')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return friendlyName;
  };

  const downloadCSV = () => {
    if (!data || data.length === 0) return;

    const csvHeaders = ['Timestamp', 'Entity', 'Value', 'Unit'];
    const csvRows = data.map(item => [
      new Date(item.timestamp).toLocaleString(),
      getFriendlyName(item.entity_id),
      item.value,
      item.unit || ''
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homeassistant-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processedData = useMemo(() => {
    console.log('VisualizationWidget received data:', data);
    
    if (!data || data.length === 0) {
      return [];
    }

    // Handle the actual InfluxDB data format
    const groupedData = data.reduce((acc, item) => {
      const timestamp = new Date(item.timestamp).toLocaleString();
      if (!acc[timestamp]) {
        acc[timestamp] = { timestamp };
      }
      
      // Use friendly name as the key and value as the data point
      const friendlyName = getFriendlyName(item.entity_id);
      acc[timestamp][friendlyName] = item.value;
      
      return acc;
    }, {} as Record<string, Record<string, any>>);

    const result = Object.values(groupedData);
    console.log('Processed data for chart:', result);
    
    return result;
  }, [data]);

  const colors = [
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#10B981', // emerald-500
    '#F59E0B', // amber-500
    '#EF4444', // red-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#6366F1', // indigo-500
    '#84CC16', // lime-500
  ];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {data && data.length > 0 && (
          <button
            onClick={downloadCSV}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        )}
      </div>
      {processedData.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] text-text-secondary">
          <p>No data to display. Run a query to see visualizations.</p>
        </div>
      ) : (
        <div className="chart-container h-[350px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={processedData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 60, // Increased bottom margin for legend
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                angle={-45}
                textAnchor="end"
                height={60}
                stroke="#94a3b8"
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#64748b' }}
                stroke="#94a3b8"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  color: '#f9fafb',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  backdropFilter: 'blur(8px)',
                }}
                labelStyle={{
                  color: '#d1d5db',
                  fontSize: '12px',
                  fontWeight: '400',
                }}
                formatter={(value: any, name: string) => [
                  `${Number(value).toFixed(1)}${name.includes('Temp') ? '°F' : name.includes('Humidity') ? '%' : ''}`,
                  name
                ]}
                labelFormatter={(label: string) => `Time: ${new Date(label).toLocaleString()}`}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: '20px',
                  fontSize: '12px',
                  color: '#64748b'
                }}
                iconType="line"
              />
              {Object.keys(processedData[0] || {})
                .filter((key) => key !== 'timestamp')
                .map((friendlyName, index) => (
                  <Line
                    key={friendlyName}
                    type="monotone"
                    dataKey={friendlyName}
                    stroke={colors[index % colors.length]}
                    activeDot={{ 
                      r: 6, 
                      fill: colors[index % colors.length],
                      stroke: '#fff',
                      strokeWidth: 2,
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                    name={friendlyName}
                    strokeWidth={3}
                    dot={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
} 