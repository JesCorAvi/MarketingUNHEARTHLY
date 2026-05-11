// ==========================================
// COMPONENTES GENERALES Y EFECTOS
// ==========================================
AFRAME.registerComponent('brillo-sombrero', {
  schema: { intensidad: { type: 'number', default: 0.3 } },
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

AFRAME.registerComponent('auto-escala', {
  schema: { maxSize: { type: 'number', default: 0.5 } },
  init: function () {
    this.el.addEventListener('model-loaded', () => {
      const mesh = this.el.getObject3D('mesh');
      if (!mesh) return;
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scaleFactor = this.data.maxSize / maxDim;
        this.el.object3D.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }
    });
  }
});

AFRAME.registerComponent('efecto-pickable', {
  schema: {
    velocidadRot: { type: 'number', default: 0.01 },   
    amplitudFlote: { type: 'number', default: 0.15 },  
    velocidadFlote: { type: 'number', default: 0.003 } 
  },
  init: function () {
    this.originalY = this.el.object3D.position.y;
    this.timeOffset = Math.random() * 1000;
  },
  tick: function (time, timeDelta) {
    if (window.isMovementBlocked) return; 
    this.el.object3D.rotation.y += this.data.velocidadRot;
    const desfase = Math.sin((time + this.timeOffset) * this.data.velocidadFlote) * this.data.amplitudFlote;
    this.el.object3D.position.y = this.originalY + desfase;
  }
});

// ==========================================
// COMPONENTES VR
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
        if (this.rig.body) this.rig.body.quaternion.copy(this.rig.object3D.quaternion);
        this.isTurning = true;
      }
    });
  }
});

