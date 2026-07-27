import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  useAsyncPerformance,
  useDetectSlowRender,
  useEffectPerformance,
  useMemoryTracking,
  usePerformanceReporting,
  useRenderPerformance,
  useStatePerformance,
} from '../usePerformanceMonitoring';
import performanceHooks from '../usePerformanceMonitoring';
import { performanceMonitor } from '../../utils/performanceMonitor';

describe('usePerformanceMonitoring hooks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T12:00:00.000Z'));
    performanceMonitor.setEnabled(true);
    performanceMonitor.reset();
  });

  afterEach(() => {
    performanceMonitor.reset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('tracks render executions and resets local render statistics', () => {
    const { result, rerender } = renderHook(() =>
      useRenderPerformance('CombatPanel'),
    );

    expect(result.current.renderCount).toBe(1);
    expect(performanceMonitor.getMetricsByType('render')).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(12);
      rerender();
    });

    expect(result.current.renderCount).toBe(2);
    expect(result.current.stats).toMatchObject({
      count: 2,
      avg: '0.00',
      min: '0.00',
      max: '0.00',
      total: '0.00',
    });

    act(() => {
      result.current.reset();
      rerender();
    });

    expect(result.current.renderCount).toBe(1);
    expect(result.current.stats).toEqual({
      count: 0,
      avg: 0,
      min: 0,
      max: 0,
    });
  });

  it('does not record render metrics when tracking is disabled', () => {
    const { result } = renderHook(() =>
      useRenderPerformance('DisabledPanel', false),
    );

    expect(result.current.renderCount).toBe(1);
    expect(result.current.stats).toEqual({
      count: 0,
      avg: 0,
      min: 0,
      max: 0,
    });
    expect(performanceMonitor.getMetricsByType('render')).toHaveLength(0);
  });

  it('counts state identity changes and records state-update metadata', () => {
    const initialValue = { hp: 12 };
    const nextValue = { hp: 11 };
    const { result, rerender } = renderHook(
      ({ value }: { value: { hp: number } }) =>
        useStatePerformance(value, 'target'),
      { initialProps: { value: initialValue } },
    );

    expect(result.current.changeCount).toBe(0);

    act(() => {
      vi.advanceTimersByTime(25);
      rerender({ value: nextValue });
    });
    rerender({ value: nextValue });

    expect(result.current.changeCount).toBe(1);
    expect(result.current.lastChanged).toBe(25);
    expect(performanceMonitor.getMetricsByType('state_update')).toHaveLength(1);
    expect(
      performanceMonitor.getMetricsByType('state_update')[0],
    ).toMatchObject({
      stateName: 'target',
      changeCount: 1,
    });
  });

  it('ignores state changes while disabled', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) =>
        useStatePerformance(value, 'counter', false),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });

    expect(result.current.changeCount).toBe(0);
    expect(performanceMonitor.getMetricsByType('state_update')).toHaveLength(0);
  });

  it('measures successful effects and captures thrown errors without rethrowing', () => {
    const recordMetric = vi
      .spyOn(performanceMonitor, 'recordMetric')
      .mockReturnValue(undefined);
    const successful = vi.fn();
    const { rerender } = renderHook(
      ({ dependency }: { dependency: number }) =>
        useEffectPerformance(successful, [dependency], 'sync-effect'),
      { initialProps: { dependency: 1 } },
    );

    rerender({ dependency: 2 });

    const failure = new Error('effect exploded');
    expect(() =>
      renderHook(() =>
        useEffectPerformance(
          () => {
            throw failure;
          },
          [],
          'failing-effect',
        ),
      ),
    ).not.toThrow();

    expect(successful).toHaveBeenCalledTimes(2);
    expect(recordMetric).toHaveBeenCalledTimes(3);
    expect(recordMetric).toHaveBeenLastCalledWith(
      'effect',
      0,
      expect.objectContaining({
        effect: 'failing-effect',
        error: 'effect exploded',
      }),
    );
  });

  it('resolves async operations and reports their duration', async () => {
    const recordMetric = vi
      .spyOn(performanceMonitor, 'recordMetric')
      .mockReturnValue(undefined);
    const asyncFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('ready'), 40);
        }),
    );
    const { result } = renderHook(() =>
      useAsyncPerformance(asyncFn, [], 'load-combat'),
    );

    expect(result.current).toMatchObject({
      data: null,
      loading: true,
      error: null,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(40);
    });

    expect(result.current).toMatchObject({
      data: 'ready',
      loading: false,
      error: null,
      stats: {
        executionCount: 1,
        durations: [40],
        lastDuration: 40,
        averageDuration: 40,
      },
    });
    expect(recordMetric).toHaveBeenCalledWith(
      'async_operation',
      40,
      expect.objectContaining({
        operation: 'load-combat',
        status: 'success',
      }),
    );
  });

  it('captures async rejection and leaves error averageDuration at its initial value', async () => {
    const recordMetric = vi
      .spyOn(performanceMonitor, 'recordMetric')
      .mockReturnValue(undefined);
    const failure = new Error('network unavailable');
    const asyncFn = vi.fn(
      () =>
        new Promise<string>((_resolve, reject) => {
          setTimeout(() => reject(failure), 15);
        }),
    );
    const { result } = renderHook(() =>
      useAsyncPerformance(asyncFn, [], 'sync-remote'),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(failure);
    expect(result.current.stats).toEqual({
      executionCount: 1,
      durations: [15],
      lastDuration: 15,
      averageDuration: 0,
    });
    expect(recordMetric).toHaveBeenCalledWith(
      'async_operation',
      15,
      expect.objectContaining({
        status: 'error',
        error: 'network unavailable',
      }),
    );
  });

  it('reports on an interval and clears the interval on unmount', () => {
    const report = {
      session: { metricsCount: 0 },
      thresholds: {},
    } as unknown as ReturnType<typeof performanceMonitor.getPerformanceReport>;
    vi.spyOn(performanceMonitor, 'getPerformanceReport').mockReturnValue(report);
    const onReport = vi.fn();
    const { unmount } = renderHook(() =>
      usePerformanceReporting(1_000, onReport),
    );

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(onReport).toHaveBeenCalledTimes(2);
    expect(onReport).toHaveBeenNthCalledWith(1, report);
    expect(onReport).toHaveBeenNthCalledWith(2, report);

    unmount();
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onReport).toHaveBeenCalledTimes(2);
  });

  it('tracks initial and periodic memory readings using the singleton monitor', () => {
    const trackMemory = vi
      .spyOn(performanceMonitor, 'trackMemory')
      .mockReturnValueOnce({ used: 100, limit: 1_000, percent: '10.00' })
      .mockReturnValueOnce({ used: 200, limit: 1_000, percent: '20.00' });
    const { result } = renderHook(() => useMemoryTracking(500));

    expect(result.current).toEqual({
      used: 100,
      limit: 1_000,
      percent: '10.00',
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(trackMemory).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({
      used: 200,
      limit: 1_000,
      percent: '20.00',
    });
  });

  it('returns null when browser memory information is unavailable', () => {
    vi.spyOn(performanceMonitor, 'trackMemory').mockReturnValue(null);

    const { result } = renderHook(() => useMemoryTracking());

    expect(result.current).toBeNull();
  });

  it('notifies only when a render exceeds the slow-render threshold', () => {
    const onSlow = vi.fn();
    const { rerender } = renderHook(() =>
      useDetectSlowRender(16, onSlow),
    );

    act(() => {
      vi.advanceTimersByTime(10);
      rerender();
    });
    expect(onSlow).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(20);
      rerender();
    });
    expect(onSlow).toHaveBeenCalledOnce();
    expect(onSlow).toHaveBeenCalledWith(20);
  });

  it('exposes every hook through the default export', () => {
    expect(performanceHooks).toEqual({
      useRenderPerformance,
      useStatePerformance,
      useEffectPerformance,
      useAsyncPerformance,
      usePerformanceReporting,
      useMemoryTracking,
      useDetectSlowRender,
    });
  });
});
