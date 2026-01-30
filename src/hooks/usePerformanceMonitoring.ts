/**
 * @fileoverview React hooks for performance monitoring integration
 *
 * Provides hooks for:
 * - Tracking component render times
 * - Monitoring state changes
 * - Measuring effect performance
 * - Profiling render counts
 *
 * @module hooks/usePerformanceMonitoring
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';

// ============================================================================
// Types
// ============================================================================

export interface RenderStats {
  count: number;
  avg: string | number;
  min: string | number;
  max: string | number;
  total?: string;
}

export interface RenderPerformanceResult {
  renderCount: number;
  stats: RenderStats;
  reset: () => void;
}

export interface StatePerformanceResult {
  changeCount: number;
  lastChanged: number | undefined;
  stats: {
    changes: number;
    trackingDuration: string | number;
  };
}

export interface EffectPerformanceResult {
  executionCount: number;
  averageDuration: string | number;
}

export interface AsyncStats {
  executionCount: number;
  durations: number[];
  lastDuration: number;
  averageDuration: number;
}

export interface AsyncPerformanceResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  stats: AsyncStats;
}

export interface MemoryStats {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  percent?: number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to track component render times
 *
 * @param componentName - Name of component for tracking
 * @param enabled - Enable/disable tracking
 * @returns Tracking object with render count and stats
 *
 * @example
 * ```tsx
 * function MyComponent(props) {
 *   const { renderCount, stats } = useRenderPerformance('MyComponent');
 *   return <div>Rendered {renderCount} times</div>;
 * }
 * ```
 */
export function useRenderPerformance(
  componentName: string,
  enabled: boolean = true
): RenderPerformanceResult {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const _previousPropsRef = useRef<unknown>(null);

  renderCountRef.current += 1;

  useEffect(() => {
    if (!enabled) return;

    const renderTime = performance.now();
    renderTimesRef.current.push(renderTime);

    performanceMonitor.trackRender(componentName, renderTime);

    // Keep only last 100 renders
    if (renderTimesRef.current.length > 100) {
      renderTimesRef.current.shift();
    }
  }, [componentName, enabled]);

  const getStats = useCallback((): RenderStats => {
    if (renderTimesRef.current.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0 };
    }

    const times = renderTimesRef.current;
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return {
      count: renderCountRef.current,
      avg: avg.toFixed(2),
      min: Math.min(...times).toFixed(2),
      max: Math.max(...times).toFixed(2),
      total: times.reduce((a, b) => a + b, 0).toFixed(2)
    };
  }, []);

  return {
    renderCount: renderCountRef.current,
    stats: getStats(),
    reset: () => {
      renderCountRef.current = 0;
      renderTimesRef.current = [];
    }
  };
}

/**
 * Hook to track state update performance
 *
 * @param state - State value to monitor
 * @param stateName - Name of state for tracking
 * @param enabled - Enable/disable tracking
 * @returns Stats for state changes
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = useState(0);
 *   const stats = useStatePerformance(count, 'count');
 *   return <div>Count: {count}, Changes: {stats.changeCount}</div>;
 * }
 * ```
 */
export function useStatePerformance<T>(
  state: T,
  stateName: string,
  enabled: boolean = true
): StatePerformanceResult {
  const changeCountRef = useRef(0);
  const lastStateRef = useRef<T>(state);
  const changeTimesRef = useRef<number[]>([]);

  // Detect state changes
  useEffect(() => {
    if (!enabled) return;

    if (lastStateRef.current !== state) {
      changeCountRef.current += 1;
      const changeTime = performance.now();
      changeTimesRef.current.push(changeTime);

      performanceMonitor.recordMetric('state_update', changeTime, {
        stateName,
        changeCount: changeCountRef.current
      });

      lastStateRef.current = state;
    }
  }, [state, stateName, enabled]);

  return {
    changeCount: changeCountRef.current,
    lastChanged: changeTimesRef.current[changeTimesRef.current.length - 1],
    stats: {
      changes: changeCountRef.current,
      trackingDuration: changeTimesRef.current.length > 0
        ? (changeTimesRef.current[changeTimesRef.current.length - 1] - changeTimesRef.current[0]).toFixed(2)
        : 0
    }
  };
}

/**
 * Hook to track effect performance
 *
 * @param callback - Effect callback to measure
 * @param dependencies - Effect dependencies
 * @param effectName - Name for tracking
 * @param enabled - Enable/disable tracking
 *
 * @example
 * ```tsx
 * function DataFetcher() {
 *   useEffectPerformance(
 *     () => { fetch('/api/data'); },
 *     [],
 *     'dataFetch'
 *   );
 *   return <div>Fetching data...</div>;
 * }
 * ```
 */
