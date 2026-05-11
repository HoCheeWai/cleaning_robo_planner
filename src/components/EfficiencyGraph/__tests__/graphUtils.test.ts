import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { niceTickInterval, buildUtilizationPath, buildProgressPath, computeXTicks } from '../graphUtils';
import { EfficiencyDataPoint } from '../../../types';

// Simple scale functions for testing
const xScale = (t: number) => t * 2;
const yScale = (pct: number) => 100 - pct;

describe('buildUtilizationPath', () => {
  /**
   * **Validates: Requirements 2.1**
   */
  it('5.1 - produces only M/H/V commands for known data points', () => {
    const data: EfficiencyDataPoint[] = [
      { time: 0, fleet_utilization_pct: 100, cumulative_progress_pct: 0 },
      { time: 50, fleet_utilization_pct: 75, cumulative_progress_pct: 30 },
      { time: 100, fleet_utilization_pct: 50, cumulative_progress_pct: 60 },
    ];
    const path = buildUtilizationPath(data, xScale, yScale);
    // Should start with M
    expect(path).toMatch(/^M /);
    // Should NOT contain any L commands
    expect(path).not.toMatch(/\bL\b/);
    // Should contain H and V commands
    expect(path).toMatch(/H /);
    expect(path).toMatch(/V /);
  });

  it('5.3 - empty data returns empty string', () => {
    expect(buildUtilizationPath([], xScale, yScale)).toBe('');
  });

  it('5.3 - single point returns only M command', () => {
    const data: EfficiencyDataPoint[] = [
      { time: 10, fleet_utilization_pct: 50, cumulative_progress_pct: 20 },
    ];
    const path = buildUtilizationPath(data, xScale, yScale);
    expect(path).toMatch(/^M /);
    expect(path).not.toMatch(/[HVL]/);
  });
});

describe('niceTickInterval', () => {
  /**
   * **Validates: Requirements 2.2**
   */
  it('5.2 - selects correct intervals for various ranges', () => {
    // 35 / 8 = 4.375, first candidate >= 4.375 is 5
    expect(niceTickInterval(35)).toBe(5);
    // 443.9 / 8 = 55.49, first candidate >= 55.49 is 60
    expect(niceTickInterval(443.9)).toBe(60);
    // 5 / 8 = 0.625, first candidate >= 0.625 is 1
    expect(niceTickInterval(5)).toBe(1);
    // 100 / 8 = 12.5, first candidate >= 12.5 is 15
    expect(niceTickInterval(100)).toBe(15);
    // 1000 / 8 = 125, first candidate >= 125 is 150
    expect(niceTickInterval(1000)).toBe(150);
  });

  it('5.3 - handles very small totalTime', () => {
    expect(niceTickInterval(0.5)).toBe(1);
    expect(niceTickInterval(1)).toBe(1);
  });
});

describe('computeXTicks', () => {
  it('produces ticks starting at 0 with round intervals', () => {
    const ticks = computeXTicks(443.9);
    expect(ticks[0]).toBe(0);
    // All ticks should be multiples of the interval
    const interval = ticks[1] - ticks[0];
    for (const t of ticks) {
      expect(t % interval).toBeCloseTo(0, 5);
    }
    // Last tick should be >= totalTime
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(443.9);
  });

  it('5.3 - handles totalTime near zero', () => {
    const ticks = computeXTicks(0);
    expect(ticks).toEqual([0]);
  });
});

// Property-based tests
describe('PBT', () => {
  // Generator for random efficiency data (2+ points, ascending time, valid ranges)
  const effDataArb = fc.array(
    fc.record({
      time: fc.float({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
      fleet_utilization_pct: fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      cumulative_progress_pct: fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    }),
    { minLength: 2, maxLength: 50 }
  ).map(arr => arr.sort((a, b) => a.time - b.time));

  /**
   * **Validates: Requirements 2.1**
   * 5.4 [PBT-exploration] - UNFIXED code would produce L commands (demonstrates the bug)
   */
  it('5.4 [PBT-exploration] - UNFIXED code produces L commands', () => {
    // Simulate the old (unfixed) path builder that used L commands
    function buildOldUtilizationPath(data: EfficiencyDataPoint[]): string {
      if (data.length === 0) return '';
      return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.time).toFixed(1)} ${yScale(d.fleet_utilization_pct).toFixed(1)}`).join(' ');
    }

    fc.assert(
      fc.property(effDataArb, (data) => {
        const path = buildOldUtilizationPath(data);
        // The old code SHOULD contain L commands (demonstrating the bug)
        expect(path).toMatch(/\bL\b/);
      })
    );
  });

  /**
   * **Validates: Requirements 2.1**
   * 5.5 [PBT-fix] - FIXED utilization path contains only M/H/V commands
   */
  it('5.5 [PBT-fix] - FIXED utilization path contains only M/H/V commands', () => {
    fc.assert(
      fc.property(effDataArb, (data) => {
        const path = buildUtilizationPath(data, xScale, yScale);
        // Should NOT contain L commands
        expect(path).not.toMatch(/\bL\b/);
        // Should start with M
        expect(path).toMatch(/^M /);
        // Should contain H and V (for 2+ points)
        if (data.length >= 2) {
          expect(path).toMatch(/H /);
          expect(path).toMatch(/V /);
        }
      })
    );
  });

  /**
   * **Validates: Requirements 3.1**
   * 5.6 [PBT-preservation] - progress path uses L commands (unchanged behavior)
   */
  it('5.6 [PBT-preservation] - progress path uses L commands and no H/V', () => {
    fc.assert(
      fc.property(effDataArb, (data) => {
        const path = buildProgressPath(data, xScale, yScale);
        // Should start with M
        expect(path).toMatch(/^M /);
        // Should contain L commands (linear interpolation)
        if (data.length >= 2) {
          expect(path).toMatch(/\bL\b/);
        }
        // Should NOT contain H or V commands
        expect(path).not.toMatch(/\bH\b/);
        expect(path).not.toMatch(/\bV\b/);
      })
    );
  });
});
