// ============================================================
// CONTROLS — free-fly camera movement (desktop + mobile)
// ============================================================
import * as THREE from "three";
import { CONFIG } from "./config.js";

export function createControls(camera, domElement) {
  const state = {
    forward: false, backward: false, left: false, right: false, up: false, down: false,
    boost: false,
    yaw: 0, pitch: 0,
    pointerLocked: false,
    touchActive: false,
  };

  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();

  // initial orientation
  state.yaw = 0;
  state.pitch = -0.05;

  // ---------------- Desktop keyboard ----------------
  function onKeyDown(e) {
    switch (e.code) {
      case "KeyW": case "ArrowUp": state.forward = true; break;
      case "KeyS": case "ArrowDown": state.backward = true; break;
      case "KeyA": case "ArrowLeft": state.left = true; break;
      case "KeyD": case "ArrowRight": state.right = true; break;
      case "Space": state.up = true; break;
      case "KeyC": case "ControlLeft": state.down = true; break;
      case "ShiftLeft": case "ShiftRight": state.boost = true; break;
    }
  }
  function onKeyUp(e) {
    switch (e.code) {
      case "KeyW": case "ArrowUp": state.forward = false; break;
      case "KeyS": case "ArrowDown": state.backward = false; break;
      case "KeyA": case "ArrowLeft": state.left = false; break;
      case "KeyD": case "ArrowRight": state.right = false; break;
      case "Space": state.up = false; break;
      case "KeyC": case "ControlLeft": state.down = false; break;
      case "ShiftLeft": case "ShiftRight": state.boost = false; break;
    }
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---------------- Mouse look (pointer lock) ----------------
  domElement.addEventListener("click", () => {
    if (!state.touchActive && document.pointerLockElement !== domElement) {
      domElement.requestPointerLock?.();
    }
  });
  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === domElement;
  });
  document.addEventListener("mousemove", (e) => {
    if (!state.pointerLocked) return;
    state.yaw -= e.movementX * CONFIG.movement.lookSensitivity * 60;
    state.pitch -= e.movementY * CONFIG.movement.lookSensitivity * 60;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  });

  // scroll = subtle zoom via FOV change (kept gentle)
  domElement.addEventListener("wheel", (e) => {
    camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.02, 35, 85);
    camera.updateProjectionMatrix();
  }, { passive: true });

  // ---------------- Mobile touch controls ----------------
  const joystickZone = document.getElementById("joystick-zone");
  const joystickKnob = document.getElementById("joystick-knob");
  const vlookZone = document.getElementById("vlook-zone");
  const boostBtn = document.getElementById("boost-btn");

  let joystickTouchId = null;
  let joystickOrigin = { x: 0, y: 0 };
  let joystickVec = { x: 0, y: 0 };

  let lookTouchId = null;
  let lastLook = { x: 0, y: 0 };

  function isMobile() {
    return window.matchMedia("(max-width: 760px)").matches || "ontouchstart" in window;
  }

  if (joystickZone) {
    joystickZone.addEventListener("touchstart", (e) => {
      state.touchActive = true;
      const t = e.changedTouches[0];
      joystickTouchId = t.identifier;
      const rect = joystickZone.getBoundingClientRect();
      joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      e.preventDefault();
    }, { passive: false });

    joystickZone.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joystickTouchId) {
          let dx = t.clientX - joystickOrigin.x;
          let dy = t.clientY - joystickOrigin.y;
          const max = 40;
          const len = Math.min(Math.sqrt(dx * dx + dy * dy), max);
          const ang = Math.atan2(dy, dx);
          dx = Math.cos(ang) * len;
          dy = Math.sin(ang) * len;
          joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
          joystickVec = { x: dx / max, y: dy / max };
        }
      }
      e.preventDefault();
    }, { passive: false });

    function resetJoystick(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === joystickTouchId) {
          joystickTouchId = null;
          joystickVec = { x: 0, y: 0 };
          joystickKnob.style.transform = `translate(0px, 0px)`;
        }
      }
    }
    joystickZone.addEventListener("touchend", resetJoystick);
    joystickZone.addEventListener("touchcancel", resetJoystick);
  }

  if (vlookZone) {
    vlookZone.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      lookTouchId = t.identifier;
      lastLook = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    vlookZone.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) {
          const dx = t.clientX - lastLook.x;
          const dy = t.clientY - lastLook.y;
          state.yaw -= dx * 0.0035 * 60 * CONFIG.movement.lookSensitivity * 10;
          state.pitch -= dy * 0.0035 * 60 * CONFIG.movement.lookSensitivity * 10;
          state.pitch = THREE.MathUtils.clamp(state.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
          lastLook = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });

    vlookZone.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    });
  }

  if (boostBtn) {
    boostBtn.addEventListener("touchstart", (e) => { state.boost = true; e.preventDefault(); }, { passive: false });
    boostBtn.addEventListener("touchend", () => { state.boost = false; });
  }

  function update(delta) {
    const euler = new THREE.Euler(state.pitch, state.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    direction.set(0, 0, 0);

    if (state.touchActive) {
      direction.z = joystickVec.y;
      direction.x = joystickVec.x;
    } else {
      if (state.forward) direction.z -= 1;
      if (state.backward) direction.z += 1;
      if (state.left) direction.x -= 1;
      if (state.right) direction.x += 1;
      if (state.up) direction.y += 1;
      if (state.down) direction.y -= 1;
    }

    if (direction.lengthSq() > 0) direction.normalize();

    const speed = CONFIG.movement.speed * (state.boost ? CONFIG.movement.boostMultiplier : 1);
    const moveVec = direction.clone().applyQuaternion(camera.quaternion);
    velocity.lerp(moveVec.multiplyScalar(speed), 0.18);

    camera.position.addScaledVector(velocity, delta);
  }

  return { state, update };
}
