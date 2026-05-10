// script.js

window.isXRActive = false;

// ==========================================
// CONTROLADOR DE FIN DE JUEGO
// ==========================================
window.endGame = function(isVictory) {
  // Bloquear al jugador (y al mímico)
  window.isMovementBlocked = true;
  
  if (window.isXRActive) {
    // Modo VR
    if (isVictory) {
      document.getElementById('vr-victory-screen').setAttribute('visible', 'true');
    } else {
      document.getElementById('vr-death-screen').setAttribute('visible', 'true');
    }
  } else {
    // Modo PC
    document.exitPointerLock();
    if (isVictory) {
      document.getElementById('victory-screen').style.display = 'flex';
    } else {
      document.getElementById('death-screen').style.display = 'flex';
    }
  }
  
  // Reiniciar nivel a los 4 segundos
  setTimeout(() => {
    location.reload();
  }, 4000);
};

// ==========================================
// 0. PRECARGA DE IMÁGENES
// ==========================================
const imageCache = {};
const conceptImages = [
  'concepts/1.png','concepts/2.png','concepts/3.png','concepts/4.png',
  'concepts/5.png','concepts/6.png','concepts/7.png','concepts/8.png',
  'concepts/9.jpg','concepts/10.png','concepts/11.png'
];

conceptImages.forEach(src => {
  const img = new Image();
  img.onload = () => { imageCache[src] = img.src; };
  img.onerror = () => console.warn('No se pudo precargar: ' + src);
  img.src = src;
});

function resolveImageSrc(src) {
  return src || null;
}

// ==========================================
// COMPONENTE: BRILLO DEL SOMBRERO
// ==========================================
AFRAME.registerComponent('brillo-sombrero', {
  schema: {
    intensidad: { type: 'number', default: 0.3 } 
  },
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;

      mesh.traverse((node) => {
        if (node.isMesh && node.name.toLowerCase().includes('sombrero')) {
          if (node.material.map) {
            node.material.emissiveMap = node.material.map;
            node.material.emissive.setHex(0xffffff); 
          } else {
            node.material.emissive.copy(node.material.color);
          }
          node.material.emissiveIntensity = this.data.intensidad;
        }
      });
    });
  }
});

// ==========================================
// COMPONENTES VR: MOVIMIENTO Y ROTACIÓN
// ==========================================
AFRAME.registerComponent('vr-joystick-movement', {
  init: function () {
    this.rig = document.querySelector('#rig');
    
    this.el.addEventListener('thumbstickmoved', (e) => {
      const pm = this.rig.components['physics-movement'];
      if (pm) {
        pm.thumbstickX = Math.abs(e.detail.x) > 0.15 ? e.detail.x : 0;
        pm.thumbstickZ = Math.abs(e.detail.y) > 0.15 ? e.detail.y : 0;
      }
    });

    this.el.addEventListener('axismove', (e) => {
      if (e.detail.axis.length < 4) return;
      const pm = this.rig.components['physics-movement'];
      if (pm) {
        let x = e.detail.axis[2];
        let y = e.detail.axis[3];
        pm.thumbstickX = Math.abs(x) > 0.15 ? x : 0;
        pm.thumbstickZ = Math.abs(y) > 0.15 ? y : 0;
      }
    });
  }
});

AFRAME.registerComponent('vr-snap-turn', {
  schema: { angle: { type: 'number', default: 45 } },
  init: function () {
    this.rig = document.querySelector('#rig');
    this.isTurning = false;
    
    this.el.addEventListener('thumbstickmoved', (e) => {
      if (window.isMovementBlocked) return;
      
      let x = e.detail.x;
      if (Math.abs(x) < 0.5) { this.isTurning = false; return; }

      if (!this.isTurning) {
        let angleRad = THREE.MathUtils.degToRad(this.data.angle);
        let direction = x > 0 ? -angleRad : angleRad; 
        this.rig.object3D.rotation.y += direction;
        
        if (this.rig.body) {
          this.rig.body.quaternion.copy(this.rig.object3D.quaternion);
        }
        this.isTurning = true;
      }
    });
  }
});

