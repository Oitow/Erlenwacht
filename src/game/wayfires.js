const REACH = 7;

export function createWayfires(world, saved, { reachedEnclave, reachedCrossroads }) {
  const { camp, beacon } = world.starter;
  const destinations = [
    { id: 'camp', name: camp.name, description: 'Klassenwahl, Werkbank und Sammelpfade', anchor: camp, arrival: camp.arrival ?? world.spawn },
    { id: 'pass', name: beacon.name, description: 'Abstieg zum Dämmerwald', anchor: beacon, arrival: beacon.arrival ?? beacon },
    { id: 'enclave', name: 'Enklave', description: 'Innenhof und Torwache', anchor: world.checkpoint, arrival: world.checkpoint },
    { id: 'crossroads', name: world.landmarks.crossroads.name, description: 'Abzweig zum Moor und zum Mondbruch',
      anchor: world.landmarks.crossroads, arrival: world.expeditionCheckpoint },
  ];
  const byId = new Map(destinations.map(destination => [destination.id, destination]));
  const known = new Set(['camp']);
  if (Array.isArray(saved)) {
    for (const id of saved) if (byId.has(id)) known.add(id);
  }
  if (reachedEnclave) known.add('enclave');
  if (reachedCrossroads) known.add('crossroads');

  function nearby(position) {
    return destinations.find(({ anchor }) => (position.x - anchor.x) ** 2 + (position.z - anchor.z) ** 2 < REACH ** 2);
  }

  return {
    nearby,
    discover(id) {
      if (!byId.has(id) || known.has(id)) return false;
      known.add(id);
      return true;
    },
    arrival(id) { return known.has(id) ? byId.get(id).arrival : null; },
    select(id, position) {
      const departure = nearby(position);
      if (!departure || !known.has(departure.id) || departure.id === id || !known.has(id)) return null;
      return byId.get(id);
    },
    view(position) {
      const current = nearby(position);
      const canTravel = Boolean(current && known.has(current.id));
      return {
        canTravel,
        reason: canTravel ? '' : 'Reise von einem entdeckten Wegfeuer aus.',
        destinations: destinations.map(({ id, name, description }) => ({
          id, name, description,
          current: current?.id === id,
          unlocked: known.has(id),
          available: canTravel && current.id !== id && known.has(id),
        })),
      };
    },
    serialize() { return [...known]; },
  };
}
