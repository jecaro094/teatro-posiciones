// Punto de entrada: carga datos, pinta escenario y gestiona el modo admin.
import { loadData } from './storage.js';
import { renderStage } from './stage.js';
import { isAdmin, toggleAdmin } from './admin.js';

async function init() {
  const data = await loadData();
  // TODO: poblar selector de escenas, elenco y notas
  renderStage(document.getElementById('stage'), data, data.scenes[0]?.id, isAdmin());
  document.getElementById('admin-toggle').addEventListener('click', toggleAdmin);
}
init();
