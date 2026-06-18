// ============================================================
// GALAXY FIELD — stars, space dust, nebula clouds
// ============================================================
import * as THREE from "three";
import { CONFIG } from "./config.js";

function randSpherical(radius, minRadius = 0) {
  // uniform-ish distribution within a sphere shell, biased outward
  const r = minRadius + (radius - minRadius) * Math.pow(Math.random(), 0.5);
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta) * 0.6, // flatten slightly into disc-ish shape
    r * Math.cos(phi)
  );
}

export function createStarfield(scene) {
  const count = CONFIG.galaxy.starCount;
  const radius = CONFIG.galaxy.radius;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xcfd9ff),
    new THREE.Color(0xffe9c4),
    new THREE.Color(CONFIG.colors.nebulaPrimary),
    new THREE.Color(CONFIG.colors.nebulaSecondary),
  ];

  for (let i = 0; i < count; i++) {
    const p = randSpherical(radius, 20);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    sizes[i] = Math.random() * 2.2 + 0.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPixelRatio;
      void main(){
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = sin(uTime * 1.5 + position.x * 0.05 + position.y * 0.07) * 0.35 + 0.85;
        gl_PointSize = size * uPixelRatio * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return {
    mesh: points,
    update(t) {
      material.uniforms.uTime.value = t;
    },
  };
}

export function createSpaceDust(scene) {
  const count = CONFIG.galaxy.dustCount;
  const radius = CONFIG.galaxy.radius * 0.7;
  const positions = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    const p = randSpherical(radius, 5);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
    velocities.push(new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: CONFIG.colors.nebulaPrimary,
    size: 1.1,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return {
    mesh: points,
    update() {
      const pos = geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i].x;
        pos[i * 3 + 1] += velocities[i].y;
        pos[i * 3 + 2] += velocities[i].z;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

function createNebulaSprite(color, size) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  grad.addColorStop(0, hex);
  grad.addColorStop(0.4, hex);
  grad.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(c);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function createNebulas(scene) {
  const group = new THREE.Group();
  const colors = [CONFIG.colors.nebulaPrimary, CONFIG.colors.nebulaSecondary, CONFIG.colors.orbGlow];
  const radius = CONFIG.galaxy.radius * 0.8;

  for (let i = 0; i < CONFIG.galaxy.nebulaCount; i++) {
    const color = colors[i % colors.length];
    const size = 260 + Math.random() * 260;
    const sprite = createNebulaSprite(color, size);
    const p = randSpherical(radius, radius * 0.3);
    sprite.position.copy(p);
    group.add(sprite);
  }

  scene.add(group);
  return { mesh: group };
}
