window.isXRActive = false;
window.hasPlayerMoved = false; 
window.linternaEncendida = false;
window.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

window.lootCollected = 0;
window.targetLoot = 5;

// ==========================================
// CONTROLADOR DE FIN DE JUEGO
// ==========================================
window.endGame = function(isVictory) {
  window.isMovementBlocked = true;

  const ambientSound = document.getElementById('snd-cueva');
  if (ambientSound) ambientSound.pause();

  if (isVictory) {
    const winSnd = document.getElementById('snd-win');
    if (winSnd) winSnd.play();
  } else {
    const deathSnd = document.getElementById('snd-muerte');
    if (deathSnd) deathSnd.play();
  }
  
  if (window.isXRActive) {
    if (isVictory) {
      document.getElementById('vr-victory-screen').setAttribute('visible', 'true');
    } else {
      document.getElementById('vr-death-screen').setAttribute('visible', 'true');
    }
  } else {
    if (!window.isMobile) document.exitPointerLock();
    if (isVictory) {
      document.getElementById('victory-screen').style.display = 'flex';
    } else {
      document.getElementById('death-screen').style.display = 'flex';
    }
  }
  
  setTimeout(() => {
    location.reload();
  }, 20000);
};

// ==========================================
// PANTALLA DE CARGA Y PRECARGA
// ==========================================
const imageCache = {};
const conceptImages = [
  'concepts/1.png','concepts/2.png','concepts/3.png','concepts/4.png',
  'concepts/5.png','concepts/6.png','concepts/7.png','concepts/8.png',
  'concepts/9.jpg','concepts/10.png','concepts/11.png'
];

window.resolveImageSrc = function(src) {
  return src || null;
};

window.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loading-screen');
  const loadingProgress = document.getElementById('loading-progress');
  const loadingText = document.getElementById('loading-text');

  const aframeAssets = document.querySelectorAll('a-assets > *');
  const totalItems = aframeAssets.length + conceptImages.length;
  let loadedItems = 0;

  function updateProgress() {
    loadedItems++;
    let percent = Math.floor((loadedItems / totalItems) * 100);
    if (percent > 100) percent = 100;
    
    if (loadingProgress) loadingProgress.style.width = percent + '%';
    if (loadingText) loadingText.innerText = percent + '%';

    if (loadedItems >= totalItems) {
      setTimeout(() => {
        if (loadingScreen) {
          loadingScreen.style.opacity = '0';
          loadingScreen.style.transition = 'opacity 0.8s ease';
          setTimeout(() => {
              loadingScreen.style.display = 'none';
          }, 800);
        }
      }, 500);
    }
  }

  if (aframeAssets.length > 0) {
    aframeAssets.forEach(asset => {
      if (asset.hasLoaded) {
        updateProgress();
      } else {
        asset.addEventListener('loaded', updateProgress, { once: true });
        asset.addEventListener('error', updateProgress, { once: true });
      }
    });
  } else {
    updateProgress();
  }

  conceptImages.forEach(src => {
    const img = new Image();
    img.onload = () => { imageCache[src] = img.src; updateProgress(); };
    img.onerror = () => { console.warn('No se pudo precargar: ' + src); updateProgress(); };
    img.src = src;
  });
  
  setTimeout(() => {
    if (loadingScreen && loadingScreen.style.display !== 'none') {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.8s ease';
      setTimeout(() => loadingScreen.style.display = 'none', 800);
    }
  }, 60000); 
});