// ==========================================
// MOVIMIENTO DEL JUGADOR
// ==========================================
AFRAME.registerComponent('physics-movement', {
  schema: { 
    force: { type: 'number', default: 1400 },
    stepInterval: { type: 'number', default: 550 } 
  },
  init: function () {
    this.keys = { w: false, a: false, s: false, d: false };
    this.touchX = 0; this.touchZ = 0;
    this.thumbstickX = 0; this.thumbstickZ = 0; 
    this.joystickX = 0; this.joystickZ = 0;
    this.stepTimer = this.data.stepInterval; 
    
    this.soundsLeft = [document.getElementById('snd-paso-izq'), document.getElementById('snd-paso-izq2')];
    this.soundsRight = [document.getElementById('snd-paso-der'), document.getElementById('snd-paso-der2')];
    this.soundsLeft.forEach(snd => { if (snd) snd.volume = 0.5; });
    this.soundsRight.forEach(snd => { if (snd) snd.volume = 0.5; });
    
    this.isLeftStep = true; 

    this.el.addEventListener('body-loaded', () => {
      this.el.body.fixedRotation = true;
      this.el.body.updateMassProperties();
    });

    window.addEventListener('keydown', (e) => { if(this.keys.hasOwnProperty(e.key.toLowerCase())) this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { if(this.keys.hasOwnProperty(e.key.toLowerCase())) this.keys[e.key.toLowerCase()] = false; });

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
  
  tick: function (time, timeDelta) {
    if (!this.el.body || !timeDelta) return; 
    if (window.isMovementBlocked) {
      this.el.body.velocity.set(0, 0, 0);
      return; 
    }

    let moveX = this.touchX + this.thumbstickX + this.joystickX; 
    let moveZ = this.touchZ + this.thumbstickZ + this.joystickZ;
    
    if (this.keys.w) moveZ -= 1; 
    if (this.keys.s) moveZ += 1;
    if (this.keys.a) moveX -= 1; 
    if (this.keys.d) moveX += 1;
    
    const isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
      const startScreen = document.getElementById('start-screen');
      if (startScreen && startScreen.style.display === 'none') {
        window.hasPlayerMoved = true;
      }
      
      this.stepTimer += timeDelta;
      if (this.stepTimer >= this.data.stepInterval) {
        let soundToPlay = null;
        if (this.isLeftStep) {
          soundToPlay = this.soundsLeft[Math.floor(Math.random() * this.soundsLeft.length)];
        } else {
          soundToPlay = this.soundsRight[Math.floor(Math.random() * this.soundsRight.length)];
        }

        if (soundToPlay) {
          soundToPlay.currentTime = 0; 
          soundToPlay.play().catch(e => {});
        }
        this.isLeftStep = !this.isLeftStep; 
        this.stepTimer -= this.data.stepInterval; 
      }

      const currentSpeed = Math.sqrt(this.el.body.velocity.x ** 2 + this.el.body.velocity.z ** 2);
      const maxSpeed = 3.5; 

      if (currentSpeed < maxSpeed) {
        const length = Math.sqrt(moveX*moveX + moveZ*moveZ);
        if(length > 1) { moveX /= length; moveZ /= length; }

        const cam = document.querySelector('#player-camera').getObject3D('camera');
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3(-forward.z, 0, forward.x);

        const dir = new THREE.Vector3().addScaledVector(forward, -moveZ).addScaledVector(right, moveX).normalize();
        this.el.body.force.x += dir.x * this.data.force;
        this.el.body.force.z += dir.z * this.data.force;
      }

    } else {
      this.stepTimer = this.data.stepInterval - 200; 
      if (this.el.body) {
        this.el.body.velocity.x *= 0.85; 
        this.el.body.velocity.z *= 0.85;
        if (Math.abs(this.el.body.velocity.x) < 0.1) this.el.body.velocity.x = 0;
        if (Math.abs(this.el.body.velocity.z) < 0.1) this.el.body.velocity.z = 0;
      }
    }
  }
});

// ==========================================
// IA DEL ENEMIGO
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

    if (!window.hasPlayerMoved) {
      const startScreen = document.getElementById('start-screen');
      const isMenuOpen = startScreen && startScreen.style.display !== 'none';
      if (!isMenuOpen) {
        const camera3D = this.cameraEl.getObject3D('camera');
        if (this.lastRot === undefined) {
          this.lastRot = { x: camera3D.rotation.x, y: camera3D.rotation.y };
        } else {
          if (Math.abs(camera3D.rotation.x - this.lastRot.x) > 0.05 || Math.abs(camera3D.rotation.y - this.lastRot.y) > 0.05) {
            window.hasPlayerMoved = true;
          }
        }
      }
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    if (window.isMovementBlocked) {
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    let currentLoot = window.lootCollected || 0;
    const isPC = !window.isMobile && !window.isXRActive;
    const pcMultiplier = isPC ? 1.25 : 1.0;

    let speedForce = this.data.force;
    let tpCooldown = 15000;

    if (currentLoot === 1) { 
        speedForce = 1000;   
        tpCooldown = 25000;  
    } else if (currentLoot === 2) { 
        speedForce = 1300;   
        tpCooldown = 20000;  
    } else if (currentLoot === 3) { 
        speedForce = 1600;   
        tpCooldown = 15000;  
    } else if (currentLoot >= 4) { 
        speedForce = 1900;   
        tpCooldown = 10000;  
    }
    
    speedForce *= pcMultiplier; 

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
    const enemigoVistoYParado = loVesRealmente && window.linternaEncendida;

    if (this.stunTimer > 0) {
      this.stunTimer -= timeDelta;
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
      return; 
    }

    this.teleportTimer += timeDelta;
    
    if (this.teleportTimer > tpCooldown && !enemigoVistoYParado && currentLoot > 0) {
      this.teleportTimer = 0; 
      this.stunTimer = 2000; 

      const teleportSound = document.getElementById('snd-teleport');
      if (teleportSound) {
        teleportSound.currentTime = 0;
        teleportSound.volume = 0.8;
        teleportSound.play();
      }

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

    if (enemigoVistoYParado || currentLoot === 0) {
      this.el.body.velocity.set(0, 0, 0);
      this.el.body.force.set(0, 0, 0);
    } else {
      const moveDir = new THREE.Vector3().subVectors(camPos, enemyPos);
      moveDir.y = 0; moveDir.normalize();
      
      this.el.body.wakeUp(); 
      this.el.body.force.x += moveDir.x * speedForce;
      this.el.body.force.z += moveDir.z * speedForce;
    }

    const distFinal = Math.sqrt(Math.pow(camPos.x - enemyPos.x, 2) + Math.pow(camPos.z - enemyPos.z, 2));
    
    if (distFinal < 1.2 && !this.isGameOver && currentLoot > 0) {
      this.isGameOver = true;
      window.endGame(false);
    }
  }
});

// ==========================================
// RECOLECTAR ACTIVOS 
// ==========================================
AFRAME.registerComponent('recolectable', {
  init: function () {
    this.el.addEventListener('mouseenter', () => {
      const mesh = this.el.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh && node.material) {
            node.material.emissive.setHex(0x00ffcc); 
            node.material.emissiveIntensity = 0.5;   
          }
        });
      }
    });

    this.el.addEventListener('mouseleave', () => {
      const mesh = this.el.getObject3D('mesh');
      if (mesh) {
        mesh.traverse((node) => {
          if (node.isMesh && node.material) {
            node.material.emissive.setHex(0x000000); 
            node.material.emissiveIntensity = 0;
          }
        });
      }
    });

    this.el.addEventListener('click', () => {
      if (this.collected) return; 
      if (window.isMovementBlocked && document.getElementById('victory-screen').style.display !== 'none') return;

      const objSound = document.getElementById('snd-objeto');
      if (objSound) {
        objSound.currentTime = 0; 
        objSound.play();
      }

      this.collected = true; 
      window.lootCollected++;
      document.querySelector('#loot-count').innerText = window.lootCollected;
      
      const vrLoot = document.querySelector('#vr-loot-count');
      if (vrLoot) vrLoot.setAttribute('value', 'RASTROS: ' + window.lootCollected + '/5');

      this.el.setAttribute('animation__fade', { property: 'scale', to: '0 0 0', dur: 500, easing: 'easeInBack' });

      setTimeout(() => {
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el); 
      }, 500);
      
      if (window.lootCollected >= window.targetLoot) {
        window.endGame(true);
      }
    });
  }
});
AFRAME.registerComponent('movimiento-perchero', {
  schema: {
    velocidadAnimBase: { type: 'number', default: 1.5 },
    amplitudSalto: { type: 'number', default: 0.15 },
    amplitudInclinacion: { type: 'number', default: 15 },
    radioBase: { type: 'number', default: 0.6 } 
  },

  init: function () {
    this.tiempo = 0;
    this.pasoIzquierdoHecho = false;
    this.pasoDerechoHecho = false;

    this.el.setAttribute('sound__left', {
      src: '#snd-enemy-left', poolSize: 2, distanceModel: 'exponential', rolloffFactor: 2
    });
    this.el.setAttribute('sound__right', {
      src: '#snd-enemy-right', poolSize: 2, distanceModel: 'exponential', rolloffFactor: 2
    });

    this.yInicial = this.el.object3D.position.y;
    
    this.camara = document.querySelector('#player-camera');
    this.vec3Enemigo = new THREE.Vector3();
    this.vec3Camara = new THREE.Vector3();
    this.dirCamara = new THREE.Vector3();

    this.posicionAnterior = new THREE.Vector3();
    
    // Usamos parentEl que es lo recomendado en A-Frame
    if (this.el.parentEl) {
      this.el.parentEl.object3D.getWorldPosition(this.posicionAnterior);
    }
  },

  tick: function (time, timeDelta) {
    // ¡LA CLAVE ESTÁ AQUÍ! Si timeDelta es 0, evitamos la división por cero
    if (timeDelta === 0 || window.isMovementBlocked || !this.el.parentEl) return;

    // 1. CÁLCULO DE VELOCIDAD FÍSICA REAL
    const posActual = new THREE.Vector3();
    this.el.parentEl.object3D.getWorldPosition(posActual);
    
    const dx = posActual.x - this.posicionAnterior.x;
    const dz = posActual.z - this.posicionAnterior.z;
    const distanciaRecorrida = Math.sqrt(dx * dx + dz * dz);
    
    const velocidadReal = distanciaRecorrida / (timeDelta / 1000);
    this.posicionAnterior.copy(posActual);

    // 2. DETECCIÓN DE LINTERNA (ESTATUA)
    let estaSiendoApuntado = false;
    
    if (window.linternaEncendida && this.camara) {
      this.camara.object3D.getWorldPosition(this.vec3Camara);
      this.el.object3D.getWorldPosition(this.vec3Enemigo);
      this.camara.object3D.getWorldDirection(this.dirCamara);
      this.dirCamara.multiplyScalar(-1);
      
      this.vec3Enemigo.sub(this.vec3Camara).normalize();
      if (this.dirCamara.angleTo(this.vec3Enemigo) < 0.4) {
        estaSiendoApuntado = true;
      }
    }

    if (estaSiendoApuntado) {
      this.el.object3D.rotation.z = 0;
      this.el.object3D.position.y = this.yInicial;
      return; 
    }

    // 3. ANIMACIÓN DINÁMICA
    if (velocidadReal > 0.05) {
      const velocidadAnimacion = velocidadReal * this.data.velocidadAnimBase;
      this.tiempo += (timeDelta / 1000) * velocidadAnimacion;
    } else {
      this.el.object3D.rotation.z = THREE.MathUtils.lerp(this.el.object3D.rotation.z, 0, 0.1);
      this.el.object3D.position.y = THREE.MathUtils.lerp(this.el.object3D.position.y, this.yInicial, 0.1);
      return;
    }

    const oscilacion = Math.sin(this.tiempo);
    const salto = Math.abs(Math.sin(this.tiempo)) * this.data.amplitudSalto;

    const radianesInclinacion = THREE.MathUtils.degToRad(oscilacion * this.data.amplitudInclinacion);
    this.el.object3D.rotation.z = radianesInclinacion;
    
    const compensacionSuelo = Math.abs(Math.sin(radianesInclinacion)) * this.data.radioBase;
    this.el.object3D.position.y = this.yInicial + salto + compensacionSuelo;

    // 4. SONIDO CON VELOCIDAD DINÁMICA
    const playbackSpeed = Math.max(0.8, Math.min(1.8, velocidadReal * 0.4));

    if (oscilacion < -0.9 && !this.pasoIzquierdoHecho) {
      this.reproducirPaso('sound__left', playbackSpeed);
      this.pasoIzquierdoHecho = true;
      this.pasoDerechoHecho = false;
    }
    if (oscilacion > 0.9 && !this.pasoDerechoHecho) {
      this.reproducirPaso('sound__right', playbackSpeed);
      this.pasoDerechoHecho = true;
      this.pasoIzquierdoHecho = false;
    }
  },

  reproducirPaso: function(componente, velocidad) {
    const soundComp = this.el.components[componente];
    if (soundComp) {
      if (soundComp.pool && soundComp.pool.children) {
        soundComp.pool.children.forEach(audioNode => {
          if (audioNode.setPlaybackRate) {
            audioNode.setPlaybackRate(velocidad);
          }
        });
      }
      soundComp.playSound();
    }
  }
});
// ==========================================
// LÓGICA DE NOTAS (INSPECTOR DE IMÁGENES)
// ==========================================
AFRAME.registerComponent('nota-interactiva', {
  schema: { img: {type: 'string'} },
  init: function () {
    const src = window.resolveImageSrc ? window.resolveImageSrc(this.data.img) : this.data.img;

    this.el.addEventListener('mouseenter', () => {
      this.el.setAttribute('material', 'emissive', '#00ffcc');
      this.el.setAttribute('material', 'emissiveIntensity', 0.25);
    });
    this.el.addEventListener('mouseleave', () => {
      this.el.setAttribute('material', 'emissive', '#000000');
      this.el.setAttribute('material', 'emissiveIntensity', 0);
    });

    if (src) {
      this.el.setAttribute('material', `src: ${src}; color: #dcd3b6; roughness: 1; metalness: 0`);
      
      const imgObj = new Image();
      imgObj.onload = () => {
        const imgRatio = imgObj.width / imgObj.height;
        const origW = parseFloat(this.el.getAttribute('width'));
        const origH = parseFloat(this.el.getAttribute('height'));
        const origD = parseFloat(this.el.getAttribute('depth'));

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

    this.el.addEventListener('click', () => {
      if (!src) return;

      const paperSound = document.getElementById('snd-papel');
      if (paperSound) {
        paperSound.currentTime = 0;
        paperSound.play();
      }

      if (window.isXRActive) {
        const vrInspectorContainer = document.getElementById('vr-inspector-container');
        const vrInspector = document.getElementById('vr-inspector');
        
        vrInspector.setAttribute('src', src);
        vrInspectorContainer.setAttribute('visible', 'true');
        
        setTimeout(() => { window.isMovementBlocked = true; }, 100);
      } else {
        if (!window.isMobile) document.exitPointerLock();
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