// ==========================================
// 1. MOVIMIENTO DEL JUGADOR
// ==========================================
AFRAME.registerComponent('physics-movement', {
  schema: { force: { type: 'number', default: 1200 } },
  init: function () {
    this.keys = { w: false, a: false, s: false, d: false };
    this.touchX = 0; this.touchZ = 0;
    this.thumbstickX = 0; this.thumbstickZ = 0; 

    this.el.addEventListener('body-loaded', () => {
      this.el.body.fixedRotation = true;
      this.el.body.updateMassProperties();
    });

    window.addEventListener('keydown', (e) => {
      if(this.keys.hasOwnProperty(e.key.toLowerCase())) this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
      if(this.keys.hasOwnProperty(e.key.toLowerCase())) this.keys[e.key.toLowerCase()] = false;
    });

    const setupBtn = (id, xDir, zDir) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const startMove = (e) => { e.stopPropagation(); e.preventDefault(); this.touchX = xDir; this.touchZ = zDir; };
      const stopMove = (e) => { e.stopPropagation(); e.preventDefault(); this.touchX = 0; this.touchZ = 0; };
      btn.addEventListener('mousedown', startMove); btn.addEventListener('mouseup', stopMove);
      btn.addEventListener('mouseleave', stopMove);
      btn.addEventListener('touchstart', startMove, {passive: false}); btn.addEventListener('touchend', stopMove, {passive: false});
    };
    setupBtn('btn-up', 0, -1); setupBtn('btn-down', 0, 1);
    setupBtn('btn-left', -1, 0); setupBtn('btn-right', 1, 0);
  },
  
  tick: function () {
    if (!this.el.body) return; 

    if (window.isMovementBlocked) {
      this.el.body.velocity.set(0, 0, 0);
      return; 
    }

    let moveX = this.touchX + this.thumbstickX; 
    let moveZ = this.touchZ + this.thumbstickZ;
    
    if (this.keys.w) moveZ -= 1; 
    if (this.keys.s) moveZ += 1;
    if (this.keys.a) moveX -= 1; 
    if (this.keys.d) moveX += 1;
    
    if (moveX !== 0 || moveZ !== 0) {
       const length = Math.sqrt(moveX*moveX + moveZ*moveZ);
       if(length > 1) { 
           moveX /= length; 
           moveZ /= length; 
       }
    } else {
       return; 
    }

    const cam = document.querySelector('#player-camera').getObject3D('camera');
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const dir = new THREE.Vector3()
      .addScaledVector(forward, -moveZ)
      .addScaledVector(right, moveX)
      .normalize();

    this.el.body.force.x += dir.x * this.data.force;
    this.el.body.force.z += dir.z * this.data.force;
  }
});

