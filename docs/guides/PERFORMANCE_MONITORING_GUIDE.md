# Performance Monitoring System

## Overview

The GURPS Calculator now includes a comprehensive performance monitoring system to track and analyze application performance improvements over time. This system provides:

- ✅ Real-time performance metrics tracking
- ✅ Historical trend analysis
- ✅ Performance dashboards and visualizations
- ✅ Automated bottleneck detection
- ✅ Performance benchmarking tools
- ✅ Optimization recommendations

## Architecture

### Core Components

#### 1. **Performance Monitor** (`src/utils/performanceMonitor.js`)
Central system for recording and analyzing metrics.

**Key Classes:**
- `PerformanceMonitor` - Main monitoring engine

**Key Methods:**
```javascript
recordMetric(type, duration, metadata)    // Record single metric
measure(name, fn, metadata)               // Measure sync operation
measureAsync(name, fn, metadata)          // Measure async operation
trackRender(componentName, duration)      // Track component renders
trackStorageOp(operation, key, duration)  // Track storage operations
trackStateUpdate(actionType, duration)    // Track state updates
trackApiCall(endpoint, duration, status)  // Track API calls
trackMemory()                             // Track memory usage
getSessionSummary()                       // Get current session stats
getPerformanceReport()                    // Generate comprehensive report
compareMetrics(date1, date2)              // Compare metrics between dates
exportAsCSV()                             // Export to CSV format
exportAsJSON()                            // Export to JSON format
```

#### 2. **React Hooks** (`src/hooks/usePerformanceMonitoring.js`)
Integration hooks for tracking performance within React components.

**Available Hooks:**
```javascript
useRenderPerformance(componentName)       // Track component render times
useStatePerformance(state, stateName)     // Track state changes
useEffectPerformance(callback, deps, effectName)  // Track effects
useAsyncPerformance(asyncFn, deps, opName)       // Track async operations
usePerformanceReporting(intervalMs, onReport)    // Periodic reporting
useMemoryTracking(intervalMs)             // Track memory usage
useDetectSlowRender(thresholdMs, onSlow)  // Detect slow renders
```

#### 3. **Performance Dashboard** (`src/components/PerformanceDashboard.jsx`)
Real-time visualization component showing current performance metrics.

**Features:**
- Live metric cards with trends
- Performance statistics tables
- Slow operations list
- Memory usage monitoring
- Export functionality (CSV/JSON)

#### 4. **Performance Analysis** (`src/utils/performanceAnalysis.js`)
Advanced analysis tools for trend detection and optimization.

**Key Classes:**
- `PerformanceBenchmark` - Run benchmarks
- `BenchmarkComparison` - Compare benchmarks
- `PerformanceTrendAnalysis` - Analyze trends
- `OptimizationSuggestions` - Generate recommendations
- `PerformanceReportGenerator` - Create comprehensive reports

## Metrics Tracked

### Render Performance
- Component render times
- Render count per session
- Min/max/average render duration
- Slow render detection

### Storage Operations
- Read operations duration
- Write operations duration
- Data size tracking
- Operation frequency

### State Updates
- Action type tracking
- Update duration
- Component count affected
- Update frequency

### API Calls
- Endpoint tracking
- Response time
- Status codes
- Response size

### Memory Usage
- Heap usage percentage
- Absolute memory usage
- Memory limits
- Usage trends

## Performance Thresholds

Default thresholds (configurable):

```javascript
RENDER: 16ms          // 60fps target
STORAGE_READ: 5ms
STORAGE_WRITE: 10ms
STATE_UPDATE: 16ms
API_CALL: 100ms
```

Operations exceeding thresholds trigger warnings.

## Usage Guide

### 1. Basic Monitoring

#### Automatic Tracking in Components

```javascript
import { useRenderPerformance } from '../hooks/usePerformanceMonitoring';

function MyComponent() {
  const { renderCount, stats } = useRenderPerformance('MyComponent');
  
  return (
    <div>
      <p>Rendered {renderCount} times</p>
      <p>Average render: {stats.avg}ms</p>
    </div>
  );
}
```

#### Manual Operation Tracking

```javascript
import { performanceMonitor } from '../utils/performanceMonitor';

// Track synchronous operation
performanceMonitor.measure('myOperation', () => {
  // Your code here
}, { label: 'Operation Label' });

// Track async operation
await performanceMonitor.measureAsync('fetchData', async () => {
  return await fetch('/api/data').then(r => r.json());
});

// Track storage operation
const start = performance.now();
const data = localStorage.getItem('myData');
const duration = performance.now() - start;
performanceMonitor.trackStorageOp('read', 'myData', duration, data.length);
```

### 2. State Tracking

