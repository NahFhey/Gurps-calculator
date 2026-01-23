/**
 * @fileoverview Performance analysis and benchmarking utilities
 * 
 * Provides tools for:
 * - Benchmarking specific operations
 * - Analyzing performance trends
 * - Comparing performance between versions
 * - Generating performance reports
 * 
 * @module utils/performanceAnalysis
 */

import { performanceMonitor } from './performanceMonitor';
import { logger } from './logger';

/**
 * Run a performance benchmark for an operation
 */
export class PerformanceBenchmark {
  constructor(name, fn, iterations = 100) {
    this.name = name;
    this.fn = fn;
    this.iterations = iterations;
    this.results = [];
    this.completed = false;
  }

  /**
   * Run the benchmark
   */
  async run() {
    logger.log(`Starting benchmark: ${this.name} (${this.iterations} iterations)`);

    for (let i = 0; i < this.iterations; i++) {
      const start = performance.now();
      try {
        await this.fn();
        const duration = performance.now() - start;
        this.results.push({ duration, status: 'success' });
      } catch (error) {
        const duration = performance.now() - start;
        this.results.push({ duration, status: 'error', error: error.message });
      }
    }

    this.completed = true;
    logger.log(`Benchmark completed: ${this.name}`);
  }

  /**
   * Get benchmark statistics
   */
  getStats() {
    if (this.results.length === 0) {
      return null;
    }

    const durations = this.results.map(r => r.duration);
    const successful = this.results.filter(r => r.status === 'success').length;
    const errors = this.results.filter(r => r.status === 'error').length;

    const sorted = durations.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      name: this.name,
      iterations: this.iterations,
      successful,
      errors,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: p50,
        p95,
        p99
      },
      throughput: (1000 / (durations.reduce((a, b) => a + b, 0) / durations.length)).toFixed(2)
    };
  }

  /**
   * Print benchmark results
   */
  print() {
    const stats = this.getStats();
    if (!stats) {
      console.log('No results available');
      return;
    }

    console.group(`📊 Benchmark: ${stats.name}`);
    console.table({
      'Iterations': stats.iterations,
      'Successful': stats.successful,
      'Errors': stats.errors,
      'Min (ms)': stats.duration.min.toFixed(2),
      'Max (ms)': stats.duration.max.toFixed(2),
      'Avg (ms)': stats.duration.avg.toFixed(2),
      'Median (ms)': stats.duration.median.toFixed(2),
      'P95 (ms)': stats.duration.p95.toFixed(2),
      'P99 (ms)': stats.duration.p99.toFixed(2),
      'Throughput (ops/sec)': stats.throughput
    });
    console.groupEnd();
  }
}

/**
 * Compare two benchmarks
 */
export class BenchmarkComparison {
  constructor(benchmark1, benchmark2) {
    this.benchmark1 = benchmark1;
    this.benchmark2 = benchmark2;
  }

  /**
   * Get comparison statistics
   */
  getComparison() {
    const stats1 = this.benchmark1.getStats();
    const stats2 = this.benchmark2.getStats();

    if (!stats1 || !stats2) {
      return null;
    }

    const avgDiff = stats2.duration.avg - stats1.duration.avg;
    const avgPercent = (avgDiff / stats1.duration.avg) * 100;
    const throughputDiff = 
      parseFloat(stats2.throughput) - parseFloat(stats1.throughput);
    const throughputPercent = (throughputDiff / parseFloat(stats1.throughput)) * 100;

    return {
      benchmark1: stats1.name,
      benchmark2: stats2.name,
      avgDuration: {
        diff: avgDiff.toFixed(2),
        percent: avgPercent.toFixed(2),
        improvement: avgPercent < 0
      },
      throughput: {
        diff: throughputDiff.toFixed(2),
        percent: throughputPercent.toFixed(2),
        improvement: throughputPercent > 0
      },
      winner: avgPercent < 0 ? stats2.name : stats1.name
    };
  }

