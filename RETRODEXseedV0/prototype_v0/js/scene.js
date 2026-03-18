/* =====================================================================
   SCENE — interactions de la scène collector (home page)

   Responsabilités :
     · parallax pointer sur la boîte et les objets
     · animation zoom-to-route au clic sur un objet
     · keyboard navigation (Enter / Space sur un objet)

   Dépendances : aucune (chargé après utils.js, avant les vues)
   ===================================================================== */

const SCENE_NAV_DELAY = 300;
let sceneInteractionsInitialized = false;

/* ── Parallax ─────────────────────────────────────────────────────── */

function getNormalizedPointer(e, el) {
  const b = el.getBoundingClientRect();
  return {
    x: ((e.clientX - b.left) / b.width  - 0.5) * 2,
    y: ((e.clientY - b.top)  / b.height - 0.5) * 2
  };
}

function resetMotionVars(el) {
  el.style.setProperty('--mx', '0');
  el.style.setProperty('--my', '0');
  el.style.setProperty('--light-x', '50%');
  el.style.setProperty('--light-y', '35%');
}

function bindPointerSurface(el) {
  if (!el) return;
  el.addEventListener('pointermove', e => {
    const { x, y } = getNormalizedPointer(e, el);
    el.style.setProperty('--mx', x.toFixed(4));
    el.style.setProperty('--my', y.toFixed(4));
    el.style.setProperty('--light-x', `${50 + x * 12}%`);
    el.style.setProperty('--light-y', `${35 + y * 10}%`);
  });
  el.addEventListener('pointerleave', () => resetMotionVars(el));
}

/* ── Zoom-to-route ────────────────────────────────────────────────── */

function animateSceneNavigation(target) {
  const route = target?.dataset.sceneRoute;
  const scene = target?.closest('.collector-scene');
  if (!route || !scene || target.dataset.isZooming === 'true') return;

  target.dataset.isZooming = 'true';
  scene.classList.add('scene-zoom', 'is-focusing');
  target.classList.add('zoom-target');

  setTimeout(() => {
    target.classList.remove('zoom-target');
    target.dataset.isZooming = 'false';
    scene.classList.remove('scene-zoom', 'is-focusing');
    ROUTER.go(route);
  }, SCENE_NAV_DELAY);
}

/* ── Initialisation globale (appelée une seule fois) ─────────────── */

function initSceneInteractions() {
  if (sceneInteractionsInitialized) return;

  const scene = document.querySelector('.collector-scene');
  if (!scene) return;

  bindPointerSurface(scene);

  // Clic sur un objet de la scène
  document.addEventListener('click', e => {
    const t = e.target.closest('.collector-scene .obj');
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    animateSceneNavigation(t);
  }, true);

  // Clavier : Enter ou Espace sur un objet focalisé
  document.addEventListener('keydown', e => {
    const t = e.target.closest('.collector-scene .obj');
    if (!t || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    animateSceneNavigation(t);
  }, true);

  sceneInteractionsInitialized = true;
}

// Auto-init dès que le DOM est prêt
document.addEventListener('DOMContentLoaded', initSceneInteractions);
