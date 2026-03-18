/* =====================================================================
   ROUTER - lightweight multi-view shell
   Default route remains /retrodex.
   ===================================================================== */

const ROUTER = {
  currentView: null,

  go(path) { location.hash = path; },

  init() {
    window.addEventListener('hashchange', () => this.render());
    this.render();
  },

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    if (this.currentView && typeof this.currentView.cleanup === 'function') {
      this.currentView.cleanup();
    }

    const route = location.hash.replace('#', '') || '/retrodex';

    if (route === '/market' && typeof MARKET_VIEW !== 'undefined') {
      this.currentView = MARKET_VIEW;
      app.innerHTML = this.currentView.render();
      if (typeof this.currentView.bindEvents === 'function') this.currentView.bindEvents();
      if (typeof this.currentView.mountChart === 'function') this.currentView.mountChart();
      return;
    }

    this.currentView = RETRODEX_VIEW;
    app.innerHTML = this.currentView.render();
    if (typeof this.currentView.bindEvents === 'function') this.currentView.bindEvents();
  }
};
