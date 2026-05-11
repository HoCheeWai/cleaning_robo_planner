/**
 * Core formula functions for the cleaning robot fleet calculator.
 * These are pure functions used for derived value display and the explanatory breakdown.
 * The simulation (timeline.ts) is the source of truth for total elapsed time.
 */

/**
 * Compute total linear cleaning distance in metres.
 * Formula: (areaPerFloor × numFloors × numPasses) / (cleaningWidth × (1 - overlapPct))
 */
export function computeTotalCleaningDistance(
  areaPerFloor: number,
  numFloors: number,
  numPasses: number,
  cleaningWidth: number,
  overlapPct: number
): number {
  return (areaPerFloor * numFloors * numPasses) / (cleaningWidth * (1 - overlapPct));
}

/**
 * Compute usable battery time (minutes of productive cleaning per charge).
 * Formula: totalBatteryLife × (1 - batteryReserveThreshold)
 */
export function computeUsableBatteryTime(
  totalBatteryLife: number,
  batteryReserveThreshold: number
): number {
  return totalBatteryLife * (1 - batteryReserveThreshold);
}

/**
 * Compute cleaning time per robot in minutes (assuming equal work distribution).
 * Formula: totalDistance / (speed × numRobots)
 */
export function computeCleaningTimePerRobot(
  totalDistance: number,
  speed: number,
  numRobots: number
): number {
  return totalDistance / (speed * numRobots);
}

/**
 * Compute number of recharge cycles needed per robot.
 * Formula: max(0, ceil(cleaningTime / usableBatteryTime) - 1)
 */
export function computeRechargeCycles(
  cleaningTime: number,
  usableBatteryTime: number
): number {
  return Math.max(0, Math.ceil(cleaningTime / usableBatteryTime) - 1);
}

/**
 * Compute number of refill cycles needed per robot.
 * Formula: max(0, ceil(cleaningTime / tankCapacityTime) - 1)
 */
export function computeRefillCycles(
  cleaningTime: number,
  tankCapacityTime: number
): number {
  return Math.max(0, Math.ceil(cleaningTime / tankCapacityTime) - 1);
}

/**
 * Compute estimated charging contention time (average wait for a dock).
 * Formula: max(0, (numRobots / numDocks - 1)) × chargeTime
 * Note: This is a conservative estimate. The simulation produces the actual contention.
 */
export function computeChargingContention(
  numRobots: number,
  numDocks: number,
  chargeTime: number
): number {
  return Math.max(0, (numRobots / numDocks - 1)) * chargeTime;
}

/**
 * Compute estimated refill contention time (average wait for a station).
 * Formula: max(0, (numRobots / numStations - 1)) × refillDuration
 * Note: This is a conservative estimate. The simulation produces the actual contention.
 */
export function computeRefillContention(
  numRobots: number,
  numStations: number,
  refillDuration: number
): number {
  return Math.max(0, (numRobots / numStations - 1)) * refillDuration;
}

/**
 * Compute round-trip travel time to service hub in minutes.
 * Formula: (2 × distance) / speed
 */
export function computeTravelTimeToServiceHub(
  distance: number,
  speed: number
): number {
  return (2 * distance) / speed;
}

/**
 * Compute initial floor distribution time (one-time overhead to deploy robots across floors).
 * The elevator makes ceil(numRobots / (robotsPerTrip × numElevators)) round trips.
 * Each trip takes verticalTravelTime (one elevator cycle: wait + ride to a floor + return).
 * Note: verticalTravelTime already represents one complete elevator cycle.
 */
export function computeFloorDistributionTime(
  numRobots: number,
  robotsPerTrip: number,
  numElevators: number,
  verticalTravelTime: number,
  numFloors: number
): number {
  if (numFloors <= 1) return 0;
  // Number of elevator trips needed to distribute all robots
  // (robots on the ground floor don't need the elevator, but we conservatively assume all do)
  const tripsNeeded = Math.ceil(numRobots / (robotsPerTrip * numElevators));
  return tripsNeeded * verticalTravelTime;
}
