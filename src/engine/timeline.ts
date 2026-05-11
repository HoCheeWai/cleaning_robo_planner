/**
 * Event-driven timeline simulation for the cleaning robot fleet calculator.
 * This is the SOURCE OF TRUTH for total elapsed time.
 *
 * Key design principles:
 * - Event-driven: jumps between significant moments (battery empty, tank empty, pool empty, service complete)
 * - Concurrent drain: ALL cleaning robots drain the pool simultaneously at the combined rate
 * - No pre-claiming: robots do NOT grab work upfront; the pool drains in real-time
 * - Deterministic: same inputs always produce identical results; ties broken by robot ID (lowest first)
 */

import {
  CalculatorInputs,
  StartMode,
  RobotTimeline,
  TimelineSegment,
  EfficiencyDataPoint,
  DeadTimeAnalysis,
} from '../types';
import {
  computeTotalCleaningDistance,
  computeUsableBatteryTime,
  computeCleaningTimePerRobot,
  computeTravelTimeToServiceHub,
} from './formulas';

// ===== Internal types =====

type RobotState = 'pending' | 'cleaning' | 'in-service' | 'done';

interface SimRobot {
  id: number; // 1-based, used for deterministic tie-breaking
  state: RobotState;
  startAt: number; // when this robot begins (for staggered start)
  battery: number; // remaining usable battery time (min)
  tank: number; // remaining tank time (min)
  remaining: number; // remaining cleaning time for fixed-zones mode
  cleaned: number; // total distance cleaned (metres)
  cleanStartTime: number | null; // when current cleaning segment started
  serviceEndTime: number | null; // when current service will complete
  segments: TimelineSegment[];
}

export interface SimulationResult {
  timelines: RobotTimeline[];
  efficiencyData: EfficiencyDataPoint[];
  rawElapsedTime: number;
}

// ===== Main simulation function =====

