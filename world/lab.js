import * as THREE from 'three';
import { createAssetLibrary } from './assets.js';
import { createAtmosphere } from './atmosphere.js';
import { createCatalog } from './catalog.js';
import { BIOMES, createWorldModel } from './generation.js';
import { createJourney, readPreferences, RESOURCES, writePreferences } from './journey.js';
import { createLandmarkScenery } from './landmarks.js';
import { createWorldMap } from './map.js';
import { createWorldStream } from './stream.js';
import { createTraversal } from './traversal.js';

const byId = id => document.getElementById(id);
const format = new Intl.NumberFormat('de-DE');
const ARTIFACTS = [
  [-1.30, -1.95, 'log'], [2.65, -4.9, 'rock'], [-4.5, -7.0, 'log'],
  [5.5, -9.5, 'log'], [5.7, -4.8, 'rock'], [-6.2, -11.2, 'flower'],
];

function displayDistance(value) {
  return value < 1000 ? format.format(Math.round(value)) + ' m' : (value / 1000).toFixed(1).replace('.', ',') + ' km';
}

function addStarterResources(scene, model, assets, stream) {
  const pickups = ARTIFACTS.map(([x, z, kind], index) => {
    const y = model.heightAt(x, z);
    const item = { id: 'camp-resource-' + index, kind, x, y, z };
    const { geometry, material } = assets.get(kind, 0, index % 4);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = index * .8;
    scene.add(mesh);
    return { item, mesh };
  });
  return {
    nearby(x, z, reach) {
      const items = stream.nearbyResources(x, z, reach);
      for (const { item, mesh } of pickups) {
        if (mesh.visible && Math.hypot(item.x - x, item.z - z) < reach) items.push(item);
      }
      return items;
    },
    removeResource(id) {
      const pickup = pickups.find(entry => entry.item.id === id);
      if (pickup) pickup.mesh.visible = false;
      else stream.removeResource(id);
    },
  };
}

