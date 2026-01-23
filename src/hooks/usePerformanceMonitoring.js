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

import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitor } from '../utils/performanceMonitor';

/**
 * Hook to track component render times
 * 
 * @param {string} componentName - Name of component for tracking
 * @param {boolean} [enabled=true] - Enable/disable tracking
 * @returns {Object} Tracking object with render count and stats
 * 
 * @example
 * function MyComponent(props) {
 *   const { renderCount, stats } = useRenderPerformance('MyComponent');
 *   return <div>Rendered {renderCount} times</div>;
 * }
 */
export function useRenderPerformance(componentName, enabled = true) {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef([]);
  const previousPropsRef = useRef(null);

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

  const getStats = useCallback(() => {
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
 * @param {*} state - State value to monitor
 * @param {string} stateName - Name of state for tracking
 * @param {boolean} [enabled=true] - Enable/disable tracking
 * @returns {Object} Stats for state changes
 * 
 * @example
 * function Counter() {
 *   const [count, setCount] = useState(0);
 *   const stats = useStatePerformance(count, 'count');
 *   return <div>Count: {count}, Changes: {stats.changeCount}</div>;
 * }
 */
export function useStatePerformance(state, stateName, enabled = true) {
  const changeCountRef = useRef(0);
  const lastStateRef = useRef(state);
  const changeTimesRef = useRef([]);

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
 * @param {Function} callback - Effect callback to measure
 * @param {Array} dependencies - Effect dependencies
 * @param {string} effectName - Name for tracking
 * @param {boolean} [enabled=true] - Enable/disable tracking
 * 
 * @example
 * function DataFetcher() {
 *   useEffectPerformance(
 *     () => { fetch('/api/data'); },
 *     [],
 *     'dataFetch'
 *   );
 *   return <div>Fetching data...</div>;
 * }
 */
export function useEffectPerformance(callback, dependencies, effectName, enabled = true) {
  const effectCountRef = useRef(0);
  const durations = useRef([]);

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
        error: error.message
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
 * @param {Function} asyncFn - Async function to measure
 * @param {Array} dependencies - Effect dependencies
 * @param {string} operationName - Name for tracking
 * 
 * @returns {Object} Operation state and performance stats
 * 
 * @example
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
 */
export function useAsyncPerformance(asyncFn, dependencies, operationName) {
  const [state, setState] = React.useState({
    data: null,
    loading: true,
    error: null
  });

  const statsRef = useRef({
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
      .catch(error => {
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
 * @param {number} [intervalMs=60000] - Interval in milliseconds (default: 1 minute)
 * @param {Function} [onReport] - Callback with performance report
 * 
 * @example
 * function App() {
 *   usePerformanceReporting(30000, (report) => {
 *     console.log('Performance:', report);
 *   });
 *   return <div>App content</div>;
 * }
 */
export function usePerformanceReporting(intervalMs = 60000, onReport) {
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
 * @param {number} [intervalMs=5000] - Check interval
 * @returns {Object} Current memory stats
 * 
 * @example
 * function MemoryMonitor() {
 *   const memory = useMemoryTracking();
 *   return <div>Memory: {memory.percent}%</div>;
 * }
 */
export function useMemoryTracking(intervalMs = 5000) {
  const [memory, setMemory] = React.useState(null);

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
 * @param {number} [thresholdMs=16] - Threshold for slow render
 * @param {Function} [onSlow] - Callback when render is slow
 * 
 * @example
 * function SlowComponent() {
 *   useDetectSlowRender(16, (duration) => {
 *     console.warn(`Slow render: ${duration}ms`);
 *   });
 *   return <div>Heavy content</div>;
 * }
 */
export function useDetectSlowRender(thresholdMs = 16, onSlow) {
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
