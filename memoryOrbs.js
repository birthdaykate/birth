// ============================================================
// MEMORY ORBS — floating birthday-wish spheres
// ============================================================
import * as THREE from "three";
import { CONFIG } from "./config.js";

export function createMemoryOrbs(scene) {
  const orbs = [];
  const radius = CONFIG.galaxy.radius;
  const wishes = CONFIG.wishes;

  wishes.forEach((wish, i) => {
    const group = new THREE.Group();

    // place orbs on a loose ring at varied heights/distances so they're easy to discover
    const angle = (i / wishes.length) * Math.PI * 2 + Math.random() * 0.4;
    const dist = radius * (0.28 + Math.random() * 0.4);
    const height = (Math.random() - 0.5) * radius * 0.35;
    const pos = new THREE.Vector3(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
    group.position.copy(pos);

    const color = new THREE.Color(CONFIG.colors.orbGlow);

    // core sphere
    const coreGeo = new THREE.SphereGeometry(4.2, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // glow shell
    const glowGeo = new THREE.SphereGeometry(7, 24, 24);
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uIntensity: { value: 0.5 } },
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
          float intensity = pow(0.65 - dot(vNormal, vec3(0,0,1.0)), 2.5) * uIntensity;
          gl_FragColor = vec4(uColor, clamp(intensity, 0.0, 1.0));
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    group.add(glow);

    // orbiting particles
    const particleCount = 60;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleAngles = [];
    for (let p = 0; p < particleCount; p++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 4;
      const y = (Math.random() - 0.5) * 4;
      particlePositions[p * 3] = Math.cos(a) * r;
      particlePositions[p * 3 + 1] = y;
      particlePositions[p * 3 + 2] = Math.sin(a) * r;
      particleAngles.push({ a, r, y, speed: 0.2 + Math.random() * 0.3 });
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color,
      size: 0.9,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    // point light for local illumination
    const light = new THREE.PointLight(color, 0, 60);
    group.add(light);

    scene.add(group);

    orbs.push({
      group,
      core,
      coreMat,
      glowMat,
      particles,
      particleGeo,
      particleAngles,
      light,
      wish,
      visited: false,
      proximityState: 0, // 0..1 smoothing for glow intensity
      baseY: pos.y,
      bobOffset: Math.random() * Math.PI * 2,
    });
  });

  return {
    orbs,
    update(t, playerPos) {
      orbs.forEach((orb) => {
        // gentle bob
        orb.group.position.y = orb.baseY + Math.sin(t * 0.5 + orb.bobOffset) * 3;
        orb.group.rotation.y += 0.002;

        // proximity glow
        const d = orb.group.position.distanceTo(playerPos);
        const proximityTarget = THREE.MathUtils.clamp(1 - d / 120, 0, 1);
        orb.proximityState += (proximityTarget - orb.proximityState) * 0.06;

        orb.glowMat.uniforms.uIntensity.value = 0.4 + orb.proximityState * 1.8;
        orb.particles.material.opacity = orb.proximityState * 0.9;
        orb.light.intensity = orb.proximityState * 4;

        // animate orbiting particles
        const positions = orb.particleGeo.attributes.position.array;
        orb.particleAngles.forEach((pa, i) => {
          pa.a += pa.speed * 0.01 * (1 + orb.proximityState);
          positions[i * 3] = Math.cos(pa.a) * pa.r;
          positions[i * 3 + 2] = Math.sin(pa.a) * pa.r;
        });
        orb.particleGeo.attributes.position.needsUpdate = true;

        const scale = 1 + orb.proximityState * 0.25 + Math.sin(t * 2 + orb.bobOffset) * 0.03;
        orb.core.scale.setScalar(scale);
      });
    },
    getClosestInRange(playerPos, range = 14) {
      let closest = null;
      let closestDist = Infinity;
      orbs.forEach((orb) => {
        const d = orb.group.position.distanceTo(playerPos);
        if (d < range && d < closestDist) {
          closest = orb;
          closestDist = d;
        }
      });
      return closest;
    },
  };
}
