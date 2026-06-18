// ============================================================
// PHOTO CONSTELLATIONS — uploaded photos linked by glowing lines
// ============================================================
import * as THREE from "three";
import { CONFIG } from "./config.js";

function loadPhotoTexture(filename) {
  const loader = new THREE.TextureLoader();
  return loader.load(`assets/photos/${filename}`,
    undefined,
    undefined,
    () => console.warn(`[constellations] Could not load photo: ${filename}`)
  );
}

export function createConstellations(scene) {
  const groups = [];
  const radius = CONFIG.galaxy.radius;
  const data = CONFIG.constellations.filter((c) => c.photos && c.photos.length > 0);

  data.forEach((constellation, ci) => {
    const group = new THREE.Group();
    const baseAngle = (ci / Math.max(data.length, 1)) * Math.PI * 2;
    const baseDist = radius * 0.55;
    const centerPos = new THREE.Vector3(
      Math.cos(baseAngle) * baseDist,
      (Math.random() - 0.5) * radius * 0.2,
      Math.sin(baseAngle) * baseDist
    );

    const photoMeshes = [];
    const positions = [];

    constellation.photos.forEach((filename, i) => {
      const angle = (i / constellation.photos.length) * Math.PI * 2;
      const localOffset = new THREE.Vector3(
        Math.cos(angle) * 26 + (Math.random() - 0.5) * 10,
        Math.sin(angle * 1.7) * 14 + (Math.random() - 0.5) * 8,
        Math.sin(angle) * 26 + (Math.random() - 0.5) * 10
      );
      const pos = centerPos.clone().add(localOffset);
      positions.push(pos);

      const texture = loadPhotoTexture(filename);
      const aspect = 1.3;
      const w = 11, h = w / aspect;
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      // soft frame
      const frameGeo = new THREE.PlaneGeometry(w + 0.6, h + 0.6);
      const frameMat = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.nebulaSecondary,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.copy(pos);
      frame.position.z -= 0.05;

      group.add(frame);
      group.add(mesh);
      photoMeshes.push({ mesh, mat, frame, frameMat, basePos: pos.clone() });
    });

    // connecting lines between consecutive photos
    const linePoints = [...positions, positions[0]];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: CONFIG.colors.nebulaSecondary,
      transparent: true,
      opacity: 0,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line);

    scene.add(group);

    groups.push({
      group,
      name: constellation.name,
      centerPos,
      photoMeshes,
      line,
      lineMat,
      activated: false,
      activeAmount: 0,
    });
  });

  return {
    constellations: groups,
    update(t, playerPos) {
      groups.forEach((c) => {
        const d = c.centerPos.distanceTo(playerPos);
        const target = THREE.MathUtils.clamp(1 - d / 220, 0.15, 1);
        c.activeAmount += (target - c.activeAmount) * 0.05;

        c.lineMat.opacity = c.activeAmount * 0.55;
        c.photoMeshes.forEach((p, i) => {
          p.mat.opacity = 0.15 + c.activeAmount * 0.85;
          p.frameMat.opacity = (0.1 + c.activeAmount * 0.4);
          p.mesh.position.y = p.basePos.y + Math.sin(t * 0.4 + i) * 1.5;
          p.frame.position.y = p.mesh.position.y;
          p.mesh.lookAt(playerPos);
          p.frame.lookAt(playerPos);
        });
      });
    },
    getClosest(playerPos, range = 60) {
      let closest = null;
      let closestDist = Infinity;
      groups.forEach((c) => {
        const d = c.centerPos.distanceTo(playerPos);
        if (d < range && d < closestDist) {
          closest = c;
          closestDist = d;
        }
      });
      return closest;
    },
  };
}