```javascript
import { useStatePerformance } from '../hooks/usePerformanceMonitoring';

function Counter() {
  const [count, setCount] = useState(0);
  const stateStats = useStatePerformance(count, 'count');
  
  return (
    <div>
      Count: {count}
      <p>Changed {stateStats.changeCount} times</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
}
```

### 3. Effect Tracking

```javascript
import { useEffectPerformance } from '../hooks/usePerformanceMonitoring';

function DataComponent() {
  useEffectPerformance(
    () => {
      // Your effect code
      fetch('/api/data');
    },
    [],
    'dataFetch'
  );
  
  return <div>Data fetching...</div>;
}
```

### 4. Async Operation Tracking

```javascript
import { useAsyncPerformance } from '../hooks/usePerformanceMonitoring';

function UserProfile() {
  const { data, loading, error, stats } = useAsyncPerformance(
    () => fetch('/api/user').then(r => r.json()),
    [],
    'fetchUser'
  );
  
  return (
    <div>
      {loading && <p>Loading...</p>}
      {data && <p>User: {data.name}</p>}
      <p>Took {stats.lastDuration}ms</p>
    </div>
  );
}
```

### 5. Dashboard Integration

```javascript
import PerformanceDashboard from '../components/PerformanceDashboard';

function App() {
  return (
    <div>
      {/* Your app content */}
      <PerformanceDashboard defaultOpen={false} />
    </div>
  );
}
```

## Performance Dashboard

### Features

1. **Real-Time Metrics**
   - Session duration
   - Total metrics recorded
   - Current memory usage
   - Average render time

2. **Performance Tables**
   - Render performance stats
   - Storage operation stats
   - State update stats
   - API call stats

3. **Slow Operations List**
   - Top 5 slowest operations
   - Operation type and component
   - Duration and timestamp

4. **Memory Monitor**
   - Used memory (MB)
   - Memory limit (MB)
   - Usage percentage with indicator

5. **Export Options**
   - Export metrics as CSV
   - Reset metrics
   - Auto-update every 30 seconds

### Opening the Dashboard

Click the floating performance icon (bottom-right) or open programmatically:

```javascript
// In browser console
import { performanceMonitor } from './src/utils/performanceMonitor';

// View current report
console.table(performanceMonitor.getPerformanceReport().session);

// View slow operations
console.table(performanceMonitor.getSlowOperations());

// View memory usage
performanceMonitor.trackMemory();
```

## Analysis Tools

### Benchmarking

```javascript
import { PerformanceBenchmark, BenchmarkComparison } from '../utils/performanceAnalysis';

// Run a benchmark
const benchmark = new PerformanceBenchmark(
  'myOperation',
  async () => {
    // Code to benchmark
  },
  100  // iterations
);

await benchmark.run();
benchmark.print();

// Get detailed stats
const stats = benchmark.getStats();
console.log(stats.throughput, 'operations/second');
```

### Comparing Benchmarks

```javascript
const comp1 = new PerformanceBenchmark('old', oldFn, 100);
const comp2 = new PerformanceBenchmark('new', newFn, 100);

await comp1.run();
await comp2.run();

const comparison = new BenchmarkComparison(comp1, comp2);
comparison.print();  // Shows performance improvement
```

### Trend Analysis

```javascript
import { PerformanceTrendAnalysis } from '../utils/performanceAnalysis';

// Analyze performance over time
const trends = PerformanceTrendAnalysis.analyzeTimeRange(
  new Date('2026-01-20'),
  new Date('2026-01-23'),
  'render'
);
console.table(trends);

// Detect performance degradation
const issues = PerformanceTrendAnalysis.detectDegradation('render', 1.1);
if (issues) {
  console.table(issues);
}

// Find bottlenecks
const bottlenecks = PerformanceTrendAnalysis.identifyBottlenecks(10);
console.table(bottlenecks);
```

### Optimization Suggestions

```javascript
import { OptimizationSuggestions } from '../utils/performanceAnalysis';

OptimizationSuggestions.printSuggestions();
```

### Report Generation

```javascript
import { PerformanceReportGenerator } from '../utils/performanceAnalysis';

// Generate comprehensive report
PerformanceReportGenerator.printReport();

// Export report
const json = PerformanceReportGenerator.exportAsJSON();
const report = PerformanceReportGenerator.generateReport({
  includeHistory: true,
  includeBottlenecks: true,
  includeSuggestions: true,
  includeDegradation: true,
  days: 7
});
```

## Data Persistence

Performance metrics are persisted to localStorage with keys:
- `perf_metrics` - All recorded metrics
- `perf_summary` - Current session summary
- `perf_history` - Session history metadata

### Clearing Old Data

```javascript
// Remove metrics older than 30 days
performanceMonitor.clearOldMetrics(30);
```

### Manual Data Management

