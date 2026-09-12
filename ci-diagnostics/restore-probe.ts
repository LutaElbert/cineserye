import { test } from '@playwright/test';

export function installRestoreProbe() {
  test.beforeEach(async ({ page }, info) => {
    page.on('console', message => {
      if (message.text().startsWith('CI_RESTORE ')) console.log(`CI_RESTORE_TEST ${JSON.stringify({ test: info.title, event: message.text().slice(11) })}`);
    });
    page.on('pageerror', error => console.log(`CI_RESTORE_ERROR ${JSON.stringify({ test: info.title, message: error.message.slice(0, 400) })}`));
    await page.addInitScript(() => {
      const emit = (kind: string, value: unknown) => console.debug(`CI_RESTORE ${JSON.stringify({ kind, wall: Date.now(), time: performance.now(), value })}`);
      let previousState = '', previousTick = performance.now(), reading = false, storedLarge = false;
      let database: IDBDatabase | undefined;
      const readStored = async () => {
        if (reading || storedLarge) return;
        reading = true;
        const started = performance.now();
        try {
          if (!database) {
            if (!(await indexedDB.databases()).some(entry => entry.name === 'cineserye-local')) return;
            database = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open('cineserye-local');
              request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
            });
          }
          if (!database.objectStoreNames.contains('documents')) return;
          const request = database.transaction('documents', 'readonly').objectStore('documents').get('current');
          const document = await new Promise<{ nodes?: unknown[]; edges?: unknown[] } | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
          });
          if (document?.nodes?.length === 500) {
            storedLarge = true; emit('stored-500', { nodes: document.nodes.length, edges: document.edges?.length, readStarted: started, readDuration: performance.now() - started });
          }
        } catch (error) { emit('probe-error', String(error)); }
        finally { reading = false; }
      };
      const feedback = () => {
        const main = document.querySelector('main');
        const state = { ready: main?.getAttribute('data-ready'), save: main?.getAttribute('data-save-state'), busy: main?.getAttribute('aria-busy'),
          dialogs: document.querySelectorAll('[role="alertdialog"]').length,
          toasts: [...document.querySelectorAll('.toast')].map(element => {
            const r = element.getBoundingClientRect(), s = getComputedStyle(element);
            return { text: element.textContent?.slice(0, 180), x: r.x, y: r.y, width: r.width, height: r.height, visibility: s.visibility, display: s.display, opacity: s.opacity };
          }) };
        const signature = JSON.stringify(state);
        if (signature !== previousState) { previousState = signature; emit('feedback', state); }
      };
      new MutationObserver(feedback).observe(document, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['data-ready', 'data-save-state', 'aria-busy', 'inert', 'open'] });
      document.addEventListener('click', event => {
        const button = (event.target as Element)?.closest('button');
        if (button?.closest('[role="alertdialog"]') && button.textContent?.includes('Restore backup')) emit('restore-click', null);
      }, true);
      let previousGraph = '';
      window.setInterval(() => {
        const now = performance.now();
        if (now - previousTick > 600) emit('event-loop-gap', now - previousTick);
        previousTick = now;
        const graph = { nodes: document.querySelectorAll('.react-flow__node').length, edges: document.querySelectorAll('.react-flow__edge').length };
        const signature = JSON.stringify(graph);
        if (signature !== previousGraph) { previousGraph = signature; emit('graph', graph); }
        void readStored();
      }, 250);
      window.addEventListener('pagehide', () => { emit('pagehide', null); database?.close(); });
      emit('init', { cores: navigator.hardwareConcurrency });
    });
  });
}