export function useEffectPerformance(
  callback: () => void,
  dependencies: React.DependencyList,
  effectName: string,
  enabled: boolean = true
): EffectPerformanceResult {
  const effectCountRef = useRef(0);
  const durations = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) return;

    effectCountRef.current += 1;
    const startTime = performance.now();

    try {
      callback();
      const duration = performance.now() - startTime;
      durations.current.push(duration);

      performanceMonitor.recordMetric('effect', duration, {
        effect: effectName,
        executionCount: effectCountRef.current
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric('effect', duration, {
        effect: effectName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    executionCount: effectCountRef.current,
    averageDuration: durations.current.length > 0
      ? (durations.current.reduce((a, b) => a + b, 0) / durations.current.length).toFixed(2)
      : 0
  };
}

/**
 * Hook to track async operation performance
 *
 * @param asyncFn - Async function to measure
 * @param dependencies - Effect dependencies
 * @param operationName - Name for tracking
 *
 * @returns Operation state and performance stats
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { data, loading, error, stats } = useAsyncPerformance(
 *     () => fetch('/api/user').then(r => r.json()),
 *     [],
 *     'fetchUser'
 *   );
 *   return <div>
 *     {loading && <p>Loading...</p>}
 *     {data && <p>User: {data.name}</p>}
 *     <p>Took {stats.lastDuration}ms</p>
 *   </div>;
 * }
 * ```
 */
export function useAsyncPerformance<T>(
  asyncFn: () => Promise<T>,
  dependencies: React.DependencyList,
  operationName: string
): AsyncPerformanceResult<T> {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  const statsRef = useRef<AsyncStats>({
    executionCount: 0,
    durations: [],
    lastDuration: 0,
    averageDuration: 0
  });

  useEffect(() => {
    let isMounted = true;
    const startTime = performance.now();

    asyncFn()
      .then(data => {
        const duration = performance.now() - startTime;

        statsRef.current.executionCount += 1;
        statsRef.current.durations.push(duration);
        statsRef.current.lastDuration = duration;
        statsRef.current.averageDuration =
          statsRef.current.durations.reduce((a, b) => a + b, 0) /
          statsRef.current.durations.length;

        performanceMonitor.recordMetric('async_operation', duration, {
          operation: operationName,
          status: 'success'
        });

        if (isMounted) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: Error) => {
        const duration = performance.now() - startTime;

        statsRef.current.executionCount += 1;
        statsRef.current.durations.push(duration);
        statsRef.current.lastDuration = duration;

        performanceMonitor.recordMetric('async_operation', duration, {
          operation: operationName,
          status: 'error',
          error: error.message
        });

        if (isMounted) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      isMounted = false;
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    stats: statsRef.current
  };
}

/**
 * Hook to periodically report performance metrics
 *
 * @param intervalMs - Interval in milliseconds (default: 1 minute)
 * @param onReport - Callback with performance report
 *
 * @example
 * ```tsx
 * function App() {
 *   usePerformanceReporting(30000, (report) => {
 *     console.log('Performance:', report);
 *   });
 *   return <div>App content</div>;
 * }
 * ```
 */
export function usePerformanceReporting(
  intervalMs: number = 60000,
  onReport?: (report: ReturnType<typeof performanceMonitor.getPerformanceReport>) => void
): void {
  useEffect(() => {
    const interval = setInterval(() => {
      const report = performanceMonitor.getPerformanceReport();

      if (onReport) {
        onReport(report);
      } else {
        console.table(report.session);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, onReport]);
}

/**
 * Hook to track memory usage
 *
 * @param intervalMs - Check interval
 * @returns Current memory stats
 *
 * @example
 * ```tsx
 * function MemoryMonitor() {
 *   const memory = useMemoryTracking();
 *   return <div>Memory: {memory?.percent}%</div>;
 * }
 * ```
 */
export function useMemoryTracking(intervalMs: number = 5000): MemoryStats | null {
  const [memory, setMemory] = useState<MemoryStats | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentMemory = performanceMonitor.trackMemory();
      setMemory(currentMemory);
    }, intervalMs);

    // Initial check
    const initialMemory = performanceMonitor.trackMemory();
    setMemory(initialMemory);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return memory;
}

/**
 * Hook to detect slow renders
 *
 * @param thresholdMs - Threshold for slow render
 * @param onSlow - Callback when render is slow
 *
 * @example
 * ```tsx
 * function SlowComponent() {
 *   useDetectSlowRender(16, (duration) => {
 *     console.warn(`Slow render: ${duration}ms`);
 *   });
 *   return <div>Heavy content</div>;
 * }
 * ```
 */
export function useDetectSlowRender(
  thresholdMs: number = 16,
  onSlow?: (duration: number) => void
): void {
  const renderStartRef = useRef(performance.now());

  useEffect(() => {
    const duration = performance.now() - renderStartRef.current;

    if (duration > thresholdMs && onSlow) {
      onSlow(duration);
    }

    renderStartRef.current = performance.now();
  });
}

export default {
  useRenderPerformance,
  useStatePerformance,
  useEffectPerformance,
  useAsyncPerformance,
  usePerformanceReporting,
  useMemoryTracking,
  useDetectSlowRender
};