// ==========================================
// 2. IA DEL ENEMIGO
// ==========================================
AFRAME.registerComponent('stalker-ai', {
  schema: { force: {type: 'number', default: 1800} },
  init: function () {
    this.cameraEl = document.querySelector('#player-camera');
    this.playerBody = document.querySelector('#rig');
    this.raycaster = new THREE.Raycaster();
    this.isGameOver = false;
    this.teleportTimer = 0; 
    this.stunTimer = 0; 

    this.initialGracePeriod = true;
    this.graceTimer = 0;

    this.safeSpawns = [
      {x: 22, z: 22}, {x: -22, z: 22}, {x: 22, z: -22}, {x: -22, z: -22},
      {x: 0, z: 0}, {x: 14, z: 0}, {x: -14, z: 0}, {x: 0, z: 8}, {x: 0, z: -8},
      {x: -20, z: 15}, {x: 20, z: 15}, {x: -20, z: -15}, {x: 20, z: -15}
    ];

    this.el.addEventListener('body-loaded', () => {
      this.el.body.fixedRotation = true;
      this.el.body.updateMassProperties();
    });
  },

  checkVisibility: function(camPos, enemyPos, cameraDirection) {
    const directionToEnemy = new THREE.Vector3().subVectors(enemyPos, camPos).normalize();
    const dotProduct = cameraDirection.dot(directionToEnemy);
    if (dotProduct < 0.3) return false;

    this.raycaster.set(camPos, directionToEnemy);
    const scene = this.el.sceneEl.object3D;
    const intersects = this.raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      let firstObstacle = null;
      for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        if (obj.el && this.playerBody.contains(obj.el)) continue;
        firstObstacle = intersects[i];
        break;
      }
      if (firstObstacle && (firstObstacle.object.el === this.el || this.el.contains(firstObstacle.object.el))) {
        return true;
      }
    }
    return false;
  },

  tick: function (time, timeDelta) {
    if (!this.el.body || !this.playerBody.body || !timeDelta || this.isGameOver) return;

    if (window.isMovementBlocked) {
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    if (this.initialGracePeriod) {
      this.graceTimer += timeDelta;
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);

      if (this.graceTimer > 10000) {
        this.initialGracePeriod = false;
        const randomSpawn = this.safeSpawns[Math.floor(Math.random() * this.safeSpawns.length)];
        this.el.body.position.set(randomSpawn.x, this.el.body.position.y, randomSpawn.z);
        this.el.body.velocity.set(0, 0, 0);
        this.teleportTimer = 0; 
      }
      return; 
    }

    const camera3D = this.cameraEl.getObject3D('camera');
    const camPos = new THREE.Vector3();
    camera3D.getWorldPosition(camPos);
    const enemyPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(enemyPos);
    const cameraDirection = new THREE.Vector3();
    camera3D.getWorldDirection(cameraDirection);

    const loVesRealmente = this.checkVisibility(camPos, enemyPos, cameraDirection);

    if (this.stunTimer > 0) {
      this.stunTimer -= timeDelta;
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    this.teleportTimer += timeDelta;
    if (this.teleportTimer > 15000 && !loVesRealmente) {
      this.teleportTimer = 0; 
      this.stunTimer = 2000; 

      const behindDir = cameraDirection.clone().multiplyScalar(-1);
      behindDir.y = 0; behindDir.normalize();
      
      this.raycaster.set(camPos, behindDir);
      const scene = this.el.sceneEl.object3D;
      const intersects = this.raycaster.intersectObjects(scene.children, true);
      
      let distanciaTeleport = 6.0; 
      for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        if (obj.el && (this.playerBody.contains(obj.el) || obj.el === this.el)) continue;
        if (intersects[i].distance < 7.0) { distanciaTeleport = Math.max(1.5, intersects[i].distance - 1.5); }
        break; 
      }
      
      const tpPos = camPos.clone().add(behindDir.multiplyScalar(distanciaTeleport));
      tpPos.x = Math.max(-23, Math.min(23, tpPos.x));
      tpPos.z = Math.max(-23, Math.min(23, tpPos.z));
      
      this.el.body.position.set(tpPos.x, this.el.body.position.y, tpPos.z);
      this.el.body.velocity.set(0,0,0);
      return; 
    }

    if (loVesRealmente) {
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
    } else {
      const moveDir = new THREE.Vector3().subVectors(camPos, enemyPos);
      moveDir.y = 0; moveDir.normalize();
      
      this.el.body.wakeUp(); 
      this.el.body.force.x += moveDir.x * this.data.force;
      this.el.body.force.z += moveDir.z * this.data.force;
    }

    const distFinal = Math.sqrt(Math.pow(camPos.x - enemyPos.x, 2) + Math.pow(camPos.z - enemyPos.z, 2));
    if (distFinal < 1.2 && !this.isGameOver) {
      this.isGameOver = true;
      window.endGame(false);
    }
  }
});

// ==========================================
// 3. RECOLECTAR ACTIVOS
// ==========================================
let lootCollected = 0;
const targetLoot = 5;
AFRAME.registerComponent('recolectable', {
  init: function () {
    // --- EFECTO RESALTADO ---
    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('material', 'emissive', '#ffffff');
      this.el.setAttribute('material', 'emissiveIntensity', 0.5);
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.setAttribute('material', 'emissive', '#000000');
      this.el.setAttribute('material', 'emissiveIntensity', 0);
    });
    // ------------------------

    this.el.addEventListener('click', () => {
      if (window.isMovementBlocked && document.getElementById('victory-screen').style.display !== 'none') return;

      lootCollected++;
      document.querySelector('#loot-count').innerText = lootCollected;
      
      const vrLoot = document.querySelector('#vr-loot-count');
      if (vrLoot) vrLoot.setAttribute('value', 'RASTROS: ' + lootCollected + '/5');

      this.el.parentNode.removeChild(this.el); 
      
      if (lootCollected >= targetLoot) {
        window.endGame(true);
      }
    });
  }
});