export function simulateTimeline(
  inputs: CalculatorInputs,
  numRobots: number,
  startMode: StartMode
): SimulationResult {
  // Derived constants
  const totalDist = computeTotalCleaningDistance(
    inputs.actual_area_per_floor, inputs.num_of_floors, inputs.num_of_passes,
    inputs.effective_cleaning_width, inputs.overlap_percentage
  );
  const usableBatt = computeUsableBatteryTime(inputs.total_battery_life, inputs.battery_reserve_threshold);
  const travelTime = computeTravelTimeToServiceHub(inputs.distance_to_service_hub, inputs.effective_speed);
  const cleanPerRobot = computeCleaningTimePerRobot(totalDist, inputs.effective_speed, numRobots);

  // Per-robot batch delivery: robots are delivered incrementally by elevator batches
  const batchSize = inputs.num_of_robots_per_elevator_trip * inputs.num_of_elevators;

  // Stagger offset
  const rawCycleTime = Math.min(usableBatt, inputs.tank_capacity_time) + travelTime + inputs.refill_duration + travelTime;
  const effectiveCycleTime = Math.min(rawCycleTime, cleanPerRobot);
  const offset = startMode === 'staggered' ? effectiveCycleTime / numRobots : 0;

  // Resource tracking: when each dock/station becomes free
  const dockFreeAt = new Array(inputs.num_of_charging_points).fill(0);
  const stationFreeAt = new Array(inputs.num_of_refill_stations).fill(0);

  // Initialize robots with per-batch delivery times
  const robots: SimRobot[] = [];
  for (let i = 0; i < numRobots; i++) {
    const batchNumber = Math.ceil((i + 1) / batchSize);
    const deliveryTime = inputs.num_of_floors > 1 ? batchNumber * inputs.vertical_travel_time : 0;
    const robot: SimRobot = {
      id: i + 1,
      state: 'pending',
      startAt: deliveryTime + i * offset,
      battery: usableBatt,
      tank: inputs.tank_capacity_time,
      remaining: inputs.work_assignment_mode === 'fixed-zones' ? cleanPerRobot : 0,
      cleaned: 0,
      cleanStartTime: null,
      serviceEndTime: null,
      segments: [],
    };
    // Add elevator segment for this robot's batch delivery
    if (deliveryTime > 0.01) {
      robot.segments.push({ activity: 'elevator', start: 0, end: deliveryTime, robotIndex: i });
    }
    robots.push(robot);
  }

  // Shared work pool (collaborative mode)
  let pool = totalDist;
  let totalDistanceCleaned = 0;

  // Efficiency data collection
  const efficiencyData: EfficiencyDataPoint[] = [];

  // Current simulation time
  let currentTime = 0;
  let safety = 0;
  const MAX_ITERATIONS = 100000;

  // Record initial efficiency point
  recordEfficiency(efficiencyData, currentTime, 0, numRobots, totalDistanceCleaned, totalDist);

  while (safety++ < MAX_ITERATIONS) {
    // 1. Activate pending robots whose start time has arrived
    for (const r of robots) {
      if (r.state === 'pending' && r.startAt <= currentTime + 0.0001) {
        r.state = 'cleaning';
        r.cleanStartTime = currentTime;
      }
    }

    // 2. Get currently cleaning robots
    const cleaningRobots = robots.filter(r => r.state === 'cleaning');
    const numCleaning = cleaningRobots.length;

    // 2b. Record efficiency if robots just activated (utilization changed from last recorded point)
    if (efficiencyData.length > 0 && numCleaning > 0) {
      const lastPoint = efficiencyData[efficiencyData.length - 1];
      const lastRecordedUtil = lastPoint.fleet_utilization_pct;
      const currentUtil = (numCleaning / numRobots) * 100;
      if (Math.abs(currentUtil - lastRecordedUtil) > 0.01) {
        // Utilization changed — record the new state
        recordEfficiency(efficiencyData, currentTime, numCleaning, numRobots, totalDistanceCleaned, totalDist);
      }
    }

    // 3. Check termination
    if (inputs.work_assignment_mode === 'collaborative' && pool <= 0.01) {
      // All cleaning robots should stop
      for (const r of cleaningRobots) {
        if (r.cleanStartTime !== null) {
          r.segments.push({ activity: 'cleaning', start: r.cleanStartTime, end: currentTime, robotIndex: r.id - 1 });
          r.cleanStartTime = null;
        }
        r.state = 'done';
      }
      break;
    }
    if (robots.every(r => r.state === 'done')) break;
    // In fixed-zones: if all robots are done or in-service with no remaining work, wait for service to finish
    if (inputs.work_assignment_mode === 'fixed-zones') {
      const allDoneOrFinishing = robots.every(r => 
        r.state === 'done' || (r.state === 'in-service' && r.remaining <= 0.01)
      );
      if (allDoneOrFinishing && cleaningRobots.length === 0) {
        // Only in-service robots left, and they have no remaining work — just wait for them
        const pendingServices = robots.filter(r => r.state === 'in-service' && r.serviceEndTime !== null);
        if (pendingServices.length === 0) break;
      }
    }

    // 4. Find next event time
    let nextEvent = Infinity;

    // a. Pending robot starts
    for (const r of robots) {
      if (r.state === 'pending') nextEvent = Math.min(nextEvent, r.startAt);
    }

    // b. Cleaning robot's battery or tank runs out
    for (const r of cleaningRobots) {
      let timeToInterrupt = Math.min(r.battery, r.tank);
      if (inputs.work_assignment_mode === 'fixed-zones') {
        timeToInterrupt = Math.min(timeToInterrupt, r.remaining);
      }
      nextEvent = Math.min(nextEvent, currentTime + timeToInterrupt);
    }

    // c. Pool empties (collaborative mode)
    if (inputs.work_assignment_mode === 'collaborative' && numCleaning > 0) {
      const drainRate = numCleaning * inputs.effective_speed; // m/min
      const timeToEmpty = pool / drainRate;
      nextEvent = Math.min(nextEvent, currentTime + timeToEmpty);
    }

    // d. Robot finishes service
    for (const r of robots) {
      if (r.state === 'in-service' && r.serviceEndTime !== null) {
        nextEvent = Math.min(nextEvent, r.serviceEndTime);
      }
    }

    // Safety: no event found
    if (nextEvent === Infinity || nextEvent < currentTime - 0.001) break;

    // 5. Advance time
    const dt = Math.max(0, nextEvent - currentTime);

    // 6. During dt, all cleaning robots drain pool/battery/tank simultaneously
    if (dt > 0.0001 && numCleaning > 0) {
      const distPerRobot = dt * inputs.effective_speed;
      for (const r of cleaningRobots) {
        r.battery -= dt;
        r.tank -= dt;
        r.cleaned += distPerRobot;
        if (inputs.work_assignment_mode === 'fixed-zones') {
          r.remaining -= dt;
        }
      }
      if (inputs.work_assignment_mode === 'collaborative') {
        pool -= numCleaning * distPerRobot;
        totalDistanceCleaned += numCleaning * distPerRobot;
      } else {
        totalDistanceCleaned += numCleaning * distPerRobot;
      }
    }

    currentTime = nextEvent;

    // 7. Process events at currentTime

    // 7a. Check cleaning robots that must stop (deterministic order: by robot ID)
    const stoppingRobots = cleaningRobots
      .filter(r => {
        if (r.battery <= 0.01 || r.tank <= 0.01) return true;
        if (inputs.work_assignment_mode === 'fixed-zones' && r.remaining <= 0.01) return true;
        if (inputs.work_assignment_mode === 'collaborative' && pool <= 0.01) return true;
        return false;
      })
      .sort((a, b) => a.id - b.id); // deterministic tie-breaking

    for (const r of stoppingRobots) {
      // Record cleaning segment
      if (r.cleanStartTime !== null) {
        r.segments.push({
          activity: 'cleaning',
          start: r.cleanStartTime,
          end: currentTime,
          robotIndex: r.id - 1,
        });
        r.cleanStartTime = null;
      }

      // Determine next state
      const workDone =
        (inputs.work_assignment_mode === 'fixed-zones' && r.remaining <= 0.01) ||
        (inputs.work_assignment_mode === 'collaborative' && pool <= 0.01);

      if (workDone) {
        r.state = 'done';
      } else {
        // Needs service
        scheduleService(r, currentTime, inputs, dockFreeAt, stationFreeAt, travelTime);
      }
    }

    // 7b. Check robots finishing service (deterministic order)
    const finishingService = robots
      .filter(r => r.state === 'in-service' && r.serviceEndTime !== null && currentTime >= r.serviceEndTime - 0.0001)
      .sort((a, b) => a.id - b.id);

    for (const r of finishingService) {
      r.serviceEndTime = null;

      // Check if work remains
      const workRemains =
        (inputs.work_assignment_mode === 'collaborative' && pool > 0.01) ||
        (inputs.work_assignment_mode === 'fixed-zones' && r.remaining > 0.01);

      if (workRemains) {
        r.state = 'cleaning';
        r.cleanStartTime = currentTime;
      } else {
        r.state = 'done';
      }
    }

    // Record efficiency at state transitions
    // Record a point just before the transition (with old numCleaning) for step-function rendering
    const newNumCleaning = robots.filter(r => r.state === 'cleaning').length;
    if (newNumCleaning !== numCleaning || stoppingRobots.length > 0 || finishingService.length > 0) {
      // Record the state just before this transition (previous utilization at this time)
      if (efficiencyData.length > 0 && currentTime > efficiencyData[efficiencyData.length - 1].time + 0.001) {
        recordEfficiency(efficiencyData, currentTime - 0.001, numCleaning, numRobots, totalDistanceCleaned, totalDist);
      }
      // Record the new state after transition
      recordEfficiency(efficiencyData, currentTime, newNumCleaning, numRobots, totalDistanceCleaned, totalDist);
    }
  }

  // Close any open cleaning segments
  for (const r of robots) {
    if (r.state === 'cleaning' && r.cleanStartTime !== null) {
      r.segments.push({
        activity: 'cleaning',
        start: r.cleanStartTime,
        end: currentTime,
        robotIndex: r.id - 1,
      });
      r.cleanStartTime = null;
      r.state = 'done';
    }
  }

  const rawElapsedTime = currentTime;

  // Pad idle segments so all robots end at the same time
  for (const r of robots) {
    const lastEnd = r.segments.length > 0 ? r.segments[r.segments.length - 1].end : 0;
    if (lastEnd < rawElapsedTime - 0.01) {
      r.segments.push({ activity: 'idle', start: lastEnd, end: rawElapsedTime, robotIndex: r.id - 1 });
    }
    // Add initial idle for staggered start (idle between delivery and cleaning start)
    if (r.segments.length > 0 && r.segments[0].start > 0.01 && r.segments[0].activity !== 'elevator') {
      const firstStart = r.segments[0].start;
      r.segments.unshift({ activity: 'idle', start: 0, end: firstStart, robotIndex: r.id - 1 });
    } else if (r.segments.length > 1 && r.segments[0].activity === 'elevator') {
      // If there's an elevator segment followed by a gap before the next segment, add idle
      const elevEnd = r.segments[0].end;
      const nextStart = r.segments[1].start;
      if (nextStart - elevEnd > 0.01) {
        r.segments.splice(1, 0, { activity: 'idle', start: elevEnd, end: nextStart, robotIndex: r.id - 1 });
      }
    }
  }

  // Record final efficiency point
  recordEfficiency(efficiencyData, rawElapsedTime, 0, numRobots, totalDistanceCleaned, totalDist);

  // Build result
  const timelines: RobotTimeline[] = robots.map(r => ({
    robotIndex: r.id - 1,
    segments: r.segments,
    totalCleaned: r.cleaned,
  }));

  return { timelines, efficiencyData, rawElapsedTime };
}

