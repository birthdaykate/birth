// ============================================================
// AUDIO MANAGER — handles ambient/core/final music with crossfade
// Works fully gracefully if no tracks are configured.
// ============================================================
import { CONFIG } from "./config.js";

function resolveSrc(name) {
  if (!name) return null;
  if (/^https?:\/\//i.test(name)) return name;
  return `assets/audio/${name}`;
}

export function createAudioManager() {
  const tracks = {};
  let enabled = true;
  let currentKey = null;

  ["ambientTrack", "coreTrack", "finalTrack"].forEach((key) => {
    const src = resolveSrc(CONFIG.music[key]);
    if (src) {
      const audio = new Audio(src);
      audio.loop = key !== "finalTrack";
      audio.volume = 0;
      audio.preload = "auto";
      tracks[key] = audio;
    }
  });

  function fadeTo(audio, target, duration = 1200) {
    if (!audio) return;
    const start = audio.volume;
    const startTime = performance.now();
    function step() {
      const t = Math.min((performance.now() - startTime) / duration, 1);
      audio.volume = start + (target - start) * t;
      if (t < 1) requestAnimationFrame(step);
    }
    step();
  }

  function play(key) {
    if (!enabled) return;
    const audio = tracks[key];
    if (!audio) { currentKey = key; return; }
    audio.play().catch(() => {});
    fadeTo(audio, CONFIG.music.volume);
  }

  function switchTo(key) {
    if (currentKey === key) return;
    const prevAudio = tracks[currentKey];
    if (prevAudio) fadeTo(prevAudio, 0, 1000);
    currentKey = key;
    if (enabled) play(key);
  }

  function setEnabled(value) {
    enabled = value;
    if (!enabled) {
      Object.values(tracks).forEach((a) => fadeTo(a, 0, 400));
    } else if (currentKey) {
      play(currentKey);
    }
  }

  function hasAnyTracks() {
    return Object.keys(tracks).length > 0;
  }

  return { switchTo, setEnabled, hasAnyTracks, get enabled() { return enabled; } };
}
