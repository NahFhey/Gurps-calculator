/**
 * @fileoverview Performance monitoring system for tracking application metrics over time
 * 
 * Tracks:
 * - Component render times
 * - Storage operations (read/write/duration)
 * - State update performance
 * - Memory usage
 * - API call durations
 * - React Profiler metrics
 * 
 * Data persisted to localStorage with date-based aggregation for trend analysis
 * 
 * @module utils/performanceMonitor
 */

import { logger } from './logger';

// Performance metric thresholds (ms)
const THRESHOLDS: Readonly<Record<string, number>> = {
  RENDER: 16,        // 60fps target
  STORAGE_READ: 5,
  STORAGE_WRITE: 10,
  STATE_UPDATE: 16,
  API_CALL: 100
};

// Storage keys
const PERF_KEYS = {
  METRICS: 'perf_metrics',
  SUMMARY: 'perf_summary',
  HISTORY: 'perf_history'
};

/**
 * Performance metric types
 */
export const METRIC_TYPES = {
  RENDER: 'render',
  STORAGE_READ: 'storage_read',
  STORAGE_WRITE: 'storage_write',
  STATE_UPDATE: 'state_update',
  API_CALL: 'api_call',
  MEMORY: 'memory',
  COMPONENT: 'component'
} as const;

export type MetricType = typeof METRIC_TYPES[keyof typeof METRIC_TYPES];

export interface PerformanceMetric {
  [key: string]: unknown;
  type: string;
  duration: number;
  timestamp: number;
  date: string;
  sessionTime: number;
  exceededThreshold: boolean;
  component?: string;
  label?: string;
  status?: string | number;
  error?: unknown;
  usedMB?: string;
  limitMB?: string;
  percentUsed?: string;
  avg?: number | string;
}

export interface MetricMetadata {
  [key: string]: unknown;
  type?: string;
  duration?: number;
  timestamp?: number;
  date?: string;
  sessionTime?: number;
  exceededThreshold?: boolean;
  component?: string;
  label?: string;
  status?: string | number;
  error?: unknown;
  usedMB?: string;
  limitMB?: string;
  percentUsed?: string;
}

export interface MeasureMetadata {
  component?: string;
  label?: string;
  [key: string]: unknown;
}

export interface MetricStats {
  count: number;
  avg: number | string;
  min: number | string;
  max: number | string;
  total: number | string;
  exceeded: number;
}

export interface MemoryReading {
  used: number;
  limit: number;
  percent: string;
}

export interface LatestMemory {
  usedMB: string | undefined;
  limitMB: string | undefined;
  percentUsed: string | undefined;
}

interface SessionMetrics {
  renders: PerformanceMetric[];
  storageOps: PerformanceMetric[];
  stateUpdates: PerformanceMetric[];
  apiCalls: PerformanceMetric[];
  memory: PerformanceMetric[];
  other?: PerformanceMetric[];
}

type SessionMetricCategory = keyof SessionMetrics;

export interface SessionSummary {
  sessionDuration: number;
  metricsCount: number;
  renders: MetricStats;
  storageOps: MetricStats;
  stateUpdates: MetricStats;
  apiCalls: MetricStats;
  memory: LatestMemory | null;
}

export interface DailyMetrics {
  renders: MetricStats;
  storageOps: MetricStats;
  stateUpdates: MetricStats;
  apiCalls: MetricStats;
  memory: PerformanceMetric | null;
}

export type PerformanceDate = string | number | Date;

export type DatedMetrics = DailyMetrics & {
  date: PerformanceDate;
};

export interface MetricImprovement {
  percent: string;
  isImprovement: boolean;
}

export type MetricImprovements = Record<string, MetricImprovement>;

export interface PerformanceMemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit: number;
}

type PerformanceWithMemory = Performance & {
  memory?: PerformanceMemoryInfo;
};

export interface MetricsComparison {
  date1: DatedMetrics;
  date2: DatedMetrics;
  improvement: MetricImprovements;
}

export interface PerformanceReport {
  generatedAt: string;
  session: SessionSummary;
  today: DailyMetrics;
  yesterday: DailyMetrics;
  comparison: MetricsComparison;
  thresholds: Readonly<Record<string, number>>;
}

