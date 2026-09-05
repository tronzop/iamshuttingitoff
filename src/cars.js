// The garage: one car per current team, each with its own handling. Pure data.
//
// Every stat is a multiplier around 1.0 that the sim applies on top of the tunables in
// config.js, so the Ferrari you always drove is still (almost) the baseline. The liveries
// are colour approximations of the real teams' cars; team names are used only to say
// which colours a car is inspired by — there are no logos, and nothing here is official.
//
//   speed       top speed (multiplies the base scroll speed)
//   accel       how quickly the car gets up to speed, on the launch and after a lift
//   handling    lateral speed across the track
//   tyreWear    wear rate (lower is kinder to the tyres)
//   ers         battery: recharge, DRS refill and slipstream harvest
//   durability  bodywork: damage per contact is divided by this
//   pitCrew     wheel-gun zone width; a slow crew also jams the gun more often
import { TEAMS } from './grid.js';

export const CARS = [
  { id: 'ferrari', team: 'ferrari', name: 'Ferrari', tag: 'Quick in a straight line. The strategy is not.',
    speed: 1.04, accel: 1.0, handling: 1.0, tyreWear: 1.04, ers: 1.0, durability: 1.0, pitCrew: 0.85 },
  { id: 'mclaren', team: 'mclaren', name: 'McLaren', tag: 'Papaya rules. Kind to its tyres, less kind to its floor.',
    speed: 0.97, accel: 1.0, handling: 1.03, tyreWear: 0.92, ers: 1.0, durability: 0.88, pitCrew: 1.1 },
  { id: 'redbull', team: 'redbull', name: 'Red Bull', tag: 'A rocket that chews its rear tyres. Pit crew of the year.',
    speed: 1.06, accel: 1.03, handling: 1.0, tyreWear: 1.14, ers: 0.95, durability: 0.92, pitCrew: 1.2 },
  { id: 'mercedes', team: 'mercedes', name: 'Mercedes', tag: 'Harvests like a power station. Loves a cold day.',
    speed: 0.97, accel: 1.02, handling: 0.98, tyreWear: 1.0, ers: 1.15, durability: 1.05, pitCrew: 1.0 },
  { id: 'aston', team: 'aston', name: 'Aston Martin', tag: 'Turns in beautifully. Then gets passed on the straight.',
    speed: 0.95, accel: 0.98, handling: 1.05, tyreWear: 0.96, ers: 1.0, durability: 1.1, pitCrew: 1.0 },
  { id: 'alpine', team: 'alpine', name: 'Alpine', tag: 'Off the line like a scalded cat. Then bits fall off.',
    speed: 0.97, accel: 1.12, handling: 1.0, tyreWear: 1.0, ers: 1.05, durability: 0.88, pitCrew: 1.0 },
  { id: 'williams', team: 'williams', name: 'Williams', tag: 'Slippery on the straights. A handful everywhere else.',
    speed: 1.05, accel: 0.98, handling: 0.93, tyreWear: 1.0, ers: 1.0, durability: 1.05, pitCrew: 0.95 },
  { id: 'racingbulls', team: 'racingbulls', name: 'Racing Bulls', tag: 'Agile, brave and slightly too eager.',
    speed: 0.99, accel: 1.04, handling: 1.03, tyreWear: 1.02, ers: 1.0, durability: 0.95, pitCrew: 1.05 },
  { id: 'haas', team: 'haas', name: 'Haas', tag: 'Built like a truck. Drives like one. Never breaks.',
    speed: 0.98, accel: 0.96, handling: 0.97, tyreWear: 1.04, ers: 0.95, durability: 1.3, pitCrew: 0.95 },
  { id: 'sauber', team: 'sauber', name: 'Kick Sauber', tag: 'Slow, but nothing wears out and the stops are the fastest in the lane.',
    speed: 0.94, accel: 1.0, handling: 0.98, tyreWear: 0.92, ers: 1.05, durability: 1.0, pitCrew: 1.12 },
];

export const DEFAULT_CAR = 'ferrari';
export const carById = (id) => CARS.find((c) => c.id === id) || CARS.find((c) => c.id === DEFAULT_CAR);
export const teamOfCar = (car) => TEAMS[car.team];

/**
 * Rough worth of each stat, used by the balance test so nobody accidentally ships a car that
 * is simply better than the rest. The units are "how much a +10 % change is felt", so a
 * stat that only matters now and then (the pit crew) counts for less than top speed.
 */
export const BALANCE_WEIGHTS = { speed: 3.0, accel: 0.8, handling: 1.5, tyreLife: 1.5, ers: 0.7, durability: 0.8, pitCrew: 0.6 };
/** Signed overall strength of a car relative to a 1.0-everywhere baseline. */
export function carBalance(car) {
  const w = BALANCE_WEIGHTS;
  return (car.speed - 1) * w.speed + (car.accel - 1) * w.accel + (car.handling - 1) * w.handling
    + (1 / car.tyreWear - 1) * w.tyreLife + (car.ers - 1) * w.ers + (car.durability - 1) * w.durability + (car.pitCrew - 1) * w.pitCrew;
}

/** The five bars shown on the car card, each 1..5. */
export const STAT_BARS = [
  { key: 'speed', label: 'Top speed', value: (c) => c.speed },
  { key: 'accel', label: 'Launch', value: (c) => c.accel },
  { key: 'handling', label: 'Handling', value: (c) => c.handling },
  { key: 'tyres', label: 'Tyre life', value: (c) => 1 / c.tyreWear },
  { key: 'ers', label: 'Battery', value: (c) => c.ers },
];
/** Maps a multiplier in roughly 0.9..1.1 onto 1..5 bars (clamped). */
export function statBars(mul) {
  return Math.max(1, Math.min(5, Math.round(1 + ((mul - 0.9) / 0.2) * 4)));
}
/** One-line description of the quirks the bars do not show. */
export function carQuirks(car) {
  const q = [];
  if (car.durability >= 1.1) q.push('tough bodywork');
  else if (car.durability <= 0.92) q.push('fragile bodywork');
  if (car.pitCrew >= 1.1) q.push('quick pit crew');
  else if (car.pitCrew <= 0.9) q.push('wheel guns jam');
  return q.join(' · ');
}
