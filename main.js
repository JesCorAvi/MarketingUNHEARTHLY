// ==========================================
// LÓGICA DE INICIO Y BATERÍA
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.querySelector('#btn-start');
  const startScreen = document.querySelector('#start-screen');
  const uiContainer = document.querySelector('#ui-container');
  const btnLinterna = document.querySelector('#btn-linterna');
  const dpad = document.querySelector('#dpad');
  const batteryLevel = document.querySelector('#battery-level');
  const sceneEl = document.querySelector('a-scene');
  const vrSign = document.getElementById('vr-controls-sign');
  
  const pcCrosshair = document.getElementById('pc-crosshair');
  
  const btnCloseInspector = document.getElementById('btn-close-inspector');
  if (btnCloseInspector) {
    btnCloseInspector.addEventListener('click', () => {
      document.getElementById('image-inspector').style.display = 'none';
      if (!window.isMobile) {
        document.querySelector('a-scene').canvas.requestPointerLock();
      }
      window.isMovementBlocked = false;
    });
  }

  let bateria = 100;

  if (sceneEl) {
    sceneEl.addEventListener('enter-vr', () => { 
        window.isXRActive = true;
        if(vrSign) vrSign.setAttribute('visible', 'true'); 
        if(pcCrosshair) pcCrosshair.setAttribute('visible', 'false'); 
    });
    sceneEl.addEventListener('exit-vr', () => { 
        window.isXRActive = false;
        if(vrSign) vrSign.setAttribute('visible', 'false'); 
        if(pcCrosshair) pcCrosshair.setAttribute('visible', 'true'); 
    });
  }

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      const ambientSound = document.getElementById('snd-cueva');
      if (ambientSound) {
        ambientSound.loop = true; 
        ambientSound.volume = 0.4; 
        ambientSound.play();
      }

      startScreen.style.display = 'none';
      uiContainer.style.display = 'block';
      btnLinterna.style.display = 'block';
      
      if (window.isMobile) {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'block';
        if (dpad) dpad.style.display = 'none';
        if (typeof initMobileControls === 'function') initMobileControls();
      } else {
        document.querySelector('a-scene').canvas.click();
      }
    });
  }

  function closeVRNote() {
    if (window.isMovementBlocked && window.isXRActive) {
      const vicScreen = document.getElementById('vr-victory-screen').getAttribute('visible');
      const deathScreen = document.getElementById('vr-death-screen').getAttribute('visible');
      if (vicScreen || deathScreen) return false;

      document.getElementById('vr-inspector-container').setAttribute('visible', 'false');
      setTimeout(() => { window.isMovementBlocked = false; }, 100);
      return true; 
    }
    return false; 
  }

  function toggleLinterna(fuerzaApagado = false) {
    if (fuerzaApagado) {
      window.linternaEncendida = false;
    } else {
      if (bateria > 0) {
        window.linternaEncendida = !window.linternaEncendida;
      }
    }
    
    const isVR = window.isXRActive;
    const linternaPC = document.querySelector('#linterna-pc');
    const linternaVR = document.querySelector('#linterna-vr');

    if (linternaPC) linternaPC.setAttribute('light', 'intensity', (window.linternaEncendida && !isVR) ? 1.5 : 0);
    if (linternaVR) linternaVR.setAttribute('light', 'intensity', (window.linternaEncendida && isVR) ? 1.5 : 0);
    
    if (btnLinterna) {
      btnLinterna.style.background = window.linternaEncendida ? "#00ffcc" : "rgba(0, 15, 10, 0.85)";
      btnLinterna.style.color = window.linternaEncendida ? "#000" : "#00ffcc";
    }
  }

  if (btnLinterna) btnLinterna.addEventListener('click', () => toggleLinterna(false));
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'e') toggleLinterna(false);
  });

  const rightController = document.getElementById('right-controller');
  const leftController = document.getElementById('left-controller');

  if (rightController) {
    rightController.addEventListener('abuttondown', () => { if(!closeVRNote()) toggleLinterna(false); });
    rightController.addEventListener('bbuttondown', () => { if(!closeVRNote()) toggleLinterna(false); });
    rightController.addEventListener('triggerdown', () => { closeVRNote(); });
  }

  if (leftController) {
    leftController.addEventListener('xbuttondown', () => { if(!closeVRNote()) toggleLinterna(false); });
    leftController.addEventListener('ybuttondown', () => {
      if(!closeVRNote()) {
        const vrHud = document.getElementById('vr-wrist-hud');
        if (vrHud) {
          const isVisible = vrHud.getAttribute('visible');
          vrHud.setAttribute('visible', !isVisible);
        }
      }
    });
    leftController.addEventListener('triggerdown', () => { closeVRNote(); });
  }

  let tickCounter = 0;

  setInterval(() => {
    tickCounter++;

    if (window.linternaEncendida) {
      bateria -= 1; 
      if (bateria <= 0) { bateria = 0; toggleLinterna(true); }
    } else {
      bateria += 1; 
      if (bateria > 100) bateria = 100;
    }
    
    if (batteryLevel) {
      batteryLevel.innerText = Math.floor(bateria) + "%";
      batteryLevel.style.color = bateria <= 20 ? "#ff3333" : "#00ffcc";
    }

    const vrBat = document.querySelector('#vr-battery-level');
    if (vrBat) {
      vrBat.setAttribute('value', 'BAT: ' + Math.floor(bateria) + '%');
      vrBat.setAttribute('color', bateria <= 20 ? '#ff3333' : '#00ffcc');
    }

    if (bateria <= 20 && tickCounter % 10 === 0 && window.isXRActive) {
      if (leftController) leftController.emit('low-battery-pulse');
      if (rightController) rightController.emit('low-battery-pulse');
    }
    
  }, 200);
});