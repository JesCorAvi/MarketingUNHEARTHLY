// script.js

// ==========================================
// 1. MOVIMIENTO DEL JUGADOR
// ==========================================
AFRAME.registerComponent('physics-movement', {
  schema: { force: { type: 'number', default: 1200 } },
  init: function () {
    this.keys = { w: false, a: false, s: false, d: false };
    this.touchX = 0; this.touchZ = 0;

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
    let moveX = this.touchX; let moveZ = this.touchZ;
    if (this.keys.w) moveZ -= 1; if (this.keys.s) moveZ += 1;
    if (this.keys.a) moveX -= 1; if (this.keys.d) moveX += 1;
    if (moveX === 0 && moveZ === 0) return;

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
// 2. IA DEL ENEMIGO (Mímica Pura, sin HUD)
// ==========================================
AFRAME.registerComponent('stalker-ai', {
  schema: { force: {type: 'number', default: 900} },
  init: function () {
    this.cameraEl = document.querySelector('#player-camera');
    this.playerBody = document.querySelector('#rig');
    this.raycaster = new THREE.Raycaster();
    this.isGameOver = false;
    this.teleportTimer = 0; 
    this.stunTimer = 0; 

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
        if (obj.el && (obj.el.id === 'rig' || obj.el.id === 'player-camera')) continue;
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

    const camera3D = this.cameraEl.getObject3D('camera');
    const camPos = new THREE.Vector3();
    camera3D.getWorldPosition(camPos);

    const enemyPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(enemyPos);

    const cameraDirection = new THREE.Vector3();
    camera3D.getWorldDirection(cameraDirection);

    const loVesRealmente = this.checkVisibility(camPos, enemyPos, cameraDirection);

    // --- LÓGICA DE STUN ---
    if (this.stunTimer > 0) {
      this.stunTimer -= timeDelta;
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    // --- TELETRANSPORTE SEGURO E INVISIBLE ---
    this.teleportTimer += timeDelta;
    if (this.teleportTimer > 15000 && !loVesRealmente) {
      this.teleportTimer = 0; 
      this.stunTimer = 2000; 

      const behindDir = cameraDirection.clone().multiplyScalar(-1);
      behindDir.y = 0; behindDir.normalize();
      
      // NUEVO: Comprobar qué obstáculos hay detrás del jugador
      this.raycaster.set(camPos, behindDir);
      const scene = this.el.sceneEl.object3D;
      const intersects = this.raycaster.intersectObjects(scene.children, true);
      
      let distanciaTeleport = 6.0; // Distancia ideal
      
      for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        // Ignoramos el modelo del jugador o el propio enemigo
        if (obj.el && (obj.el.id === 'rig' || obj.el.id === 'player-camera' || obj.el === this.el)) continue;
        
        // Si hay un obstáculo a menos de 7 unidades, reducimos la distancia de teletransporte
        if (intersects[i].distance < 7.0) {
            // Nos aseguramos de dejarlo al menos a 1.5 unidades de la cámara, y 1.5 separado de la pared
            distanciaTeleport = Math.max(1.5, intersects[i].distance - 1.5); 
        }
        break; // Tomamos solo el primer obstáculo sólido
      }
      
      // Aplicamos la distancia calculada en lugar de los 6 metros fijos
      const tpPos = camPos.clone().add(behindDir.multiplyScalar(distanciaTeleport));
      
      // Mantenemos los límites del mapa originales
      tpPos.x = Math.max(-23, Math.min(23, tpPos.x));
      tpPos.z = Math.max(-23, Math.min(23, tpPos.z));
      
      this.el.body.position.set(tpPos.x, this.el.body.position.y, tpPos.z);
      this.el.body.velocity.set(0,0,0);
      return; 
    }

    // --- MOVIMIENTO NORMAL ---
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

    // GAME OVER
    const distFinal = Math.sqrt(Math.pow(camPos.x - enemyPos.x, 2) + Math.pow(camPos.z - enemyPos.z, 2));
    if (distFinal < 1.2) {
      this.isGameOver = true;
      document.exitPointerLock(); 
      setTimeout(() => {
        alert("EL MÍMICO TE HA ATRAPADO. PROTOCOLO FALLIDO.");
        location.reload(); 
      }, 50);
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
    this.el.addEventListener('click', () => {
      lootCollected++;
      document.querySelector('#loot-count').innerText = lootCollected;
      this.el.parentNode.removeChild(this.el); 
      if (lootCollected >= targetLoot) {
        setTimeout(() => alert("EXTRACCIÓN APROBADA. HAS SOBREVIVIDO."), 100);
      }
    });
  }
});

// ==========================================
// 4. LÓGICA DE INICIO Y BATERÍA
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.querySelector('#btn-start');
  const startScreen = document.querySelector('#start-screen');
  const uiContainer = document.querySelector('#ui-container');
  const btnLinterna = document.querySelector('#btn-linterna');
  const dpad = document.querySelector('#dpad');
  const linterna = document.querySelector('#linterna');
  const batteryLevel = document.querySelector('#battery-level'); // Interfaz de la Batería
  
  let linternaEncendida = false;
  let bateria = 100; // Iniciamos con el 100%

  btnStart.addEventListener('click', () => {
    startScreen.style.display = 'none';
    uiContainer.style.display = 'block';
    btnLinterna.style.display = 'block';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      dpad.style.display = 'block';
    }
    document.querySelector('a-scene').canvas.click();
  });

  // Modificamos la función para forzar el apagado si se queda sin batería
  function toggleLinterna(fuerzaApagado = false) {
    if (fuerzaApagado) {
      linternaEncendida = false;
    } else {
      if (bateria > 0) {
        linternaEncendida = !linternaEncendida;
      }
    }
    linterna.setAttribute('light', 'intensity', linternaEncendida ? 1.5 : 0);
    btnLinterna.style.background = linternaEncendida ? "#00ffcc" : "rgba(0, 15, 10, 0.85)";
    btnLinterna.style.color = linternaEncendida ? "#000" : "#00ffcc";
  }

  btnLinterna.addEventListener('click', () => toggleLinterna(false));
  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'e') toggleLinterna(false);
  });

  // Bucle de gestión de la batería (Se actualiza cada 200 ms)
  setInterval(() => {
    if (linternaEncendida) {
      bateria -= 1.5; // La batería se agota al estar encendida
      if (bateria <= 0) {
        bateria = 0;
        toggleLinterna(true); // Se apaga de golpe al llegar a 0
      }
    } else {
      bateria += 1.0; // La batería se recarga sola al estar apagada
      if (bateria > 100) bateria = 100;
    }

    // Actualizar el texto visual
    batteryLevel.innerText = Math.floor(bateria) + "%";
    
    // Cambiar color a rojo si está por debajo del 20%
    if (bateria <= 20) {
      batteryLevel.style.color = "#ff3333";
    } else {
      batteryLevel.style.color = "#00ffcc";
    }
  }, 200);
});