  /**
   * Print comparison
   */
  print() {
    const comparison = this.getComparison();
    if (!comparison) {
      console.log('No comparison available');
      return;
    }

    console.group(`⚖️ Benchmark Comparison`);
    console.log(`${comparison.benchmark1} vs ${comparison.benchmark2}`);
    console.table({
      'Metric': ['Avg Duration', 'Throughput'],
      'Difference': [
        `${comparison.avgDuration.diff}ms (${comparison.avgDuration.percent}%)`,
        `${comparison.throughput.diff} ops/sec (${comparison.throughput.percent}%)`
      ],
      'Improvement': [
        comparison.avgDuration.improvement ? '✓' : '✗',
        comparison.throughput.improvement ? '✓' : '✗'
      ]
    });
    console.log(`🏆 Winner: ${comparison.winner}`);
    console.groupEnd();
  }
}

/**
 * Performance trend analyzer
 */
export class PerformanceTrendAnalysis {
  /**
   * Analyze performance over time
   */
  static analyzeTimeRange(startDate, endDate, metricType) {
    const metrics = performanceMonitor.getMetricsByDateRange(startDate, endDate)
      .filter(m => !metricType || m.type === metricType);

    if (metrics.length === 0) {
      return null;
    }

    // Group by date
    const byDate = {};
    metrics.forEach(m => {
      if (!byDate[m.date]) {
        byDate[m.date] = [];
      }
      byDate[m.date].push(m);
    });

    // Calculate daily stats
    const dailyStats = Object.entries(byDate).map(([date, dayMetrics]) => {
      const durations = dayMetrics.map(m => m.duration);
      return {
        date,
        count: dayMetrics.length,
        avg: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
        min: Math.min(...durations).toFixed(2),
        max: Math.max(...durations).toFixed(2)
      };
    });

    return dailyStats;
  }

  /**
   * Detect performance degradation
   */
  static detectDegradation(metricType, threshold = 1.1) {
    const all = performanceMonitor.getMetricsByType(metricType);
    if (all.length < 2) return null;

    const grouped = {};
    all.forEach(m => {
      if (!grouped[m.date]) grouped[m.date] = [];
      grouped[m.date].push(m);
    });

    const dates = Object.keys(grouped).sort();
    const issues = [];

    for (let i = 1; i < dates.length; i++) {
      const prevAvg = grouped[dates[i - 1]].reduce((sum, m) => sum + m.duration, 0) / 
                      grouped[dates[i - 1]].length;
      const currentAvg = grouped[dates[i]].reduce((sum, m) => sum + m.duration, 0) / 
                         grouped[dates[i]].length;

      if (currentAvg > prevAvg * threshold) {
        issues.push({
          date: dates[i],
          previousAvg: prevAvg.toFixed(2),
          currentAvg: currentAvg.toFixed(2),
          degradation: ((currentAvg / prevAvg - 1) * 100).toFixed(2) + '%'
        });
      }
    }

    return issues.length > 0 ? issues : null;
  }

  /**
   * Identify performance bottlenecks
   */
  static identifyBottlenecks(limit = 10) {
    const byComponent = {};

    performanceMonitor.metrics.forEach(m => {
      const key = m.component || m.type;
      if (!byComponent[key]) {
        byComponent[key] = [];
      }
      byComponent[key].push(m.duration);
    });

    const bottlenecks = Object.entries(byComponent)
      .map(([component, durations]) => ({
        component,
        count: durations.length,
        avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
        totalDuration: durations.reduce((a, b) => a + b, 0).toFixed(2),
        maxDuration: Math.max(...durations).toFixed(2)
      }))
      .sort((a, b) => parseFloat(b.totalDuration) - parseFloat(a.totalDuration))
      .slice(0, limit);

    return bottlenecks;
  }
}

/**
 * Performance optimization suggestions
 */
