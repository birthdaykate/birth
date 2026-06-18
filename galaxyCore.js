// ============================================================
// GALAXY CORE — central energy core, triggers the final sequence
// ============================================================
import * as THREE from "three";
import { CONFIG } from "./config.js";

export function createGalaxyCore(scene) {
  const color = new THREE.Color(CONFIG.colors.coreColor);
  const size = CONFIG.galaxy.coreSize;

  const group = new THREE.Group();

  // inner bright core
  const coreGeo = new THREE.IcosahedronGeometry(size * 0.5, 4);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // layered glow shells
  const shells = [];
  [1.4, 2.2, 3.2].forEach((mult, i) => {
    const geo = new THREE.SphereGeometry(size * mult * 0.5, 32, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: i === 0 ? new THREE.Color(0xffffff) : color },
        uIntensity: { value: 0.5 - i * 0.1 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 uColor;
        uniform float uIntensity;
        void main(){
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0,0.0,1.0)), 2.0) * uIntensity;
          gl_FragColor = vec4(uColor, clamp(intensity,0.0,1.0));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const shell = new THREE.Mesh(geo, mat);
    group.add(shell);
    shells.push(shell);
  });

  // swirling particle ring
  const ringCount = 1400;
  const ringPositions = new Float32Array(ringCount * 3);
  const ringData = [];
  for (let i = 0; i < ringCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = size * (1.2 + Math.random() * 2.4);
    const y = (Math.random() - 0.5) * size * 0.6;
    ringPositions[i * 3] = Math.cos(a) * r;
    ringPositions[i * 3 + 1] = y;
    ringPositions[i * 3 + 2] = Math.sin(a) * r;
    ringData.push({ a, r, y, speed: 0.15 + Math.random() * 0.25 });
  }
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPositions, 3));
  const ringMat = new THREE.PointsMaterial({
    color,
    size: 1.4,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Points(ringGeo, ringMat);
  group.add(ring);

  const light = new THREE.PointLight(color, 6, 600);
  group.add(light);

  group.position.set(0, 0, 0);
  scene.add(group);

  return {
    group,
    core,
    coreMat,
    shells,
    ring,
    ringGeo,
    ringData,
    light,
    triggered: false,
    update(t, playerPos) {
      group.rotation.y += 0.0015;
      core.rotation.x += 0.003;
      core.rotation.y += 0.002;

      const positions = ringGeo.attributes.position.array;
      ringData.forEach((rd, i) => {
        rd.a += rd.speed * 0.01;
        positions[i * 3] = Math.cos(rd.a) * rd.r;
        positions[i * 3 + 2] = Math.sin(rd.a) * rd.r;
      });
      ringGeo.attributes.position.needsUpdate = true;

      const pulse = Math.sin(t * 2) * 0.05 + 1;
      core.scale.setScalar(pulse);

      // intensify as player approaches
      const d = group.position.distanceTo(playerPos);
      const proximity = THREE.MathUtils.clamp(1 - d / 500, 0, 1);
      light.intensity = 6 + proximity * 14;
      shells.forEach((s) => (s.material.uniforms.uIntensity.value = (0.5) * (1 + proximity)));

      return { distance: d, proximity };
    },
  };
}