// ==========================================
// 4. LÓGICA DE NOTAS (INSPECTOR DE IMÁGENES Y TEXTURAS)
// ==========================================
AFRAME.registerComponent('nota-interactiva', {
  schema: { img: {type: 'string'} },
  init: function () {
    const src = resolveImageSrc(this.data.img);

    // --- EFECTO RESALTADO ---
    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('material', 'emissive', '#00ffcc');
      this.el.setAttribute('material', 'emissiveIntensity', 0.25);
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.setAttribute('material', 'emissive', '#000000');
      this.el.setAttribute('material', 'emissiveIntensity', 0);
    });
    // ------------------------

    if (src) {
      // 1. Aplicamos la textura a la caja
      this.el.setAttribute('material', `src: ${src}; color: #dcd3b6; roughness: 1; metalness: 0`);
      
      // 2. Corregir el Aspect Ratio automáticamente
      const imgObj = new Image();
      imgObj.onload = () => {
        const imgRatio = imgObj.width / imgObj.height;
        
        // Obtenemos las dimensiones iniciales que pusiste en el HTML
        const origW = parseFloat(this.el.getAttribute('width'));
        const origH = parseFloat(this.el.getAttribute('height'));
        const origD = parseFloat(this.el.getAttribute('depth'));

        // Averiguamos si es una nota en la pared (profundidad mínima) o en el suelo (altura mínima)
        const isWallNote = origD <= origW && origD <= origH; 
        const isFloorNote = origH <= origW && origH <= origD; 

        if (isWallNote) {
          const boxRatio = origW / origH;
          if (imgRatio > boxRatio) {
            this.el.setAttribute('height', origW / imgRatio);
          } else {
            this.el.setAttribute('width', origH * imgRatio);
          }
        } else if (isFloorNote) {
          const boxRatio = origW / origD;
          if (imgRatio > boxRatio) {
            this.el.setAttribute('depth', origW / imgRatio);
          } else {
            this.el.setAttribute('width', origD * imgRatio);
          }
        }
      };
      imgObj.src = src; 
    }

    // 3. Lógica del click para inspeccionar
    this.el.addEventListener('click', () => {
      if (!src) return;

      if (window.isXRActive) {
        const vrInspectorContainer = document.getElementById('vr-inspector-container');
        const vrInspector = document.getElementById('vr-inspector');
        
        vrInspector.setAttribute('src', src);
        vrInspectorContainer.setAttribute('visible', 'true');
        
        setTimeout(() => { window.isMovementBlocked = true; }, 100);
      } else {
        document.exitPointerLock();
        setTimeout(() => {
          const inspector = document.getElementById('image-inspector');
          const imgEl = document.getElementById('inspector-img');
          imgEl.src = src;
          inspector.style.display = 'flex';
          window.isMovementBlocked = true;
        }, 32);
      }
    });
  }
});

// ==========================================
// 5. LÓGICA DE INICIO Y BATERÍA
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
  btnCloseInspector.addEventListener('click', () => {
    document.getElementById('image-inspector').style.display = 'none';
    document.querySelector('a-scene').canvas.requestPointerLock();
    window.isMovementBlocked = false;
  });

  let linternaEncendida = false;
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

  btnStart.addEventListener('click', () => {
    startScreen.style.display = 'none';
    uiContainer.style.display = 'block';
    btnLinterna.style.display = 'block';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      dpad.style.display = 'block';
    }
    document.querySelector('a-scene').canvas.click();
  });

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
      linternaEncendida = false;
    } else {
      if (bateria > 0) {
        linternaEncendida = !linternaEncendida;
      }
    }
    
    const isVR = window.isXRActive;
    const linternaPC = document.querySelector('#linterna-pc');
    const linternaVR = document.querySelector('#linterna-vr');

    if (linternaPC) linternaPC.setAttribute('light', 'intensity', (linternaEncendida && !isVR) ? 1.5 : 0);
    if (linternaVR) linternaVR.setAttribute('light', 'intensity', (linternaEncendida && isVR) ? 1.5 : 0);
    
    btnLinterna.style.background = linternaEncendida ? "#00ffcc" : "rgba(0, 15, 10, 0.85)";
    btnLinterna.style.color = linternaEncendida ? "#000" : "#00ffcc";
  }

  btnLinterna.addEventListener('click', () => toggleLinterna(false));
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

    if (linternaEncendida) {
      bateria -= 1.5; 
      if (bateria <= 0) { bateria = 0; toggleLinterna(true); }
    } else {
      bateria += 1.0; 
      if (bateria > 100) bateria = 100;
    }
    
    batteryLevel.innerText = Math.floor(bateria) + "%";
    batteryLevel.style.color = bateria <= 20 ? "#ff3333" : "#00ffcc";

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