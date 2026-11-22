import * as THREE from 'three';
import { ASSET_KINDS } from './assets.js';

const NAMES = {
  pine: 'Kiefer', oak: 'Eiche', birch: 'Birke', giant: 'Baumriese', snag: 'Toter Baum', log: 'Totholz',
  stump: 'Baumstumpf', shrub: 'Gebüsch', fern: 'Farn', grass: 'Gras', flower: 'Wildblumen', mushroom: 'Pilze',
  reed: 'Schilf', rock: 'Steine', boulder: 'Findling', crystal: 'Kristallader', standingStone: 'Menhir',
  wall: 'Mauerrest', arch: 'Torbogen', lantern: 'Laterne',
};

export function createCatalog(assets, { kind, lod, variant, container, info }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 2, .02, 180);
  scene.add(new THREE.HemisphereLight(0xdeede9, 0x767155, 2.1));
  const light = new THREE.DirectionalLight(0xffe2bb, 2.45);
  light.position.set(6, 9, 7);
  scene.add(light);

  for (const key of Object.keys(ASSET_KINDS)) kind.add(new Option(NAMES[key] ?? key, key));
  kind.value = 'giant';
  let renderer;
  let mesh;
  let frame = 0;
  let failed = false;
  const target = new THREE.Vector3();
  const size = new THREE.Vector3();

  function draw(time) {
    mesh.rotation.y = time * .0005;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  }

  function update() {
    if (failed) return;
    const { geometry, material } = assets.get(kind.value, Number(lod.value), Number(variant.value));
    if (!renderer) {
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch {
        failed = true;
        info.textContent = 'Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar.';
        return;
      }
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
      container.append(renderer.domElement);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    }
    mesh.geometry = geometry;
    mesh.material = material;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    geometry.computeBoundingBox();
    geometry.boundingBox.getCenter(target);
    geometry.boundingBox.getSize(size);
    const distance = Math.max(size.x, size.y, size.z, .1) * Math.max(2.25, 1.4 / camera.aspect);
    camera.position.set(distance * .55, target.y + distance * .20, distance * .75);
    camera.lookAt(0, target.y, 0);
    camera.updateProjectionMatrix();
    const count = (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    info.textContent = new Intl.NumberFormat('de-DE').format(count) + ' Dreiecke';
  }

  for (const element of [kind, lod, variant]) element.addEventListener('change', update);
  return {
    open() {
      update();
      if (renderer && !frame) frame = requestAnimationFrame(draw);
    },
    close() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      // Release the optional context on phones when the preview is hidden.
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        renderer = undefined;
        scene.remove(mesh);
        mesh = undefined;
      }
    },
  };
}
