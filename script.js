// script.js

// ==========================================
// 0. PRECARGA DE IMÁGENES (FUERA DE AFRAME)
// ==========================================
const imageCache = {};
const conceptImages = [
  'concepts/1.png','concepts/2.png','concepts/3.png','concepts/4.png',
  'concepts/5.png','concepts/6.png','concepts/7.png','concepts/8.png',
  'concepts/9.jpg','concepts/10.png','concepts/11.png'
];

// Precargamos todas las imágenes con JS nativo nada más cargar el script.
// Esto fuerza al navegador a cachearlas antes de que el jugador interactúe.
conceptImages.forEach(src => {
  const img = new Image();
  img.onload = () => { imageCache[src] = img.src; };
  img.onerror = () => console.warn('No se pudo precargar: ' + src);
  img.src = src;
});

// Función auxiliar: ahora el schema ya recibe la ruta directa (ej: 'concepts/3.png')
function resolveImageSrc(src) {
  return src || null;
}

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

    // Si el movimiento está bloqueado (inspector abierto), detener al jugador y salir
    if (window.isMovementBlocked) {
      this.el.body.velocity.set(0, 0, 0);
      return; 
    }

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

    // Control de los 10 segundos de gracia iniciales
    this.initialGracePeriod = true;
    this.graceTimer = 0;

    // Puntos de spawn 100% seguros basados en la geometría de tu laberinto
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

    // Si el inspector está abierto, el Mímico se congela por completo
    if (window.isMovementBlocked) {
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    // Lógica del tiempo de gracia inicial (10 segundos)
    if (this.initialGracePeriod) {
      this.graceTimer += timeDelta;
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);

      // Cuando pasan 10 segundos
      if (this.graceTimer > 10000) {
        this.initialGracePeriod = false;
        
        // Seleccionamos un punto de spawn seguro para evitar empotramientos
        const randomSpawn = this.safeSpawns[Math.floor(Math.random() * this.safeSpawns.length)];
        
        // Teletransportar al Mímico y reiniciar sus contadores normales
        this.el.body.position.set(randomSpawn.x, this.el.body.position.y, randomSpawn.z);
        this.el.body.velocity.set(0, 0, 0);
        this.teleportTimer = 0; 
      }
      return; 
    }

    // --- LÓGICA NORMAL DESPUÉS DE LOS 10 SEGUNDOS ---

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
        if (obj.el && (obj.el.id === 'rig' || obj.el.id === 'player-camera' || obj.el === this.el)) continue;
        
        if (intersects[i].distance < 7.0) {
            distanciaTeleport = Math.max(1.5, intersects[i].distance - 1.5); 
        }
        break; 
      }
      
      const tpPos = camPos.clone().add(behindDir.multiplyScalar(distanciaTeleport));
      
      // LÍMITES CORREGIDOS (-23 a 23) PARA EL TAMAÑO REAL DEL LABERINTO
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
// 4. LÓGICA DE NOTAS (INSPECTOR DE IMÁGENES)
// ==========================================
AFRAME.registerComponent('nota-interactiva', {
  schema: { img: {type: 'string'} },
  init: function () {
    this.el.addEventListener('click', () => {
      const src = resolveImageSrc(this.data.img);
      if (!src) { console.error("No se encontró la imagen con ID: " + this.data.img); return; }

      // 1. Primero liberar el Pointer Lock — el navegador necesita procesar
      //    este evento antes de poder repintar el inspector correctamente.
      document.exitPointerLock();

      // 2. Esperamos dos frames (~32ms) para que el Pointer Lock se libere
      //    del todo y el motor de render tenga un ciclo limpio para pintar.
      setTimeout(() => {
        const inspector = document.getElementById('image-inspector');
        const imgEl = document.getElementById('inspector-img');

        imgEl.src = '';           // reset para forzar onload incluso si es la misma imagen
        imgEl.src = src;
        inspector.style.display = 'flex';
        
        // Bloquear el movimiento y al mímico mientras el inspector está visible
        window.isMovementBlocked = true;
      }, 32);
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
  const linterna = document.querySelector('#linterna');
  const batteryLevel = document.querySelector('#battery-level');
  
  // Botón para cerrar el inspector de imágenes
  const btnCloseInspector = document.getElementById('btn-close-inspector');
  btnCloseInspector.addEventListener('click', () => {
    document.getElementById('image-inspector').style.display = 'none';
    // Volver a capturar el ratón para seguir jugando
    document.querySelector('a-scene').canvas.requestPointerLock();
    
    // Desbloquear el movimiento y reanudar al mímico
    window.isMovementBlocked = false;
  });

  let linternaEncendida = false;
  let bateria = 100;

  btnStart.addEventListener('click', () => {
    startScreen.style.display = 'none';
    uiContainer.style.display = 'block';
    btnLinterna.style.display = 'block';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      dpad.style.display = 'block';
    }
    document.querySelector('a-scene').canvas.click();
  });

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

  setInterval(() => {
    if (linternaEncendida) {
      bateria -= 1.5; 
      if (bateria <= 0) {
        bateria = 0;
        toggleLinterna(true); 
      }
    } else {
      bateria += 1.0; 
      if (bateria > 100) bateria = 100;
    }
    batteryLevel.innerText = Math.floor(bateria) + "%";
    if (bateria <= 20) {
      batteryLevel.style.color = "#ff3333";
    } else {
      batteryLevel.style.color = "#00ffcc";
    }
  }, 200);
});