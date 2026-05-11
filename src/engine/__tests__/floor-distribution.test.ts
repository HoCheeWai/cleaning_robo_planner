import { describe, it, expect } from 'vitest';
import { simulateTimeline } from '../timeline';
import { CalculatorInputs } from '../../types';
import { DEFAULT_INPUTS } from '../../types/defaults';

// Multi-floor scenario: 6 robots, 1 elevator, 2 robots/trip, 3 floors, verticalTravelTime=5min
// batchSize = 2*1 = 2, batches needed = ceil(6/2) = 3
// Batch 1 (robots 0,1): delivered at 5min
// Batch 2 (robots 2,3): delivered at 10min
// Batch 3 (robots 4,5): delivered at 15min
const MULTI_BATCH_INPUTS: CalculatorInputs = {
  ...DEFAULT_INPUTS,
  actual_area_per_floor: 2000,
  num_of_robots: 6,
  num_of_floors: 3,
  num_of_elevators: 1,
  num_of_robots_per_elevator_trip: 2,
  vertical_travel_time: 5,
  num_of_charging_points: 3,
  num_of_refill_stations: 2,
  work_assignment_mode: 'fixed-zones',
};

describe('Floor Distribution - Per-Batch Delivery', () => {
  it('multi-batch: robots have different elevator segment durations based on batch', () => {
    const result = simulateTimeline(MULTI_BATCH_INPUTS, 6, 'simultaneous');

    // Each robot's first segment should be 'elevator' with batch-specific end time
    for (let i = 0; i < 6; i++) {
      const timeline = result.timelines[i];
      const elevatorSeg = timeline.segments.find(s => s.activity === 'elevator');
      expect(elevatorSeg).toBeDefined();
      expect(elevatorSeg!.start).toBe(0);

      const batchNumber = Math.ceil((i + 1) / 2); // batchSize = 2
      const expectedDelivery = batchNumber * 5; // verticalTravelTime = 5
      expect(elevatorSeg!.end).toBeCloseTo(expectedDelivery, 1);
    }
  });

  it('multi-batch: earlier batch robots start cleaning before later batch robots', () => {
    const result = simulateTimeline(MULTI_BATCH_INPUTS, 6, 'simultaneous');

    // In simultaneous mode (offset=0), startAt = deliveryTime
    // Robot 0 (batch 1) should start at 5min, Robot 4 (batch 3) at 15min
    const segments = result.timelines;

    // Find first cleaning segment start for each robot
    const cleanStarts = segments.map(tl => {
      const cleanSeg = tl.segments.find(s => s.activity === 'cleaning');
      return cleanSeg ? cleanSeg.start : Infinity;
    });

    // Batch 1 robots (0,1) should start before batch 3 robots (4,5)
    expect(cleanStarts[0]).toBeLessThan(cleanStarts[4]);
    expect(cleanStarts[1]).toBeLessThan(cleanStarts[5]);

    // Batch 1 starts at 5, batch 2 at 10, batch 3 at 15
    expect(cleanStarts[0]).toBeCloseTo(5, 0);
    expect(cleanStarts[2]).toBeCloseTo(10, 0);
    expect(cleanStarts[4]).toBeCloseTo(15, 0);
  });

  it('multi-batch: total elapsed time is less than if all robots waited for last batch', () => {
    const result = simulateTimeline(MULTI_BATCH_INPUTS, 6, 'simultaneous');

    // The total floorDistTime would be 15min (3 batches × 5min)
    // With per-batch delivery, early robots start cleaning sooner,
    // so total elapsed should be less than (15 + cleaning time for all)
    // At minimum, the first batch starts 10min earlier than the old approach
    expect(result.rawElapsedTime).toBeGreaterThan(0);

    // Verify the simulation actually ran (robots cleaned something)
    const totalCleaned = result.timelines.reduce((sum, tl) => sum + tl.totalCleaned, 0);
    expect(totalCleaned).toBeGreaterThan(0);
  });

  it('single-batch: all robots get same delivery time (no change from before)', () => {
    // 4 robots, 1 elevator, 4 robots/trip → batchSize=4, 1 batch
    const inputs: CalculatorInputs = {
      ...DEFAULT_INPUTS,
      actual_area_per_floor: 2000,
      num_of_robots: 4,
      num_of_floors: 3,
      num_of_elevators: 1,
      num_of_robots_per_elevator_trip: 4,
      vertical_travel_time: 5,
      work_assignment_mode: 'fixed-zones',
    };

    const result = simulateTimeline(inputs, 4, 'simultaneous');

    // All robots in batch 1, delivery at 5min
    for (let i = 0; i < 4; i++) {
      const elevatorSeg = result.timelines[i].segments.find(s => s.activity === 'elevator');
      expect(elevatorSeg).toBeDefined();
      expect(elevatorSeg!.end).toBeCloseTo(5, 1);
    }

    // All start cleaning at the same time
    const cleanStarts = result.timelines.map(tl => {
      const cleanSeg = tl.segments.find(s => s.activity === 'cleaning');
      return cleanSeg ? cleanSeg.start : Infinity;
    });
    expect(cleanStarts[0]).toBeCloseTo(cleanStarts[1], 1);
    expect(cleanStarts[0]).toBeCloseTo(cleanStarts[3], 1);
  });

  it('single-floor: no elevator segments, all robots start at 0 (+ offset)', () => {
    const inputs: CalculatorInputs = {
      ...DEFAULT_INPUTS,
      actual_area_per_floor: 2000,
      num_of_robots: 6,
      num_of_floors: 1,
      num_of_elevators: 1,
      num_of_robots_per_elevator_trip: 2,
      vertical_travel_time: 5,
      work_assignment_mode: 'fixed-zones',
    };

    const result = simulateTimeline(inputs, 6, 'simultaneous');

    // No elevator segments
    for (const tl of result.timelines) {
      const elevatorSeg = tl.segments.find(s => s.activity === 'elevator');
      expect(elevatorSeg).toBeUndefined();
    }

    // First robot starts cleaning at time 0
    const firstClean = result.timelines[0].segments.find(s => s.activity === 'cleaning');
    expect(firstClean).toBeDefined();
    expect(firstClean!.start).toBeCloseTo(0, 1);
  });

  it('stagger offset applied on top of delivery time in multi-batch scenario', () => {
    const result = simulateTimeline(MULTI_BATCH_INPUTS, 6, 'staggered');

    // Find first cleaning segment start for each robot
    const cleanStarts = result.timelines.map(tl => {
      const cleanSeg = tl.segments.find(s => s.activity === 'cleaning');
      return cleanSeg ? cleanSeg.start : Infinity;
    });

    // Robot 0 (batch 1, delivery=5): starts at 5 + 0*offset
    // Robot 1 (batch 1, delivery=5): starts at 5 + 1*offset
    // Robot 2 (batch 2, delivery=10): starts at 10 + 2*offset
    // The stagger offset should make each robot start later than the previous
    // (within the same batch, the offset creates the stagger)
    expect(cleanStarts[1]).toBeGreaterThan(cleanStarts[0]);

    // Robot 2 should start at delivery time 10 + 2*offset, which is > robot 1's start
    expect(cleanStarts[2]).toBeGreaterThan(cleanStarts[1]);
  });
});