// ===== Service scheduling =====

function scheduleService(
  r: SimRobot,
  currentTime: number,
  inputs: CalculatorInputs,
  dockFreeAt: number[],
  stationFreeAt: number[],
  travelTime: number
): void {
  r.state = 'in-service';
  let t = currentTime;

  const needRefill = r.tank <= 0.01;
  const needCharge = r.battery <= 0.01;
  const floorPenalty = inputs.service_hub_on_different_floor ? inputs.vertical_travel_time : 0;

  // Travel to hub (half of round-trip + floor penalty)
  const travelOneWay = travelTime / 2 + floorPenalty;
  r.segments.push({ activity: 'traveling', start: t, end: t + travelOneWay, robotIndex: r.id - 1 });
  t += travelOneWay;

  if (needRefill) {
    // Find earliest free station
    const earliest = Math.min(...stationFreeAt);
    const idx = stationFreeAt.indexOf(earliest);
    const wait = Math.max(0, earliest - t);
    if (wait > 0.01) {
      r.segments.push({ activity: 'waiting-refill', start: t, end: t + wait, robotIndex: r.id - 1 });
      t += wait;
    }
    r.segments.push({ activity: 'refilling', start: t, end: t + inputs.refill_duration, robotIndex: r.id - 1 });
    t += inputs.refill_duration;
    stationFreeAt[idx] = t;
    r.tank = inputs.tank_capacity_time;
  }

  if (needCharge) {
    // Find earliest free dock
    const earliest = Math.min(...dockFreeAt);
    const idx = dockFreeAt.indexOf(earliest);
    const wait = Math.max(0, earliest - t);
    if (wait > 0.01) {
      r.segments.push({ activity: 'waiting-charge', start: t, end: t + wait, robotIndex: r.id - 1 });
      t += wait;
    }
    r.segments.push({ activity: 'charging', start: t, end: t + inputs.effective_charge_time, robotIndex: r.id - 1 });
    t += inputs.effective_charge_time;
    dockFreeAt[idx] = t;
    r.battery = computeUsableBatteryTime(inputs.total_battery_life, inputs.battery_reserve_threshold);
  }

  // Travel back (half of round-trip + floor penalty)
  r.segments.push({ activity: 'traveling', start: t, end: t + travelOneWay, robotIndex: r.id - 1 });
  t += travelOneWay;

  r.serviceEndTime = t;
}

