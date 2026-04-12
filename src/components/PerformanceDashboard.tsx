/**
 * @fileoverview Performance Dashboard Component
 *
 * Real-time visualization of application performance metrics
 * Shows current session stats, daily trends, and top slow operations
 */

import React, { useState, useEffect } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';
import { usePerformanceReporting, useMemoryTracking } from '../hooks/usePerformanceMonitoring';
import { BarChart3, TrendingUp, Zap, HardDrive, Activity, LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon: LucideIcon;
  trend?: number;
  warning?: boolean;
}

interface MetricStatsType {
  count: number;
  avg: string | number;
  min: string | number;
  max: string | number;
  total: string | number;
  exceeded?: number;
}

interface StatsTableProps {
  stats: MetricStatsType | null | undefined;
  title: string;
}

interface SlowOperation {
  type: string;
  duration: number;
  timestamp: number;
  component?: string;
  label?: string;
}

interface PerformanceReport {
  session?: {
    sessionDuration?: number;
    metricsCount?: number;
    renders?: MetricStatsType;
    storageOps?: MetricStatsType;
    stateUpdates?: MetricStatsType;
    apiCalls?: MetricStatsType;
  };
}

interface PerformanceDashboardProps {
  defaultOpen?: boolean;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Performance metric card component
 */
function MetricCard({ title, value, unit, icon: Icon, trend, warning }: MetricCardProps): React.ReactElement {
  return (
    <div className={`bg-white rounded-lg p-4 shadow ${warning ? 'border-l-4 border-red-500' : 'border-l-4 border-blue-500'}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <Icon className={`w-5 h-5 ${warning ? 'text-red-500' : 'text-blue-500'}`} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        <span className="text-sm text-gray-600">{unit}</span>
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-sm ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

/**
 * Performance stats table component
 */
function StatsTable({ stats, title }: StatsTableProps): React.ReactElement {
  if (!stats || stats.count === 0) {
    return (
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="font-semibold text-gray-700 mb-4">{title}</h3>
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h3 className="font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">Metric</th>
              <th className="text-right py-2 px-2">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2">Count</td>
              <td className="text-right py-2 px-2">{stats.count}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2">Average (ms)</td>
              <td className="text-right py-2 px-2">{stats.avg}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2">Min (ms)</td>
              <td className="text-right py-2 px-2">{stats.min}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2 px-2">Max (ms)</td>
              <td className="text-right py-2 px-2">{stats.max}</td>
            </tr>
            <tr>
              <td className="py-2 px-2">Total (ms)</td>
              <td className="text-right py-2 px-2">{stats.total}</td>
            </tr>
            {stats.exceeded !== undefined && (
              <tr className="bg-red-50">
                <td className="py-2 px-2 font-semibold">Exceeded Threshold</td>
                <td className="text-right py-2 px-2 font-semibold text-red-600">{stats.exceeded}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Slow operations list component
 */
function SlowOperationsList(): React.ReactElement {
  const [slowOps, setSlowOps] = useState<SlowOperation[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlowOps(performanceMonitor.getSlowOperations(5) as SlowOperation[]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (slowOps.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 shadow">
        <h3 className="font-semibold text-gray-700 mb-4">Top Slow Operations</h3>
        <p className="text-gray-500">No slow operations detected</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h3 className="font-semibold text-gray-700 mb-4">Top Slow Operations</h3>
      <div className="space-y-2">
        {slowOps.map((op, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded">
            <div>
              <p className="font-semibold text-sm text-gray-700">{op.type}</p>
              <p className="text-xs text-gray-600">{op.component || op.label || '-'}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-red-600">{op.duration.toFixed(2)}ms</p>
              <p className="text-xs text-gray-600">
                {new Date(op.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main Performance Dashboard Component
 */
export default function PerformanceDashboard({ defaultOpen = false }: PerformanceDashboardProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const memory = useMemoryTracking(5000);

  usePerformanceReporting(30000, (newReport) => {
    setReport(newReport as PerformanceReport);
  });

  // Initial report
  useEffect(() => {
    setReport(performanceMonitor.getPerformanceReport() as PerformanceReport);
  }, []);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 shadow-lg transition"
          title="Open Performance Dashboard"
        >
          <Activity className="w-6 h-6" />
        </button>
      </div>
    );
  }

  const sessionDuration = report?.session?.sessionDuration
    ? (report.session.sessionDuration / 1000).toFixed(1)
    : '0';

  // Convert MemoryStats to display format
  const memoryDisplay: { usedMB: string; limitMB: string; percent: string } | null = memory ? {
    usedMB: memory.usedJSHeapSize ? (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : '0',
    limitMB: memory.jsHeapSizeLimit ? (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) : '0',
    percent: memory.percent ? String(memory.percent) : '0'
  } : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-100 rounded-lg shadow-2xl w-96 max-h-screen overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <h2 className="font-bold">Performance Dashboard</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-blue-500 p-1 rounded transition"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            title="Session Duration"
            value={sessionDuration}
            unit="s"
            icon={Zap}
          />
          <MetricCard
            title="Total Metrics"
            value={report?.session?.metricsCount || 0}
            unit="count"
            icon={BarChart3}
          />
          {memoryDisplay && (
            <MetricCard
              title="Memory Usage"
              value={memoryDisplay.percent}
              unit="%"
              icon={HardDrive}
              warning={parseFloat(memoryDisplay.percent) > 80}
            />
          )}
          <MetricCard
            title="Avg Render"
            value={report?.session?.renders?.avg || 0}
            unit="ms"
            icon={TrendingUp}
          />
        </div>

        {/* Render Performance */}
        {report?.session?.renders && report.session.renders.count > 0 && (
          <StatsTable
            stats={report.session.renders}
            title="Render Performance"
          />
        )}

        {/* Storage Operations */}
        {report?.session?.storageOps && report.session.storageOps.count > 0 && (
          <StatsTable
            stats={report.session.storageOps}
            title="Storage Operations"
          />
        )}

        {/* State Updates */}
        {report?.session?.stateUpdates && report.session.stateUpdates.count > 0 && (
          <StatsTable
            stats={report.session.stateUpdates}
            title="State Updates"
          />
        )}

        {/* API Calls */}
        {report?.session?.apiCalls && report.session.apiCalls.count > 0 && (
          <StatsTable
            stats={report.session.apiCalls}
            title="API Calls"
          />
        )}

        {/* Slow Operations */}
        <SlowOperationsList />

        {/* Memory Info */}
        {memoryDisplay && (
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold text-gray-700 mb-3">Memory Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Used:</span>
                <span className="font-semibold">{memoryDisplay.usedMB} MB</span>
              </div>
              <div className="flex justify-between">
                <span>Limit:</span>
                <span className="font-semibold">{memoryDisplay.limitMB} MB</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition ${
                    parseFloat(memoryDisplay.percent) > 80
                      ? 'bg-red-500'
                      : parseFloat(memoryDisplay.percent) > 60
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${memoryDisplay.percent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => performanceMonitor.reset()}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded text-sm transition"
          >
            Reset Metrics
          </button>
          <button
            onClick={() => {
              const csv = performanceMonitor.exportAsCSV();
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `performance-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
            }}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded text-sm transition"
          >
            Export CSV
          </button>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-600 text-center pt-2 border-t">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