export class OptimizationSuggestions {
  /**
   * Generate suggestions based on metrics
   */
  static generateSuggestions() {
    const suggestions = [];
    const report = performanceMonitor.getPerformanceReport();

    // Check render performance
    if (report.session.renders?.count > 0) {
      const avgRender = parseFloat(report.session.renders.avg);
      if (avgRender > 16) {
        suggestions.push({
          type: 'render',
          severity: 'high',
          title: 'Slow renders detected',
          description: `Average render time is ${avgRender.toFixed(2)}ms (target: 16ms for 60fps)`,
          suggestions: [
            'Check for unnecessary re-renders using React DevTools',
            'Consider using React.memo for expensive components',
            'Implement useMemo for expensive calculations',
            'Review component update frequency'
          ]
        });
      }
    }

    // Check storage operations
    if (report.session.storageOps?.count > 0) {
      const avgStorage = parseFloat(report.session.storageOps.avg);
      if (avgStorage > 10) {
        suggestions.push({
          type: 'storage',
          severity: 'medium',
          title: 'Slow storage operations',
          description: `Average storage operation is ${avgStorage.toFixed(2)}ms`,
          suggestions: [
            'Consider batching storage operations',
            'Implement storage caching layer',
            'Review data structures for efficiency',
            'Use compression for large data sets'
          ]
        });
      }
    }

    // Check memory usage
    if (report.session.memory?.percentUsed > 80) {
      suggestions.push({
        type: 'memory',
        severity: 'high',
        title: 'High memory usage',
        description: `Memory usage is at ${report.session.memory.percentUsed}%`,
        suggestions: [
          'Check for memory leaks in subscriptions/listeners',
          'Implement data pagination for large lists',
          'Clear caches periodically',
          'Review component lifecycle for cleanup'
        ]
      });
    }

    // Check for threshold exceeded
    const exceeded = performanceMonitor.getSlowOperations(20);
    if (exceeded.length > 5) {
      suggestions.push({
        type: 'general',
        severity: 'medium',
        title: 'Many operations exceeding thresholds',
        description: `${exceeded.length} operations exceeded their performance thresholds`,
        suggestions: [
          'Review slow operation details in dashboard',
          'Prioritize optimization of most frequent bottlenecks',
          'Consider code splitting for large components'
        ]
      });
    }

    return suggestions;
  }

  /**
   * Print suggestions
   */
  static printSuggestions() {
    const suggestions = this.generateSuggestions();

    if (suggestions.length === 0) {
      console.log('✓ No performance issues detected');
      return;
    }

    console.group('💡 Performance Optimization Suggestions');
    suggestions.forEach(s => {
      console.group(`[${s.severity.toUpperCase()}] ${s.title}`);
      console.log(s.description);
      console.log('Suggestions:');
      s.suggestions.forEach(suggestion => {
        console.log(`  • ${suggestion}`);
      });
      console.groupEnd();
    });
    console.groupEnd();
  }
}

/**
 * Performance report generator
 */
export class PerformanceReportGenerator {
  /**
   * Generate comprehensive performance report
   */
  static generateReport(options = {}) {
    const {
      includeHistory = true,
      includeBottlenecks = true,
      includeSuggestions = true,
      includeDegradation = true,
      days = 7
    } = options;

    const report = {
      generatedAt: new Date().toISOString(),
      summary: performanceMonitor.getPerformanceReport()
    };

    if (includeBottlenecks) {
      report.bottlenecks = PerformanceTrendAnalysis.identifyBottlenecks(10);
    }

    if (includeSuggestions) {
      report.suggestions = OptimizationSuggestions.generateSuggestions();
    }

    if (includeDegradation) {
      report.degradation = {
        renders: PerformanceTrendAnalysis.detectDegradation('render'),
        storage: PerformanceTrendAnalysis.detectDegradation('storage_read'),
        api: PerformanceTrendAnalysis.detectDegradation('api_call')
      };
    }

    if (includeHistory) {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 86400000);
      report.history = {
        renders: PerformanceTrendAnalysis.analyzeTimeRange(
          startDate,
          endDate,
          'render'
        ),
        storage: PerformanceTrendAnalysis.analyzeTimeRange(
          startDate,
          endDate,
          'storage_read'
        )
      };
    }

    return report;
  }

  /**
   * Export report as JSON
   */
  static exportAsJSON() {
    const report = this.generateReport({
      includeHistory: true,
      includeBottlenecks: true,
      includeSuggestions: true,
      includeDegradation: true
    });

    return JSON.stringify(report, null, 2);
  }

  /**
   * Print report to console
   */
  static printReport() {
    const report = this.generateReport();

    console.group('📈 Performance Report');
    console.log(`Generated: ${report.generatedAt}`);

    console.group('Session Summary');
    console.table(report.summary.session);
    console.groupEnd();

    if (report.bottlenecks) {
      console.group('🔴 Top Bottlenecks');
      console.table(report.bottlenecks);
      console.groupEnd();
    }

    if (report.suggestions && report.suggestions.length > 0) {
      console.group('💡 Optimization Suggestions');
      report.suggestions.forEach(s => {
        console.log(`[${s.severity}] ${s.title}: ${s.description}`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  }
}