export interface PerformanceExport {
  exportedAt: string;
  metrics: PerformanceMetric[];
  summary: SessionSummary;
  report: PerformanceReport;
}

/**
 * Core performance monitor class
 */
class PerformanceMonitor {
  metrics: PerformanceMetric[];
  sessionStartTime: number;
  sessionMetrics: SessionMetrics;
  isEnabled: boolean;
  maxMetricsPerSession: number;

  constructor() {
    this.metrics = [];
    this.sessionStartTime = Date.now();
    this.sessionMetrics = {
      renders: [],
      storageOps: [],
      stateUpdates: [],
      apiCalls: [],
      memory: []
    };
    this.isEnabled = true;
    this.maxMetricsPerSession = 1000;

    // Load persisted data
    this.loadPersistedData();
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    type: string,
    duration: number,
    metadata: MetricMetadata = {}
  ): PerformanceMetric | undefined {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      type,
      duration,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0],
      sessionTime: Date.now() - this.sessionStartTime,
      exceededThreshold: duration > (THRESHOLDS[type.toUpperCase()] || Infinity),
      ...metadata
    };

    this.metrics.push(metric);
    this.sessionMetrics[this.getMetricsCategory(type)]!.push(metric);

    // Prevent memory bloat
    if (this.metrics.length > this.maxMetricsPerSession) {
      this.metrics.shift();
    }

    // Log warning if threshold exceeded
    if (metric.exceededThreshold) {
      logger.warn(
        `Performance: ${type} took ${duration.toFixed(2)}ms (threshold: ${THRESHOLDS[type.toUpperCase()]}ms)`,
        { ...metadata }
      );
    }

    return metric;
  }

  /**
   * Measure a synchronous operation
   */
  measure<T>(name: string, fn: () => T, metadata: MeasureMetadata = {}): T {
    if (!this.isEnabled) return fn();

    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;

      this.recordMetric(name, duration, {
        component: metadata.component,
        label: metadata.label,
        status: 'success'
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(name, duration, {
        component: metadata.component,
        label: metadata.label,
        status: 'error',
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata: MeasureMetadata = {}
  ): Promise<T> {
    if (!this.isEnabled) return fn();

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.recordMetric(name, duration, {
        component: metadata.component,
        label: metadata.label,
        status: 'success'
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(name, duration, {
        component: metadata.component,
        label: metadata.label,
        status: 'error',
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Track component render time
   */
  trackRender(
    componentName: string,
    duration: number,
    props: Record<string, unknown> = {}
  ): PerformanceMetric | undefined {
    return this.recordMetric(METRIC_TYPES.RENDER, duration, {
      component: componentName,
      propCount: Object.keys(props).length
    });
  }

  /**
   * Track storage operations
   */
  trackStorageOp(
    operation: string,
    key: string,
    duration: number,
    size: number = 0
  ): PerformanceMetric | undefined {
    const type = operation === 'read' ? METRIC_TYPES.STORAGE_READ : METRIC_TYPES.STORAGE_WRITE;
    return this.recordMetric(type, duration, {
      operation,
      key,
      size,
      sizeKB: (size / 1024).toFixed(2)
    });
  }

  /**
   * Track state update operations
   */
  trackStateUpdate(
    actionType: string,
    duration: number,
    componentCount: number = 0
  ): PerformanceMetric | undefined {
    return this.recordMetric(METRIC_TYPES.STATE_UPDATE, duration, {
      action: actionType,
      componentCount
    });
  }

  /**
   * Track API calls
   */
  trackApiCall(
    endpoint: string,
    duration: number,
    status: number = 200,
    responseSize: number = 0
  ): PerformanceMetric | undefined {
    return this.recordMetric(METRIC_TYPES.API_CALL, duration, {
      endpoint,
      status,
      responseSize,
      responseSizeKB: (responseSize / 1024).toFixed(2)
    });
  }

  /**
   * Track memory usage
   */
  trackMemory(): MemoryReading | null {
    const browserPerformance = performance as PerformanceWithMemory;
    if (browserPerformance.memory) {
      const memory = {
        used: browserPerformance.memory.usedJSHeapSize,
        limit: browserPerformance.memory.jsHeapSizeLimit,
        percent: (
          (browserPerformance.memory.usedJSHeapSize /
            browserPerformance.memory.jsHeapSizeLimit) * 100
        ).toFixed(2)
      };

      this.recordMetric(METRIC_TYPES.MEMORY, memory.used, {
        usedMB: (memory.used / 1024 / 1024).toFixed(2),
        limitMB: (memory.limit / 1024 / 1024).toFixed(2),
        percentUsed: memory.percent
      });

      return memory;
    }

    return null;
  }

  /**
   * Get metrics category for internal tracking
   */
  getMetricsCategory(type: string): SessionMetricCategory {
    const categoryMap: Partial<Record<string, SessionMetricCategory>> = {
      render: 'renders',
      storage_read: 'storageOps',
      storage_write: 'storageOps',
      state_update: 'stateUpdates',
      api_call: 'apiCalls',
      memory: 'memory',
      component: 'renders'
    };
    return categoryMap[type] || 'other';
  }

  /**
   * Get current session summary
   */
  getSessionSummary(): SessionSummary {
    return {
      sessionDuration: Date.now() - this.sessionStartTime,
      metricsCount: this.metrics.length,
      renders: this.getMetricStats(this.sessionMetrics.renders),
      storageOps: this.getMetricStats(this.sessionMetrics.storageOps),
      stateUpdates: this.getMetricStats(this.sessionMetrics.stateUpdates),
      apiCalls: this.getMetricStats(this.sessionMetrics.apiCalls),
      memory: this.getLatestMemory()
    };
  }

  /**
   * Calculate statistics for a metric group
   */
  getMetricStats(metrics: PerformanceMetric[]): MetricStats {
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, total: 0, exceeded: 0 };
    }

    const durations = metrics.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const exceeded = metrics.filter(m => m.exceededThreshold).length;

    return {
      count: metrics.length,
      avg: (sum / metrics.length).toFixed(2),
      min: Math.min(...durations).toFixed(2),
      max: Math.max(...durations).toFixed(2),
      total: sum.toFixed(2),
      exceeded
    };
  }

  /**
   * Get latest memory reading
   */
  getLatestMemory(): LatestMemory | null {
    if (this.sessionMetrics.memory.length === 0) return null;
    const latest = this.sessionMetrics.memory[this.sessionMetrics.memory.length - 1];
    return {
      usedMB: latest.usedMB,
      limitMB: latest.limitMB,
      percentUsed: latest.percentUsed
    };
  }

  /**
   * Get metrics by date range
   */
  getMetricsByDateRange(
    startDate: PerformanceDate,
    endDate: PerformanceDate
  ): PerformanceMetric[] {
    const start = new Date(startDate as string | number).getTime();
    const end = new Date(endDate as string | number).getTime();

    return this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp).getTime();
      return metricTime >= start && metricTime <= end;
    });
  }

  /**
   * Get metrics by type
   */
  getMetricsByType(type: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.type === type);
  }

  /**
   * Compare metrics between two dates
   */
  compareMetrics(date1: PerformanceDate, date2: PerformanceDate): MetricsComparison {
    const stats1 = this.getMetricsForDate(date1);
    const stats2 = this.getMetricsForDate(date2);

    return {
      date1: {
        date: date1,
        ...stats1
      },
      date2: {
        date: date2,
        ...stats2
      },
      improvement: this.calculateImprovement(stats1, stats2)
    };
  }

  /**
   * Get metrics aggregated by date
   */
  getMetricsForDate(date: PerformanceDate): DailyMetrics {
    const dateStr = typeof date === 'string'
      ? date
      : new Date(date as number).toISOString().split('T')[0];
    const dayMetrics = this.metrics.filter(m => m.date === dateStr);

    return {
      renders: this.getMetricStats(dayMetrics.filter(m => m.type === METRIC_TYPES.RENDER)),
      storageOps: this.getMetricStats(dayMetrics.filter(m => m.type.includes('storage'))),
      stateUpdates: this.getMetricStats(dayMetrics.filter(m => m.type === METRIC_TYPES.STATE_UPDATE)),
      apiCalls: this.getMetricStats(dayMetrics.filter(m => m.type === METRIC_TYPES.API_CALL)),
      memory: dayMetrics.filter(m => m.type === METRIC_TYPES.MEMORY).slice(-1)[0] || null
    };
  }

  /**
   * Calculate improvement percentage
   */
  calculateImprovement(stats1: DailyMetrics, stats2: DailyMetrics): MetricImprovements {
    const improvement: MetricImprovements = {};

    (Object.keys(stats1) as Array<keyof DailyMetrics>).forEach(key => {
      if (stats1[key]!.avg && stats2[key]?.avg) {
        const percent = (
          (((stats1[key]!.avg as number) - (stats2[key]?.avg as number)) /
            (stats1[key]!.avg as number)) * 100
        ).toFixed(2);
        improvement[key] = {
          percent,
          isImprovement: Number(percent) > 0
        };
      }
    });

    return improvement;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): PerformanceReport {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    return {
      generatedAt: new Date().toISOString(),
      session: this.getSessionSummary(),
      today: this.getMetricsForDate(today),
      yesterday: this.getMetricsForDate(yesterday),
      comparison: this.compareMetrics(yesterday, today),
      thresholds: THRESHOLDS
    };
  }

  /**
   * Get top slow operations
   */
  getSlowOperations(limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.exceededThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Clear old metrics (older than X days)
   */
  clearOldMetrics(daysToKeep: number = 30): number {
    const cutoffTime = Date.now() - daysToKeep * 86400000;
    const beforeCount = this.metrics.length;

    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    const removedCount = beforeCount - this.metrics.length;
    logger.log(`Cleared ${removedCount} metrics older than ${daysToKeep} days`);

    return removedCount;
  }

  /**
   * Save metrics to localStorage
   */
  persistMetrics(): void {
    try {
      localStorage.setItem(PERF_KEYS.METRICS, JSON.stringify(this.metrics));
      localStorage.setItem(PERF_KEYS.SUMMARY, JSON.stringify(this.getSessionSummary()));
      localStorage.setItem(PERF_KEYS.HISTORY, JSON.stringify({
        sessionStart: this.sessionStartTime,
        lastUpdate: Date.now()
      }));
    } catch (error) {
      logger.error('Failed to persist performance metrics:', error);
    }
  }

  /**
   * Load metrics from localStorage
   */
  loadPersistedData(): void {
    try {
      const stored = localStorage.getItem(PERF_KEYS.METRICS);
      if (stored) {
        this.metrics = JSON.parse(stored) as PerformanceMetric[];
      }
    } catch (error) {
      logger.error('Failed to load performance metrics:', error);
    }
  }

  /**
   * Export metrics as CSV
   */
  exportAsCSV(): string {
    if (this.metrics.length === 0) {
      return 'No metrics to export';
    }

    const headers = ['Type', 'Duration (ms)', 'Timestamp', 'Date', 'Exceeded Threshold', 'Component', 'Metadata'];
    const rows = this.metrics.map(m => [
      m.type,
      m.duration.toFixed(2),
      new Date(m.timestamp).toLocaleString(),
      m.date,
      m.exceededThreshold ? 'Yes' : 'No',
      m.component || '-',
      JSON.stringify(m)
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }

  /**
   * Export metrics as JSON
   */
  exportAsJSON(): PerformanceExport {
    return {
      exportedAt: new Date().toISOString(),
      metrics: this.metrics,
      summary: this.getSessionSummary(),
      report: this.getPerformanceReport()
    };
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.log(`Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = [];
    this.sessionMetrics = {
      renders: [],
      storageOps: [],
      stateUpdates: [],
      apiCalls: [],
      memory: []
    };
    this.sessionStartTime = Date.now();
    localStorage.removeItem(PERF_KEYS.METRICS);
    logger.log('Performance metrics reset');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience function to measure synchronous operations
 */
export function measurePerf<T>(
  name: string,
  fn: () => T,
  metadata?: MeasureMetadata
): T {
  return performanceMonitor.measure(name, fn, metadata);
}

/**
 * Convenience function to measure async operations
 */
export async function measurePerfAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: MeasureMetadata
): Promise<T> {
  return performanceMonitor.measureAsync(name, fn, metadata);
}

export default performanceMonitor;
