import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import performanceMonitorDefault, {
  METRIC_TYPES,
  measurePerf,
  measurePerfAsync,
  performanceMonitor
} from '../performanceMonitor';
import { logger } from '../logger';

describe('performanceMonitor exports', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T14:00:00.000Z'));
    vi.spyOn(logger, 'log').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    localStorage.clear();
    performanceMonitor.setEnabled(true);
    performanceMonitor.reset();
  });

  afterEach(() => {
    performanceMonitor.setEnabled(true);
    performanceMonitor.reset();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('exports the metric type constants and the singleton as the default', () => {
    expect(METRIC_TYPES).toEqual({
      RENDER: 'render',
      STORAGE_READ: 'storage_read',
      STORAGE_WRITE: 'storage_write',
      STATE_UPDATE: 'state_update',
      API_CALL: 'api_call',
      MEMORY: 'memory',
      COMPONENT: 'component'
    });
    expect(performanceMonitorDefault).toBe(performanceMonitor);
  });

  it('measurePerf returns the wrapped result and records a successful metric', () => {
    const result = measurePerf(METRIC_TYPES.RENDER, () => {
      vi.advanceTimersByTime(12);
      return { rows: 4, selected: 'rhea' };
    }, {
      component: 'CombatRoster',
      label: 'filter combatants',
      ignored: 'not retained by measure'
    });

    expect(result).toEqual({ rows: 4, selected: 'rhea' });
    expect(performanceMonitor.getMetricsByType(METRIC_TYPES.RENDER)).toEqual([
      expect.objectContaining({
        type: METRIC_TYPES.RENDER,
        duration: 12,
        component: 'CombatRoster',
        label: 'filter combatants',
        status: 'success',
        exceededThreshold: false
      })
    ]);
    expect(performanceMonitor.metrics[0]).not.toHaveProperty('ignored');
  });

  it('measurePerf records a thrown error and propagates the same error', () => {
    const failure = new Error('initiative calculation failed');

    expect(() => measurePerf(METRIC_TYPES.STATE_UPDATE, () => {
      vi.advanceTimersByTime(7);
      throw failure;
    }, {
      component: 'InitiativeTimeline',
      label: 'reorder'
    })).toThrow(failure);

    expect(performanceMonitor.metrics).toHaveLength(1);
    expect(performanceMonitor.metrics[0]).toEqual(expect.objectContaining({
      type: METRIC_TYPES.STATE_UPDATE,
      duration: 7,
      component: 'InitiativeTimeline',
      label: 'reorder',
      status: 'error',
      error: 'initiative calculation failed'
    }));
  });

  it('measurePerf bypasses timing and recording while monitoring is disabled', () => {
    performanceMonitor.setEnabled(false);

    expect(measurePerf(METRIC_TYPES.RENDER, () => 'unmeasured')).toBe('unmeasured');
    expect(performanceMonitor.metrics).toEqual([]);
  });

  it('measurePerfAsync awaits the wrapped operation and records success', async () => {
    const measured = measurePerfAsync(METRIC_TYPES.API_CALL, () => (
      new Promise(resolve => {
        setTimeout(() => resolve({ combatants: 6 }), 75);
      })
    ), {
      component: 'EncounterLoader',
      label: 'load encounter'
    });

    await vi.advanceTimersByTimeAsync(75);

    await expect(measured).resolves.toEqual({ combatants: 6 });
    expect(performanceMonitor.metrics).toHaveLength(1);
    expect(performanceMonitor.metrics[0]).toEqual(expect.objectContaining({
      type: METRIC_TYPES.API_CALL,
      duration: 75,
      component: 'EncounterLoader',
      label: 'load encounter',
      status: 'success',
      exceededThreshold: false
    }));
  });

  it('measurePerfAsync records a rejection and propagates it', async () => {
    const failure = new Error('encounter service unavailable');
    const measured = measurePerfAsync(METRIC_TYPES.API_CALL, () => (
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(failure), 125);
      })
    ), {
      component: 'EncounterLoader',
      label: 'load encounter'
    });
    const rejection = expect(measured).rejects.toThrow(failure);

    await vi.advanceTimersByTimeAsync(125);
    await rejection;

    expect(performanceMonitor.metrics).toHaveLength(1);
    expect(performanceMonitor.metrics[0]).toEqual(expect.objectContaining({
      type: METRIC_TYPES.API_CALL,
      duration: 125,
      status: 'error',
      error: 'encounter service unavailable',
      exceededThreshold: true
    }));
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('measurePerfAsync bypasses recording while monitoring is disabled', async () => {
    performanceMonitor.setEnabled(false);

    await expect(measurePerfAsync(METRIC_TYPES.API_CALL, async () => 'cached')).resolves.toBe('cached');
    expect(performanceMonitor.metrics).toEqual([]);
  });

  it('flags and warns only when a metric is strictly above its threshold', () => {
    const atThreshold = performanceMonitor.trackRender('CharacterSheet', 16);
    const aboveThreshold = performanceMonitor.trackRender('CombatDashboard', 16.01);

    expect(atThreshold.exceededThreshold).toBe(false);
    expect(aboveThreshold.exceededThreshold).toBe(true);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      'Performance: render took 16.01ms (threshold: 16ms)',
      { component: 'CombatDashboard', propCount: 0 }
    );
  });

  it('returns coherent session aggregates after several metrics', () => {
    performanceMonitor.trackRender('CharacterCard', 4, { compact: true });
    performanceMonitor.trackRender('CharacterCard', 8, { compact: false });
    performanceMonitor.trackRender('CombatDashboard', 20);
    performanceMonitor.trackStorageOp('read', 'campaign-v2', 3, 4096);
    performanceMonitor.trackApiCall('/api/encounters', 90, 200, 2048);

    const summary = performanceMonitor.getSessionSummary();

    expect(summary.metricsCount).toBe(5);
    expect(summary.renders).toEqual({
      count: 3,
      avg: '10.67',
      min: '4.00',
      max: '20.00',
      total: '32.00',
      exceeded: 1
    });
    expect(summary.storageOps).toEqual({
      count: 1,
      avg: '3.00',
      min: '3.00',
      max: '3.00',
      total: '3.00',
      exceeded: 0
    });
    expect(summary.apiCalls.count).toBe(1);
    expect(summary.stateUpdates.count).toBe(0);
    expect(summary.memory).toBeNull();
  });

  it('returns slow operations in descending order and respects the limit', () => {
    performanceMonitor.trackRender('SlowCard', 19);
    performanceMonitor.trackStorageOp('write', 'campaign-v2', 42, 8192);
    performanceMonitor.trackApiCall('/api/rules', 140);
    performanceMonitor.trackRender('FastCard', 8);

    expect(performanceMonitor.getSlowOperations(2).map(metric => metric.duration)).toEqual([140, 42]);
  });

  it('throws while building a report when the comparison dates have no memory readings', () => {
    performanceMonitor.trackStateUpdate('combat/damageApplied', 9, 3);
    performanceMonitor.trackApiCall('/api/campaign', 110, 200, 1024);

    expect(() => performanceMonitor.getPerformanceReport()).toThrow(
      "Cannot read properties of null (reading 'avg')"
    );
  });

  it('builds a coherent report when both comparison dates have memory readings', () => {
    performanceMonitor.recordMetric(METRIC_TYPES.MEMORY, 96 * 1024 * 1024, {
      timestamp: new Date('2026-07-26T14:00:00.000Z').getTime(),
      date: '2026-07-26',
      usedMB: '96.00',
      limitMB: '2048.00',
      percentUsed: '4.69'
    });
    performanceMonitor.recordMetric(METRIC_TYPES.MEMORY, 104 * 1024 * 1024, {
      timestamp: new Date('2026-07-27T14:00:00.000Z').getTime(),
      date: '2026-07-27',
      usedMB: '104.00',
      limitMB: '2048.00',
      percentUsed: '5.08'
    });
    performanceMonitor.trackStateUpdate('combat/damageApplied', 9, 3);
    performanceMonitor.trackApiCall('/api/campaign', 110, 200, 1024);

    const report = performanceMonitor.getPerformanceReport();

    expect(report.generatedAt).toBe('2026-07-27T14:00:00.000Z');
    expect(report.session.metricsCount).toBe(4);
    expect(report.today.stateUpdates.count).toBe(1);
    expect(report.today.apiCalls.count).toBe(1);
    expect(report.today.apiCalls.exceeded).toBe(1);
    expect(report.yesterday.apiCalls.count).toBe(0);
    expect(report.today.memory).toEqual(expect.objectContaining({
      usedMB: '104.00',
      percentUsed: '5.08'
    }));
    expect(report.yesterday.memory).toEqual(expect.objectContaining({
      usedMB: '96.00',
      percentUsed: '4.69'
    }));
    expect(report.thresholds).toEqual({
      RENDER: 16,
      STORAGE_READ: 5,
      STORAGE_WRITE: 10,
      STATE_UPDATE: 16,
      API_CALL: 100
    });
  });

  it('reset clears in-memory metrics and the persisted metric entry', () => {
    performanceMonitor.trackRender('CharacterCard', 5);
    performanceMonitor.persistMetrics();

    expect(localStorage.getItem('perf_metrics')).not.toBeNull();

    performanceMonitor.reset();

    expect(performanceMonitor.metrics).toEqual([]);
    expect(performanceMonitor.getSessionSummary().metricsCount).toBe(0);
    expect(localStorage.getItem('perf_metrics')).toBeNull();
  });
});