// ===== Efficiency data recording =====

function recordEfficiency(
  data: EfficiencyDataPoint[],
  time: number,
  numCleaning: number,
  totalRobots: number,
  distanceCleaned: number,
  totalDistance: number
): void {
  data.push({
    time,
    fleet_utilization_pct: (numCleaning / totalRobots) * 100,
    cumulative_progress_pct: Math.min(100, (distanceCleaned / totalDistance) * 100),
  });
}

// ===== Dead time computation =====

export function computeDeadTime(timelines: RobotTimeline[], rawElapsedTime: number): DeadTimeAnalysis {
  // Collect all cleaning segment intervals
  const cleaningIntervals: Array<{ start: number; end: number }> = [];
  for (const tl of timelines) {
    for (const seg of tl.segments) {
      if (seg.activity === 'cleaning') {
        cleaningIntervals.push({ start: seg.start, end: seg.end });
      }
    }
  }

  // Sort by start time
  cleaningIntervals.sort((a, b) => a.start - b.start);

  // Merge overlapping intervals to find "any robot cleaning" periods
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of cleaningIntervals) {
    if (merged.length === 0 || merged[merged.length - 1].end < interval.start - 0.001) {
      merged.push({ ...interval });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, interval.end);
    }
  }

  // Dead periods are the gaps between merged intervals (and before first / after last)
  const deadPeriods: Array<{ start: number; end: number }> = [];
  let prevEnd = 0;
  for (const m of merged) {
    if (m.start - prevEnd > 0.01) {
      deadPeriods.push({ start: prevEnd, end: m.start });
    }
    prevEnd = m.end;
  }
  if (rawElapsedTime - prevEnd > 0.01) {
    deadPeriods.push({ start: prevEnd, end: rawElapsedTime });
  }

  const totalDeadTime = deadPeriods.reduce((sum, p) => sum + (p.end - p.start), 0);

  return {
    total_dead_time: totalDeadTime,
    dead_periods: deadPeriods,
    dead_time_pct: rawElapsedTime > 0 ? (totalDeadTime / rawElapsedTime) * 100 : 0,
  };
}

// ===== Simulated elapsed time (convenience) =====

export function computeSimulatedElapsedTime(timelines: RobotTimeline[]): number {
  let maxEnd = 0;
  for (const tl of timelines) {
    for (const seg of tl.segments) {
      if (seg.end > maxEnd) maxEnd = seg.end;
    }
  }
  return maxEnd;
}
