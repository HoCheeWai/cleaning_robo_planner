import { describe, it, expect } from 'vitest';
import { simulateTimeline, computeDeadTime } from '../timeline';
import { CalculatorInputs } from '../../types';
import { DEFAULT_INPUTS } from '../../types/defaults';

// Reference scenario: 3 robots, 2 docks, 1 station, 2000m²
const REF_INPUTS: CalculatorInputs = {
  ...DEFAULT_INPUTS,
  actual_area_per_floor: 2000,
  num_of_robots: 3,
  num_of_charging_points: 2,
  num_of_refill_stations: 1,
  num_of_floors: 1,
  service_hub_on_different_floor: false,
  work_assignment_mode: 'fixed-zones',
};

describe('Timeline Simulation - Reference Scenario Validation', () => {
  it('Simultaneous + Fixed Zones', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'fixed-zones' as const };
    const result = simulateTimeline(inputs, 3, 'simultaneous');
    expect(result.rawElapsedTime).toBeCloseTo(331.4, 0);
  });

  it('Simultaneous + Collaborative', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const result = simulateTimeline(inputs, 3, 'simultaneous');
    expect(result.rawElapsedTime).toBeCloseTo(264.5, 0);
  });

  it('Staggered + Fixed Zones', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'fixed-zones' as const };
    const result = simulateTimeline(inputs, 3, 'staggered');
    expect(result.rawElapsedTime).toBeCloseTo(331.4, 0);
  });

  it('Staggered + Collaborative', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const result = simulateTimeline(inputs, 3, 'staggered');
    expect(result.rawElapsedTime).toBeCloseTo(273.3, 0);
  });

  it('Fixed Zones: all robots clean equal amounts', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'fixed-zones' as const };
    const result = simulateTimeline(inputs, 3, 'simultaneous');
    const cleaned = result.timelines.map(t => t.totalCleaned);
    expect(cleaned[0]).toBeCloseTo(cleaned[1], 0);
    expect(cleaned[1]).toBeCloseTo(cleaned[2], 0);
  });

  it('Collaborative: R1 cleans more than R3 (due to dock contention)', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const result = simulateTimeline(inputs, 3, 'simultaneous');
    const cleaned = result.timelines.map(t => t.totalCleaned);
    expect(cleaned[0]).toBeGreaterThan(cleaned[2]);
  });

  it('Collaborative elapsed time <= Fixed Zones elapsed time', () => {
    const fixedInputs = { ...REF_INPUTS, work_assignment_mode: 'fixed-zones' as const };
    const collabInputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const fixed = simulateTimeline(fixedInputs, 3, 'simultaneous');
    const collab = simulateTimeline(collabInputs, 3, 'simultaneous');
    expect(collab.rawElapsedTime).toBeLessThanOrEqual(fixed.rawElapsedTime + 0.1);
  });

  it('Determinism: same inputs produce identical results', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const r1 = simulateTimeline(inputs, 3, 'simultaneous');
    const r2 = simulateTimeline(inputs, 3, 'simultaneous');
    expect(r1.rawElapsedTime).toBe(r2.rawElapsedTime);
    expect(r1.timelines.length).toBe(r2.timelines.length);
    for (let i = 0; i < r1.timelines.length; i++) {
      expect(r1.timelines[i].totalCleaned).toBe(r2.timelines[i].totalCleaned);
      expect(r1.timelines[i].segments.length).toBe(r2.timelines[i].segments.length);
    }
  });

  it('Dead time: Simultaneous+Collab has ~89 min dead time', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const result = simulateTimeline(inputs, 3, 'simultaneous');
    const dead = computeDeadTime(result.timelines, result.rawElapsedTime);
    expect(dead.total_dead_time).toBeCloseTo(89.2, 0);
  });

  it('Total work consumed equals total distance (collaborative)', () => {
    const inputs = { ...REF_INPUTS, work_assignment_mode: 'collaborative' as const };
    const result = simulateTimeline(inputs, 3, 'simultaneous');
    const totalCleaned = result.timelines.reduce((sum, t) => sum + t.totalCleaned, 0);
    const totalDist = (2000 * 1 * 1) / (0.30 * 0.90); // 7407.4
    expect(totalCleaned).toBeCloseTo(totalDist, 0);
  });
});
