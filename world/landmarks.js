import * as THREE from 'three';

const SYMBOLS = {
  camp: [[0, -11, 'standingStone', 2.4], [-4, -8, 'lantern', 1.6], [4, -8, 'lantern', 1.6],
    [7, -13, 'stump', 1], [-13, -15, 'giant', .9], [13, -22, 'oak', 1.1],
    [9, -5, 'boulder', 1.1], [-6, -5, 'fern', 1.3], [6, -8, 'fern', 1], [-6, -18, 'lantern', 1.25],
    [-15, -37, 'lantern', 1.25], [-7, -57, 'lantern', 1.25], [6, -75, 'lantern', 1.25]],
  watch: [[-4, -5, 'standingStone', 2.5], [4, -5, 'lantern', 1.8], [-6, -8, 'boulder', 1.3]],
  ruin: [[0, -10, 'arch', 2.2], [-9, -13, 'wall', 1.6], [9, -13, 'wall', 1.6], [14, -16, 'standingStone', 2]],
  enclave: [[0, -12, 'arch', 2.8], [-12, -12, 'wall', 2.4], [12, -12, 'wall', 2.4],
    [-18, -20, 'standingStone', 3.5], [18, -20, 'standingStone', 3.5], [-5, -8, 'lantern', 2], [5, -8, 'lantern', 2]],
  crystal: [[-7, -8, 'crystal', 3.2], [7, -12, 'crystal', 3.9], [16, -16, 'boulder', 3.2], [-14, -15, 'boulder', 2.5]],
  summit: [[-6, -8, 'standingStone', 3.4], [8, -8, 'standingStone', 2.2], [0, -15, 'arch', 1.65]],
  dock: [[-4, -6, 'lantern', 1.4], [4, -6, 'lantern', 1.4], [0, -12, 'log', 2.1]],
  marsh: [[-6, -10, 'snag', 1.8], [7, -13, 'standingStone', 1.7], [10, -6, 'lantern', 1.1]],
};

export function createLandmarkScenery(scene, model, assets) {
  const groups = model.landmarks.map((landmark, index) => {
    const group = new THREE.Group();
    const layout = SYMBOLS[landmark.kind] ?? [[0, -8, 'standingStone', 1.5]];
    for (const [i, [dx, dz, kind, size]] of layout.entries()) {
      const { geometry, material } = assets.get(kind, 0, (i + index) % 4);
      const x = landmark.x + dx;
      const z = landmark.z + dz;
      const piece = new THREE.Mesh(geometry, material);
      piece.position.set(x, model.heightAt(x, z) - .14, z);
      piece.rotation.y = i % 2 ? .2 : -.18;
      piece.scale.setScalar(size);
      group.add(piece);
    }
    scene.add(group);
    return { group, landmark };
  });
  const { geometry, material } = assets.get('lantern', 0, 1);
  const marker = new THREE.Mesh(geometry, material);
  marker.scale.setScalar(1.4);
  marker.visible = false;
  const light = new THREE.PointLight(0xffab5c, 24, 15);
  const campLight = new THREE.PointLight(0xffca87, 25, 18);
  campLight.position.set(-4, model.heightAt(-4, -8) + 3, -8);
  scene.add(marker, light, campLight);
  return {
    update(position) {
      for (const { group, landmark } of groups) {
        group.visible = Math.hypot(landmark.x - position.x, landmark.z - position.z) < 225;
      }
      campLight.intensity = Math.hypot(position.x + 4, position.z + 8) < 23 ? 25 : 0;
      light.intensity = marker.visible && Math.hypot(marker.position.x - position.x, marker.position.z - position.z) < 21 ? 24 : 0;
    },
    setBeacon(beacon) {
      marker.visible = Boolean(beacon);
      if (beacon) {
        marker.position.set(beacon.x, model.heightAt(beacon.x, beacon.z), beacon.z);
        light.position.copy(marker.position);
        light.position.y += 2.1;
      }
    },
  };
}