```javascript
// Save metrics
performanceMonitor.persistMetrics();

// Load metrics
performanceMonitor.loadPersistedData();

// Reset all
performanceMonitor.reset();

// Export as CSV
const csv = performanceMonitor.exportAsCSV();

// Export as JSON
const json = performanceMonitor.exportAsJSON();
```

## Integration Examples

### With Storage Operations

```javascript
import storage from '../utils/storage';
import { performanceMonitor } from '../utils/performanceMonitor';

const originalSet = storage.set;
storage.set = async function(key, value, ...args) {
  const start = performance.now();
  try {
    const result = await originalSet.call(this, key, value, ...args);
    const duration = performance.now() - start;
    performanceMonitor.trackStorageOp('write', key, duration, value.length);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    performanceMonitor.trackStorageOp('write', key, duration, 0);
    throw error;
  }
};
```

### With State Reducers

```javascript
import { performanceMonitor } from '../utils/performanceMonitor';

function reducer(state, action) {
  const start = performance.now();
  
  // Your reducer logic
  const newState = { ...state };
  
  const duration = performance.now() - start;
  performanceMonitor.trackStateUpdate(action.type, duration);
  
  return newState;
}
```

### With API Calls

```javascript
import { performanceMonitor } from '../utils/performanceMonitor';

export async function fetchWithTracking(url, options) {
  const start = performance.now();
  
  const response = await fetch(url, options);
  const duration = performance.now() - start;
  
  const contentLength = response.headers.get('content-length') || 0;
  performanceMonitor.trackApiCall(
    url,
    duration,
    response.status,
    contentLength
  );
  
  return response;
}
```

## Monitoring Best Practices

1. **Enable in Development**
   ```javascript
   if (process.env.NODE_ENV === 'development') {
     performanceMonitor.setEnabled(true);
   }
   ```

2. **Sample in Production**
   ```javascript
   // Only monitor 10% of users in production
   const shouldMonitor = Math.random() < 0.1;
   performanceMonitor.setEnabled(shouldMonitor);
   ```

3. **Regular Analysis**
   - Review dashboard daily
   - Check for degradation trends
   - Act on optimization suggestions

4. **Benchmark Changes**
   - Benchmark before refactoring
   - Benchmark after refactoring
   - Compare results
   - Verify improvement

5. **Memory Management**
   - Keep backups of old metrics
   - Clear old data periodically
   - Monitor for memory leaks
   - Watch memory usage trends

## Performance Improvement Tracking

### Expected Improvements from Recent Optimizations

Based on the optimizations already implemented:

| Optimization | Expected Improvement |
|--------------|----------------------|
| React.memo memoization | 40-50% render reduction |
| Batched storage ops | 30% I/O reduction |
| Immer-based reducers | 90% operation speed improvement |
| Schema versioning | Negligible performance impact |

### Measuring Impact

Compare metrics before/after:

```javascript
// Day 1 (baseline)
const baseline = performanceMonitor.getMetricsForDate('2026-01-20');

// Day 10 (after optimization)
const improved = performanceMonitor.getMetricsForDate('2026-01-30');

// Compare
const comparison = performanceMonitor.compareMetrics('2026-01-20', '2026-01-30');
console.table(comparison.improvement);
```

## Troubleshooting

### Dashboard Not Appearing
- Check that `PerformanceDashboard` component is mounted
- Verify monitoring is enabled: `performanceMonitor.isEnabled`
- Look for console errors

### Metrics Not Recording
- Verify hooks are called in components: `useRenderPerformance()`
- Check that monitoring is enabled
- Ensure components are actually re-rendering

### High Memory Usage
- Call `clearOldMetrics()` to remove old data
- Disable monitoring when not needed
- Export and archive metrics regularly

### Inaccurate Measurements
- Disable browser extensions affecting performance
- Close other tabs
- Run measurements multiple times
- Use benchmarking for precise measurements

## Files Added/Modified

| File | Type | Purpose |
|------|------|---------|
| src/utils/performanceMonitor.js | Created | Core monitoring system |
| src/hooks/usePerformanceMonitoring.js | Created | React integration hooks |
| src/components/PerformanceDashboard.jsx | Created | UI dashboard component |
| src/utils/performanceAnalysis.js | Created | Analysis tools |

## Next Steps

1. Integrate performance monitoring into existing components
2. Set up automated benchmarking in CI/CD
3. Create performance budgets for key operations
4. Monitor production metrics via analytics service
5. Establish performance improvement targets

## Summary

The performance monitoring system provides comprehensive tracking of application improvements over time. Use it to:

- ✅ Verify optimizations work
- ✅ Identify new bottlenecks
- ✅ Track trends over time
- ✅ Generate optimization suggestions
- ✅ Compare before/after metrics
- ✅ Make data-driven optimization decisions
