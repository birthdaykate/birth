// ============================================================
// MAIN — orchestrates the entire Birthday Universe experience
// ============================================================
import * as THREE from "three";
import gsap from "gsap";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

import { CONFIG } from "./config.js";
import { runTerminalIntro } from "./terminal.js";
import { createStarfield, createSpaceDust, createNebulas } from "./galaxyField.js";
import { createMemoryOrbs } from "./memoryOrbs.js";
import { createConstellations } from "./constellations.js";
import { createGalaxyCore } from "./galaxyCore.js";
import { createFinalSequence } from "./finalSequence.js";
import { createControls } from "./controls.js";
import { createAudioManager } from "./audioManager.js";

// ---------------------------------------------------------------
// Renderer / Scene / Camera
// ---------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.0009);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
camera.position.set(0, 40, CONFIG.galaxy.radius * 0.55);

// ambient + directional fill so orbs/photos read nicely
scene.add(new THREE.AmbientLight(0x554477, 0.6));
const fillLight = new THREE.DirectionalLight(0xaeb8ff, 0.4);
fillLight.position.set(100, 200, 100);
scene.add(fillLight);

// ---------------------------------------------------------------
// Postprocessing — bloom + FXAA
// ---------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.1,  // strength
  0.6,  // radius
  0.15  // threshold
);
composer.addPass(bloomPass);

const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms["resolution"].value.set(
  1 / (window.innerWidth * renderer.getPixelRatio()),
  1 / (window.innerHeight * renderer.getPixelRatio())
);
composer.addPass(fxaaPass);

window.addEventListener("resize", () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
  fxaaPass.material.uniforms["resolution"].value.set(
    1 / (w * renderer.getPixelRatio()),
    1 / (h * renderer.getPixelRatio())
  );
});

// ---------------------------------------------------------------
// World content
// ---------------------------------------------------------------
const starfield = createStarfield(scene);
const dust = createSpaceDust(scene);
const nebulas = createNebulas(scene);
const orbSystem = createMemoryOrbs(scene);
const constellationSystem = createConstellations(scene);
const core = createGalaxyCore(scene);
const finalSeq = createFinalSequence(scene, camera, renderer);
finalSeq.setStartPositionsFromLive(starfield.mesh, dust.mesh);

const controls = createControls(camera, renderer.domElement);
const audio = createAudioManager();

// ---------------------------------------------------------------
// UI references
// ---------------------------------------------------------------
const hud = document.getElementById("hud");
const hudName = document.getElementById("hud-name");
const orbCountEl = document.getElementById("orb-count");
const orbTotalEl = document.getElementById("orb-total");
const progressFill = document.getElementById("progress-fill");
const corePrompt = document.getElementById("core-prompt");
const hintBar = document.getElementById("hint-bar");

const memoryPanel = document.getElementById("memory-panel");
const memoryPhoto = document.getElementById("memory-photo");
const memoryText = document.getElementById("memory-text");
const memoryClose = document.getElementById("memory-close");

const finalOverlay = document.getElementById("final-overlay");
const finalMessageEl = document.getElementById("final-message");
const finalNameEl = document.getElementById("final-name");
const finalHeartTag = document.getElementById("final-heart-tag");
const finalSubEl = document.getElementById("final-sub");
const replayBtn = document.getElementById("replay-btn");

const soundToggle = document.getElementById("sound-toggle");

hudName.textContent = CONFIG.GIRL_NAME;
orbTotalEl.textContent = orbSystem.orbs.length;
finalNameEl.textContent = CONFIG.GIRL_NAME;
finalMessageEl.textContent = CONFIG.finalMessage;
finalSubEl.textContent = CONFIG.finalSubMessage;

let visitedCount = 0;
let panelOpen = false;
let coreSequenceStarted = false;
let exploring = false;

function updateOrbCount() {
  orbCountEl.textContent = visitedCount;
  progressFill.style.width = `${(visitedCount / Math.max(orbSystem.orbs.length, 1)) * 100}%`;
}

function openMemoryPanel(orb) {
  panelOpen = true;
  memoryPhoto.style.display = "none";
  if (orb.wish.photo) {
    memoryPhoto.src = `assets/photos/${orb.wish.photo}`;
    memoryPhoto.style.display = "block";
  }
  memoryText.textContent = orb.wish.text;
  memoryPanel.classList.add("open");
  document.exitPointerLock?.();

  if (!orb.visited) {
    orb.visited = true;
    visitedCount++;
    updateOrbCount();
  }
}

memoryClose.addEventListener("click", () => {
  panelOpen = false;
  memoryPanel.classList.remove("open");
});

