/* =====================================================================
   APP — Point d'entrée
   Boot → DATA_LAYER.init() → ROUTER (affiche Retrodex directement)
   ===================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');

  try {
    await DATA_LAYER.init();
    ROUTER.init();
  } catch (err) {
    console.error('[Retrodex] Boot error:', err);
    app.innerHTML = `
      <div style="
        display:flex; align-items:center; justify-content:center;
        height:100vh; background:#000; flex-direction:column; gap:16px;
        font-family:'Press Start 2P',cursive; color:#9bbc0f; font-size:0.6rem;
      ">
        <div>DATA LINK ERROR</div>
        <div style="font-size:0.45rem; color:#8bac0f;">Check console for details</div>
      </div>`;
  }
});
