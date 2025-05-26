import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface DataRow {
  id: string;
  timestamp: string;
  entity_id: string;
  value: number;
  measurement?: string;
  field?: string;
  [key: string]: any;
}

interface Column {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
  formatter?: (value: any, row: DataRow) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface VirtualDataTableProps {
  data: DataRow[];
  columns: Column[];
  height?: number;
  rowHeight?: number;
  overscan?: number;
  onRowClick?: (row: DataRow) => void;
  onRowSelect?: (selectedRows: DataRow[]) => void;
  searchable?: boolean;
  sortable?: boolean;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

const VirtualDataTable: React.FC<VirtualDataTableProps> = ({
  data,
  columns,
  height = 600,
  rowHeight = 50,
  overscan = 5,
  onRowClick,
  onRowSelect,
  searchable = true,
  sortable = true,
  selectable = false,
  loading = false,
  emptyMessage = 'No data available'
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = data.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === bValue) return 0;

        const comparison = aValue < bValue ? -1 : 1;
        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: processedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  // Handle sorting
  const handleSort = useCallback((columnKey: string) => {
    if (!sortable) return;

    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        return prev.direction === 'asc' 
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, [sortable]);

  // Handle row selection
  const handleRowSelect = useCallback((rowId: string, selected: boolean) => {
    if (!selectable) return;

    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(rowId);
      } else {
        newSet.delete(rowId);
      }
      
      const selectedRowData = processedData.filter(row => newSet.has(row.id));
      onRowSelect?.(selectedRowData);
      
      return newSet;
    });
  }, [selectable, processedData, onRowSelect]);

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    if (!selectable) return;

    if (selected) {
      const allIds = new Set(processedData.map(row => row.id));
      setSelectedRows(allIds);
      onRowSelect?.(processedData);
    } else {
      setSelectedRows(new Set());
      onRowSelect?.([]);
    }
  }, [selectable, processedData, onRowSelect]);

  // Get sort icon
  const getSortIcon = (columnKey: string) => {
    if (!sortConfig || sortConfig.key !== columnKey) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Calculate total width
  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 150), 0);

  if (loading) {
    return (
      <div className="card" style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header Controls */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-slate-200">
              Data Table ({processedData.length.toLocaleString()} rows)
            </h3>
            
            {selectable && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRows.size === processedData.length && processedData.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500"
                />
                <span className="text-sm text-slate-400">
                  {selectedRows.size} selected
                </span>
              </div>
            )}
          </div>

          {searchable && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-64"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Virtual Table */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: height - 80 }} // Account for header
      >
        {processedData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">📊</span>
              <p className="text-slate-400">{emptyMessage}</p>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {/* Table Header */}
            <div
              className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700"
              style={{ width: Math.max(totalWidth, 800) }}
            >
              <div className="flex">
                {selectable && (
                  <div className="w-12 p-3 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === processedData.length && processedData.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-700 text-blue-500"
                    />
                  </div>
                )}
                
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className={`p-3 text-sm font-medium text-slate-300 border-r border-slate-700 ${
                      column.sortable !== false && sortable ? 'cursor-pointer hover:bg-slate-700' : ''
                    }`}
                    style={{ 
                      width: column.width || 150,
                      textAlign: column.align || 'left'
                    }}
                    onClick={() => column.sortable !== false && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable !== false && sortable && (
                        <span className="text-xs opacity-60">
                          {getSortIcon(column.key)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Virtual Rows */}
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = processedData[virtualRow.index];
              const isSelected = selectedRows.has(row.id);

              return (
                <div
                  key={virtualRow.key}
                  className={`absolute top-0 left-0 w-full border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors ${
                    isSelected ? 'bg-blue-500/10' : ''
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    width: Math.max(totalWidth, 800),
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  <div className="flex h-full items-center">
                    {selectable && (
                      <div className="w-12 p-3 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleRowSelect(row.id, e.target.checked);
                          }}
                          className="rounded border-slate-600 bg-slate-700 text-blue-500"
                        />
                      </div>
                    )}
                    
                    {columns.map((column) => (
                      <div
                        key={column.key}
                        className="p-3 text-sm text-slate-300 border-r border-slate-700/50 truncate"
                        style={{ 
                          width: column.width || 150,
                          textAlign: column.align || 'left'
                        }}
                        title={String(row[column.key])}
                      >
                        {column.formatter 
                          ? column.formatter(row[column.key], row)
                          : String(row[column.key] || '-')
                        }
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div>
            Showing {virtualizer.getVirtualItems().length} of {processedData.length} rows
            {data.length !== processedData.length && (
              <span> (filtered from {data.length} total)</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {selectedRows.size > 0 && (
              <span>{selectedRows.size} selected</span>
            )}
            <span>Row height: {rowHeight}px</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualDataTable; 