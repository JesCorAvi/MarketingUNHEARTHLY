// ==========================================
// CONTROLES MÓVIL: JOYSTICK + CÁMARA TÁCTIL
// ==========================================
function initMobileControls() {
  if (!window.isMobile) return;

  const camera = document.querySelector('#player-camera');
  const rig    = document.querySelector('#rig');
  const pm = () => rig && rig.components && rig.components['physics-movement'];

  let yawDeg   = 0;
  let pitchDeg = 0;

  const sceneEl = document.querySelector('a-scene');

  function removeLookControls() {
    if (!camera) return;
    try { camera.removeAttribute('look-controls'); } catch(e) {}
    if (sceneEl && sceneEl.behaviors) {
      ['tick','tock'].forEach(function(phase) {
        var arr = sceneEl.behaviors[phase];
        if (!Array.isArray(arr)) return;
        for (var i = arr.length - 1; i >= 0; i--) {
          var b = arr[i];
          if (b && b.el === camera) { arr.splice(i, 1); }
        }
      });
    }
    if (camera.object3D) camera.object3D.rotation.order = 'YXZ';
  }
  
  if (sceneEl && sceneEl.hasLoaded) {
    removeLookControls();
  } else if (sceneEl) {
    sceneEl.addEventListener('loaded', removeLookControls, { once: true });
  }

  function applyRotation() {
    if (!window.isXRActive && camera && camera.object3D) {
      camera.object3D.rotation.order = 'YXZ';
      camera.object3D.rotation.y = THREE.MathUtils.degToRad(yawDeg);
      camera.object3D.rotation.x = THREE.MathUtils.degToRad(pitchDeg);
    }
    requestAnimationFrame(applyRotation);
  }
  requestAnimationFrame(applyRotation);

  // ---- JOYSTICK VIRTUAL ----
  const joystickBase = document.getElementById('joystick-base');
  const joystickKnob = document.getElementById('joystick-knob');
  if (!joystickBase || !joystickKnob) return;

  const JOYSTICK_RADIUS = 55;
  let joystickTouchId = null;
  let joystickOriginX = 0;
  let joystickOriginY = 0;

  function resetJoystick() {
    joystickKnob.style.transform = 'translate(-50%, -50%)';
    joystickTouchId = null;
    const p = pm();
    if (p) { p.joystickX = 0; p.joystickZ = 0; }
  }

  joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (joystickTouchId !== null) return;
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    const rect = joystickBase.getBoundingClientRect();
    joystickOriginX = rect.left + rect.width / 2;
    joystickOriginY = rect.top + rect.height / 2;
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (joystickTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== joystickTouchId) continue;
      e.preventDefault();

      let dx = t.clientX - joystickOriginX;
      let dy = t.clientY - joystickOriginY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > JOYSTICK_RADIUS) {
        dx = (dx / dist) * JOYSTICK_RADIUS;
        dy = (dy / dist) * JOYSTICK_RADIUS;
      }

      joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      const p = pm();
      if (p) {
        p.joystickX = dx / JOYSTICK_RADIUS;
        p.joystickZ = dy / JOYSTICK_RADIUS;
      }
      window.hasPlayerMoved = true;
      break;
    }
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) { resetJoystick(); break; }
    }
  });
  document.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) { resetJoystick(); break; }
    }
  });

  // ---- ZONA DE CÁMARA ----
  const lookZone = document.getElementById('look-zone');
  if (!lookZone) return;

  const SENS_X = 0.30;
  const SENS_Y = 0.30;

  let lookTouchId = null;
  let lookLastX   = 0;
  let lookLastY   = 0;
  let tapStartX   = 0;
  let tapStartY   = 0;

  const UI_SELECTORS = '#btn-linterna, #btn-close-inspector, #victory-screen, #death-screen';

  lookZone.addEventListener('touchstart', (e) => {
    const t0 = e.changedTouches[0];
    const topEl = document.elementFromPoint(t0.clientX, t0.clientY);
    if (topEl && topEl.closest(UI_SELECTORS)) return;

    e.preventDefault();
    e.stopPropagation();
    if (lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lookLastX   = t.clientX;
    lookLastY   = t.clientY;
    tapStartX   = t.clientX;
    tapStartY   = t.clientY;
    window.hasPlayerMoved = true;
  }, { passive: false });

  lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== lookTouchId) continue;

      const dx = t.clientX - lookLastX;
      const dy = t.clientY - lookLastY;
      lookLastX = t.clientX;
      lookLastY = t.clientY;

      yawDeg   -= dx * SENS_X;
      pitchDeg -= dy * SENS_Y;
      pitchDeg  = Math.max(-85, Math.min(85, pitchDeg));

      window.hasPlayerMoved = true;
      break;
    }
  }, { passive: false });

  lookZone.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== lookTouchId) continue;

      const moveDist = Math.hypot(t.clientX - tapStartX, t.clientY - tapStartY);
      if (moveDist < 12 && !window.isMovementBlocked) {
        const crosshair = document.getElementById('pc-crosshair');
        if (crosshair) {
          const rc = crosshair.components && crosshair.components.raycaster;
          if (rc && rc.intersectedEls && rc.intersectedEls.length > 0) {
            rc.intersectedEls[0].emit('click');
          }
        }
      }
      lookTouchId = null;
      break;
    }
  }, { passive: false });

  lookZone.addEventListener('touchcancel', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId) { lookTouchId = null; break; }
    }
  }, { passive: false });
}