// click-to-select orbs (raycasting from screen center / tap point)
const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener("pointerup", (e) => {
  if (panelOpen || !exploring) return;
  // ignore drags that originated on touch UI elements
  if (e.target.closest("#touch-controls")) return;

  const mouse = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const orbMeshes = orbSystem.orbs.map((o) => o.core);
  const hits = raycaster.intersectObjects(orbMeshes);
  if (hits.length > 0) {
    const hitMesh = hits[0].object;
    const orb = orbSystem.orbs.find((o) => o.core === hitMesh);
    if (orb) openMemoryPanel(orb);
  }
});

// sound toggle
soundToggle.addEventListener("click", () => {
  const next = !audio.enabled;
  audio.setEnabled(next);
  soundToggle.textContent = next ? "♪" : "✕";
  soundToggle.style.opacity = next ? "1" : "0.5";
});

// ---------------------------------------------------------------
// Final sequence orchestration
// ---------------------------------------------------------------
function startFinalSequence() {
  if (coreSequenceStarted) return;
  coreSequenceStarted = true;
  exploring = false;

  hud.classList.remove("visible");
  hintBar.style.opacity = "0";
  audio.switchTo("finalTrack");

  // draw all orbs + constellation photos toward the core first
  const drawDuration = 2.2;
  orbSystem.orbs.forEach((orb) => {
    gsap.to(orb.group.position, {
      x: 0, y: 0, z: 0,
      duration: drawDuration,
      ease: "power2.in",
    });
    gsap.to(orb.group.scale, { x: 0.05, y: 0.05, z: 0.05, duration: drawDuration, ease: "power2.in" });
  });
  constellationSystem.constellations.forEach((c) => {
    gsap.to(c.group.position, {
      x: -c.centerPos.x, y: -c.centerPos.y, z: -c.centerPos.z,
      duration: drawDuration,
      ease: "power2.in",
    });
  });

  gsap.to(core.group.scale, { x: 2.4, y: 2.4, z: 2.4, duration: drawDuration, ease: "power2.in" });

  setTimeout(() => {
    // fade core away, hand off to final particle sequence
    gsap.to(core.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.8, ease: "power3.in" });
    gsap.to(camera.position, {
      x: 0, y: 0, z: 220,
      duration: 2,
      ease: "power2.inOut",
    });
    gsap.to(camera, {
      onUpdate: () => camera.lookAt(0, 0, 0),
      duration: 2,
    });

    finalSeq.playSequence({
      onMessageShown: () => {
        finalOverlay.style.transition = "opacity 1.2s ease";
        finalOverlay.style.opacity = "1";
        gsap.to(finalMessageEl, { opacity: 1, duration: 1.4 });
      },
      onExplode: () => {
        gsap.to(finalMessageEl, { opacity: 0, duration: 0.6 });
      },
      onNameShown: () => {
        gsap.to(finalNameEl, { opacity: 1, duration: 1.4, delay: 0.3 });
        gsap.to(finalHeartTag, { opacity: 1, duration: 1.2, delay: 0.9 });
        gsap.to(finalSubEl, { opacity: 1, duration: 1.2, delay: 1.3 });
        gsap.to(replayBtn, { opacity: 1, duration: 1, delay: 1.8, onComplete: () => {
          replayBtn.style.pointerEvents = "auto";
        }});
      },
    });
  }, drawDuration * 1000 + 200);
}

replayBtn.addEventListener("click", () => window.location.reload());

// ---------------------------------------------------------------
// Terminal intro -> release player into the galaxy
// ---------------------------------------------------------------
let starsRevealProgress = 0;
runTerminalIntro({
  onStarsBegin: () => {
    gsap.to({ v: 0 }, {
      v: 1,
      duration: 2,
      onUpdate: function () { starsRevealProgress = this.targets()[0].v; },
    });
  },
  onComplete: () => {
    exploring = true;
    hud.classList.add("visible");
    audio.switchTo("ambientTrack");
    gsap.fromTo(camera.position,
      { z: CONFIG.galaxy.radius * 0.9 },
      { z: CONFIG.galaxy.radius * 0.45, duration: 2.4, ease: "power2.out" }
    );
  },
});

// ---------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (exploring && !panelOpen) {
    controls.update(delta);
  }

  starfield.update(t);
  dust.update();
  orbSystem.update(t, camera.position);
  constellationSystem.update(t, camera.position);

  if (!coreSequenceStarted) {
    const coreInfo = core.update(t, camera.position);
    finalSeq.update();

    if (coreInfo.distance < CONFIG.galaxy.coreSize * 1.8) {
      corePrompt.classList.add("show");
      if (coreInfo.distance < CONFIG.galaxy.coreSize * 0.9) {
        startFinalSequence();
      }
    } else {
      corePrompt.classList.remove("show");
    }

    // crossfade ambient -> core track based on proximity
    if (coreInfo.proximity > 0.4) {
      audio.switchTo("coreTrack");
    } else if (exploring) {
      audio.switchTo("ambientTrack");
    }
  }

  composer.render();
}

animate();