export function startLab(status) {
  const canvas = byId('viewport');
  const coarse = matchMedia('(any-pointer: coarse)').matches;
  const seed = new URL(location.href).searchParams.get('seed')?.slice(0, 64) || '813';
  const model = createWorldModel(seed);
  const settings = {
    quality: byId('quality'), daylight: byId('daylight'), weather: byId('weather'),
    movement: byId('movement'), diagnostics: byId('diagnostics'),
  };
  const stored = readPreferences();
  for (const [key, select] of Object.entries(settings)) {
    if (key === 'diagnostics') {
      select.checked = stored?.diagnostics === true;
    } else if ([...select.options].some(option => option.value === stored?.[key])) {
      select.value = stored[key];
    } else if (key === 'quality' && coarse) select.value = 'low';
  }
  byId('seed').value = seed;

  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance', antialias: !coarse });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, .2, 1450);
  const atmosphere = createAtmosphere(scene);
  const assets = createAssetLibrary();
  const stream = createWorldStream(scene, model, assets, settings.quality.value);
  const scenery = createLandmarkScenery(scene, model, assets);
  const resources = addStarterResources(scene, model, assets, stream);
  const journey = createJourney(model, resources, scenery);
  const traversal = createTraversal({
    scene, camera, canvas, model, stream, spawn: model.spawn,
    controls: {
      joystick: byId('joystick'), thumb: byId('thumb'), sprintButton: byId('sprint'),
      jumpButton: byId('jump'), descendButton: byId('descend'),
    },
  });
  const catalog = createCatalog(assets, {
    kind: byId('asset-kind'), lod: byId('asset-lod'), variant: byId('asset-variant'),
    container: byId('asset-preview'), info: byId('asset-info'),
  });
  const hud = byId('hud');
  const hint = byId('hint');
  const position = traversal.position;
  const mapDialog = byId('map-dialog');
  const packDialog = byId('pack-dialog');
  const optionsDialog = byId('options-dialog');
  const poi = byId('poi');
  const map = createWorldMap(byId('map'), model, site => {
    poi.value = site.id;
    drawMap();
  });
  const prompt = byId('interact');
  let waypoint = model.landmarks.find(site => site.id === 'watchstone');
  let localMap = true;
  let hintExpires = 0;
  let updateAt = 0;
  let lastTick = 0;
  let frame = 0;
  let fpsFrames = 0;
  let fpsSince = 0;
  let slowSamples = 0;
  let fastSamples = 0;
  let pixelRatio = 1;
  let pixelCap = 1;

  for (const site of model.landmarks) poi.add(new Option(site.name, site.id));
  poi.value = waypoint.id;
  map.setLocal(localMap);
  byId('zoom-map').setAttribute('aria-pressed', 'true');
  byId('zoom-map').textContent = 'Ganze Welt';

  function selectedSite() {
    return model.landmarks.find(site => site.id === poi.value);
  }

  function tell(text) {
    hint.textContent = text;
    hint.hidden = false;
    hintExpires = performance.now() + 4500;
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setDrawingBufferSize(width, height, pixelRatio);
  }

  function applySettings(save = false) {
    const quality = settings.quality.value;
    stream.setQuality(quality);
    atmosphere.setQuality(quality);
    atmosphere.setLight(settings.daylight.value);
    atmosphere.setWeather(settings.weather.value);
    traversal.setTravelMode(settings.movement.value);
    byId('jump').textContent = settings.movement.value === 'fly' ? 'Steigen' : 'Sprung';
    byId('descend').hidden = settings.movement.value !== 'fly';
    byId('stats').hidden = !settings.diagnostics.checked;
    pixelCap = Math.min(devicePixelRatio || 1, { low: 1, medium: 1.35, high: 1.65 }[quality]);
    pixelRatio = pixelCap;
    resize();
    if (save) {
      writePreferences(Object.fromEntries(Object.entries(settings).map(([key, control]) => [
        key, key === 'diagnostics' ? control.checked : control.value,
      ])));
    }
  }

  function drawMap() {
    const site = selectedSite();
    const discovered = journey.found.has(site.id) ? 'Entdeckt' : 'Unerkundet';
    byId('map-title').textContent = 'Weltkarte · ' + journey.found.size + ' / ' + model.landmarks.length;
    byId('poi-detail').textContent = site.description + ' ' + discovered + ' · ' +
      displayDistance(Math.hypot(position.x - site.x, position.z - site.z));
    map.draw(position, traversal.heading, site, journey.found, journey.beacon);
  }

  function drawPack() {
    const entries = journey.items.map(([name, quantity]) => {
      const line = document.createElement('li');
      const count = document.createElement('strong');
      count.textContent = quantity;
      line.append(name, count);
      return line;
    });
    byId('inventory').replaceChildren(...entries);
    byId('build').disabled = !journey.canBuild();
    byId('return-beacon').disabled = !journey.beacon;
  }

  function open(dialog) {
    if (document.querySelector('dialog[open]')) return;
    traversal.resetInput();
    dialog.showModal();
    if (dialog === mapDialog) drawMap();
    if (dialog === packDialog) drawPack();
    if (dialog === optionsDialog) catalog.open();
  }

  function teleport(target) {
    traversal.teleport(target.x, target.z);
    stream.update(position.x, position.z);
    updateAt = 0;
    canvas.focus();
  }

  function nearestPickup() {
    const reach = 3;
    let distance = reach;
    let closest;
    for (const item of resources.nearby(position.x, position.z, reach)) {
      const d = Math.hypot(item.x - position.x, item.z - position.z);
      if (RESOURCES[item.kind] && d < distance && Math.abs(item.y - position.y) < 2.6) {
        closest = item;
        distance = d;
      }
    }
    return closest;
  }

  function gather() {
    const resource = nearestPickup();
    if (journey.gather(resource)) {
      tell('+1 ' + RESOURCES[resource.kind].name);
      updateAt = 0;
    }
  }

  function updateHud(now) {
    const site = model.landmarks.find(candidate => Math.hypot(position.x - candidate.x, position.z - candidate.z) < candidate.radius);
    if (journey.discover(site) && site.id !== 'camp') tell('Entdeckt · ' + site.name);
    if (site?.id === waypoint?.id) waypoint = null;
    const biome = model.biomeAt(position.x, position.z);
    byId('region').textContent = site?.name ?? BIOMES[biome].name;
    byId('objective').textContent = journey.found.size < 2
      ? 'Sammle am Rastplatz oder folge dem Pfad zum Wachtstein.'
      : 'Erkunde die Welt und setze ein Wegfeuer.';
    const distance = waypoint && Math.hypot(waypoint.x - position.x, waypoint.z - position.z);
    byId('waypoint').hidden = !distance;
    if (distance) {
      const bearing = Math.atan2(waypoint.x - position.x, position.z - waypoint.z) + traversal.heading;
      byId('arrow').style.transform = 'rotate(' + bearing + 'rad)';
      byId('destination').textContent = waypoint.name + ' · ' + displayDistance(distance);
    }
    byId('travel').textContent = traversal.mode + ' · ' + Math.round(position.y) + ' m ü. M.';
    const nearby = nearestPickup();
    prompt.hidden = !nearby;
    if (nearby) prompt.textContent = (coarse ? '' : 'E · ') + RESOURCES[nearby.kind].name + ' sammeln';
    if (now > hintExpires) hint.hidden = true;
  }

  function showStats(now) {
    fpsFrames++;
    if (now - fpsSince < 1000) return;
    const fps = Math.round(fpsFrames * 1000 / (now - fpsSince));
    fpsFrames = 0;
    fpsSince = now;
    if (settings.diagnostics.checked) {
      const { chunks, pending, instances } = stream.getStats();
      const { calls, triangles } = renderer.info.render;
      byId('stats').textContent = fps + ' FPS · ' + Math.round(pixelRatio * 100) + '% DPR\n' +
        calls + ' Draw Calls · ' + format.format(triangles) + ' Tris\n' +
        chunks + ' Chunks · ' + pending + ' offen · ' + format.format(instances) + ' Instanzen\n' +
        'Seed ' + model.seed + ' · X ' + Math.round(position.x) + ' · Z ' + Math.round(position.z);
    }
    if (document.querySelector('dialog[open]')) return;
    slowSamples = fps < 43 ? slowSamples + 1 : 0;
    fastSamples = fps > 57 ? fastSamples + 1 : 0;
    const min = Math.min(.65, pixelCap);
    const next = slowSamples >= 3 ? Math.max(min, pixelRatio - .12)
      : fastSamples >= 7 ? Math.min(pixelCap, pixelRatio + .08) : pixelRatio;
    if (next !== pixelRatio) {
      pixelRatio = next;
      slowSamples = fastSamples = 0;
      resize();
    }
  }

  function tick(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    if (!document.querySelector('dialog[open]')) traversal.update(dt);
    stream.update(position.x, position.z);
    scenery.update(position);
    atmosphere.update(dt, camera, position);
    renderer.render(scene, camera);
    showStats(now);
    if (now >= updateAt) {
      updateHud(now);
      updateAt = now + 160;
    }
    frame = requestAnimationFrame(tick);
  }

  for (const [id, dialog] of [['open-map', mapDialog], ['open-pack', packDialog], ['open-options', optionsDialog]]) {
    byId(id).addEventListener('click', () => open(dialog));
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  }
  optionsDialog.addEventListener('close', () => catalog.close());
  byId('zoom-map').addEventListener('click', event => {
    localMap = !localMap;
    map.setLocal(localMap);
    event.currentTarget.textContent = localMap ? 'Ganze Welt' : 'Umgebung';
    event.currentTarget.setAttribute('aria-pressed', String(localMap));
    drawMap();
  });
  poi.addEventListener('change', drawMap);
  byId('track').addEventListener('click', () => {
    waypoint = selectedSite();
    mapDialog.close();
    updateAt = 0;
  });
  byId('teleport').addEventListener('click', () => {
    mapDialog.close();
    teleport(selectedSite());
  });
  byId('build').addEventListener('click', () => {
    if (!journey.build(position)) {
      packDialog.close();
      tell('Setze das Wegfeuer auf trockenem Boden.');
      return;
    }
    packDialog.close();
    tell('Wegfeuer gesetzt.');
  });
  byId('return-beacon').addEventListener('click', () => {
    if (!journey.beacon) return;
    packDialog.close();
    teleport(journey.beacon);
  });
  prompt.addEventListener('click', gather);
  for (const control of Object.values(settings)) control.addEventListener('change', () => applySettings(true));
  byId('random-seed').addEventListener('click', () => {
    byId('seed').value = crypto.getRandomValues(new Uint32Array(1))[0];
  });
  byId('seed-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = byId('seed').value.trim();
    if (!value) return;
    const url = new URL(location.href);
    url.searchParams.set('seed', value);
    location.assign(url);
  });
  window.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || document.querySelector('dialog[open]')) return;
    if (event.code === 'KeyM') open(mapDialog);
    if (event.code === 'KeyI') open(packDialog);
    if (event.code === 'Escape') open(optionsDialog);
    if (event.code === 'KeyE') gather();
  });
  window.addEventListener('resize', resize);
  canvas.tabIndex = -1;
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    traversal.resetInput();
    catalog.close();
    if (optionsDialog.open) optionsDialog.close();
    if (mapDialog.open) mapDialog.close();
    if (packDialog.open) packDialog.close();
    cancelAnimationFrame(frame);
    status('Die Grafikverbindung wurde unterbrochen. Das Labor wartet auf WebGL.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    resize();
    status('');
    lastTick = fpsSince = performance.now();
    fpsFrames = 0;
    frame = requestAnimationFrame(tick);
  });

  applySettings();
  stream.update(position.x, position.z);
  traversal.update(1 / 60);
  atmosphere.update(0, camera, position);
  scenery.update(position);
  renderer.render(scene, camera);
  updateHud(performance.now());
  hud.hidden = byId('travel').hidden = byId('touch-controls').hidden = false;
  status('');
  lastTick = fpsSince = performance.now();
  frame = requestAnimationFrame(tick);
}
