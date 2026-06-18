// ============================================================
// FINAL SEQUENCE — heart formation -> message -> explosion -> name
// ============================================================
import * as THREE from "three";
import gsap from "gsap";
import { CONFIG } from "./config.js";

// Generate points roughly tracing a heart shape (parametric), then fill volume
function heartPoint(t, scale) {
  // classic heart parametric curve
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return new THREE.Vector3(x * scale, y * scale, 0);
}

export function createFinalSequence(scene, camera, renderer) {
  const particleCount = 9000;
  const positions = new Float32Array(particleCount * 3);
  const startPositions = new Float32Array(particleCount * 3);
  const heartTargets = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const heartColor = new THREE.Color(CONFIG.colors.heartColor);
  const pinkColor = new THREE.Color(CONFIG.colors.orbGlow);

  const scale = 1.0;
  for (let i = 0; i < particleCount; i++) {
    // scatter starting position across a wide volume (will be overridden by live star/dust positions by caller if desired)
    const r = 300 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    startPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    startPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    startPositions[i * 3 + 2] = r * Math.cos(phi);

    // target: point along heart curve with slight volumetric jitter + occasional fill point
    const t = Math.random() * Math.PI * 2;
    const base = heartPoint(t, scale);
    const jitter = 0.7;
    const fillFactor = Math.random() * 0.85; // pull some points inward to fill the shape
    heartTargets[i * 3] = base.x * (1 - fillFactor * 0.3) + (Math.random() - 0.5) * jitter;
    heartTargets[i * 3 + 1] = base.y * (1 - fillFactor * 0.3) + (Math.random() - 0.5) * jitter;
    heartTargets[i * 3 + 2] = (Math.random() - 0.5) * 6;

    positions[i * 3] = startPositions[i * 3];
    positions[i * 3 + 1] = startPositions[i * 3 + 1];
    positions[i * 3 + 2] = startPositions[i * 3 + 2];

    const mixed = heartColor.clone().lerp(pinkColor, Math.random() * 0.5);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;

    sizes[i] = 1.2 + Math.random() * 1.8;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      uniform float uPixelRatio;
      void main(){
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (400.0 / -mvPosition.z);
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
  points.visible = false;
  points.renderOrder = 10;
  scene.add(points);

  let exploded = false;
  let explosionVelocities = null;

  function setStartPositionsFromLive(starMesh, dustMesh) {
    // optionally seed start positions from existing star/dust geometry for continuity
    try {
      const starPos = starMesh.geometry.attributes.position.array;
      const dustPos = dustMesh.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const useStars = i % 2 === 0;
        const srcArr = useStars ? starPos : dustPos;
        const srcLen = srcArr.length / 3;
        const idx = Math.floor(Math.random() * srcLen) * 3;
        startPositions[i * 3] = srcArr[idx];
        startPositions[i * 3 + 1] = srcArr[idx + 1];
        startPositions[i * 3 + 2] = srcArr[idx + 2];
        positions[i * 3] = startPositions[i * 3];
        positions[i * 3 + 1] = startPositions[i * 3 + 1];
        positions[i * 3 + 2] = startPositions[i * 3 + 2];
      }
      geometry.attributes.position.needsUpdate = true;
    } catch (e) {
      // fall back silently to default scatter
    }
  }

  function playSequence({ onMessageShown, onExplode, onNameShown, onFinished }) {
    points.visible = true;
    const progress = { v: 0 };

    // Phase 1: gather into heart shape (4s)
    gsap.to(progress, {
      v: 1,
      duration: 4,
      ease: "power2.inOut",
      onUpdate: () => {
        const pos = geometry.attributes.position.array;
        for (let i = 0; i < particleCount; i++) {
          pos[i * 3] = THREE.MathUtils.lerp(startPositions[i * 3], heartTargets[i * 3] * 14, progress.v);
          pos[i * 3 + 1] = THREE.MathUtils.lerp(startPositions[i * 3 + 1], heartTargets[i * 3 + 1] * 14, progress.v);
          pos[i * 3 + 2] = THREE.MathUtils.lerp(startPositions[i * 3 + 2], heartTargets[i * 3 + 2] * 14, progress.v);
        }
        geometry.attributes.position.needsUpdate = true;
      },
      onComplete: () => {
        if (onMessageShown) onMessageShown();

        // hold for a few seconds, gentle pulse
        gsap.to(points.scale, {
          x: 1.06, y: 1.06, z: 1.06,
          duration: 1.2,
          yoyo: true,
          repeat: 3,
          ease: "sine.inOut",
          onComplete: () => {
            explode();
          },
        });
      },
    });

    function explode() {
      if (exploded) return;
      exploded = true;
      if (onExplode) onExplode();

      explosionVelocities = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const dir = new THREE.Vector3(
          positions[i * 3] - 0 + (Math.random() - 0.5) * 4,
          positions[i * 3 + 1] - 0 + (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 60
        ).normalize();
        const speed = 60 + Math.random() * 140;
        explosionVelocities[i * 3] = dir.x * speed;
        explosionVelocities[i * 3 + 1] = dir.y * speed;
        explosionVelocities[i * 3 + 2] = dir.z * speed;
      }

      const expProgress = { v: 0 };
      gsap.to(expProgress, {
        v: 1,
        duration: 1.6,
        ease: "power3.out",
        onUpdate: () => {
          const pos = geometry.attributes.position.array;
          for (let i = 0; i < particleCount; i++) {
            pos[i * 3] += explosionVelocities[i * 3] * 0.016 * (1 - expProgress.v * 0.5);
            pos[i * 3 + 1] += explosionVelocities[i * 3 + 1] * 0.016 * (1 - expProgress.v * 0.5);
            pos[i * 3 + 2] += explosionVelocities[i * 3 + 2] * 0.016 * (1 - expProgress.v * 0.5);
          }
          geometry.attributes.position.needsUpdate = true;
        },
        onComplete: () => {
          if (onNameShown) onNameShown();
          if (onFinished) onFinished();
        },
      });
    }
  }

  return {
    points,
    setStartPositionsFromLive,
    playSequence,
    update() {
      // shape gently drifts/rotates while idle-visible
      if (points.visible && !exploded) {
        points.rotation.y += 0.0008;
      }
    },
  };
}
