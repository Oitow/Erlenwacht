const CAMP = { x: 0, z: 191, name: 'Glutlager', arrival: { x: 0, z: 196 } };
const WORKBENCH = { x: 6, z: 186, name: 'Werkbank' };
const BEACON = { x: -5, z: 113, name: 'Wegfeuer', arrival: { x: -3.1, z: 114.5 } };
const TRAIL = { x: 0, z: 53, name: 'Pfad zum Dämmerwald' };

export const STARTER_LANDMARKS = [
  { id: 'glutlager', ...CAMP },
  { id: 'aschenbogen', x: -11, z: 152, name: 'Aschenbogen' },
  { id: 'schilfsenke', x: -49, z: 123, name: 'Schilfsenke' },
  { id: 'falkenkamm', x: 57, z: 148, name: 'Falkenkamm' },
  { id: 'wegfeuer', ...BEACON },
];

const STARTER_NODES = [
  ['camp-windfall', -7, 181, 'wood', 'Windbruchholz'],
  ['camp-iron', 11, 176, 'ore', 'Eisensplitter'],
  ['camp-herb', -8, 170, 'herb', 'Aschenkraut'],
  ['reedbank-windfall', -74, 135, 'wood', 'Wurzeltotholz'],
  ['reedbank-herb', -27, 128, 'herb', 'Uferkraut'],
  ['reedbank-iron', -68, 109, 'ore', 'Mooreisen'],
  ['ridge-driftwood', 24, 138, 'wood', 'Kammholz'],
  ['ridge-iron', 48, 151, 'ore', 'Kammerz'],
  ['ridge-herb', 63, 142, 'herb', 'Falkenkraut'],
].map(([id, x, z, kind, name]) => ({ id, x, z, kind, name }));

export const STARTER = {
  camp: CAMP,
  workbench: WORKBENCH,
  beacon: BEACON,
  trail: TRAIL,
  nodes: STARTER_NODES,
  landmarks: STARTER_LANDMARKS,
};

export const REED_BASIN = { x: -49, z: 130, width: 24, depth: 16, waterY: 3.85 };
export const REED_BRIDGE = { minX: -77, maxX: -22, z: 123, width: 3.6, y: 4.75 };

export function starterPath(z) {
  const t = Math.max(0, Math.min(1, (z - 54) / 142));
  const arc = Math.sin(t * Math.PI);
  return arc * (-12 * arc + 5.4 * Math.sin(t * Math.PI * 2));
}
