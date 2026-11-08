// Punto de entrada: carga datos, pinta la escena elegida y gestiona el modo admin.
import { loadData, saveData, resetData, getVersion, isRemote, AccessError } from './storage.js';
import { renderStage } from './stage.js';
import { isAdmin, toggleAdmin, initAdmin, getToken, readToken, canToggle } from './admin.js';

const $ = id => document.getElementById(id);
let data;
let sceneId;

function renderCast() {
  const scene = data.scenes.find(s => s.id === sceneId);
  const onStage = new Set(scene.positions.map(p => p.number));
  const list = $('cast-list');
  list.innerHTML = '';
  const ul = document.createElement('ul');
  for (const c of data.cast) {
    const here = onStage.has(c.number);
    const li = document.createElement('li');
    li.className = here ? 'on' : 'off';
    if (isAdmin()) {
      li.classList.add('editing');
      li.innerHTML = `<input class="f-num" type="number" min="1" inputmode="numeric" aria-label="Número">
        <span class="who"><input class="f-name" placeholder="Nombre" aria-label="Nombre"><input class="f-role" placeholder="Personaje" aria-label="Personaje"></span>
        <select class="f-type" aria-label="Tipo"><option value="ancentros">Ancentros</option><option value="addams">Addams</option></select>
        <button type="button" class="f-toggle"></button><button type="button" class="f-del" aria-label="Eliminar">✕</button>`;
      li.querySelector('.f-num').value = c.number;
      li.querySelector('.f-name').value = c.name;
      li.querySelector('.f-role').value = c.role || '';
      li.querySelector('.f-type').value = c.type === 'addams' ? 'addams' : 'ancentros';
      li.querySelector('.f-type').addEventListener('change', e => { c.type = e.target.value; commit(); });
      li.querySelector('.f-toggle').textContent = here ? 'En escena' : 'Fuera';
      li.querySelector('.f-toggle').addEventListener('click', () => togglePresence(c.number));
      li.querySelector('.f-name').addEventListener('change', e => { c.name = e.target.value.trim(); commit(); });
      li.querySelector('.f-role').addEventListener('change', e => { c.role = e.target.value.trim(); commit(); });
      li.querySelector('.f-num').addEventListener('change', e => renumber(c, parseInt(e.target.value, 10)));
      li.querySelector('.f-del').addEventListener('click', () => removePerson(c));
    } else {
      li.innerHTML = `<span class="num"></span><span class="who"><b></b><small></small></span><em></em>`;
      li.querySelector('.num').textContent = c.number;
      li.querySelector('.num').classList.toggle('type-addams', c.type === 'addams');
      li.querySelector('b').textContent = c.name;
      li.querySelector('small').textContent = c.role || '';
      li.querySelector('em').textContent = here ? 'En escena' : 'Fuera';
    }
    ul.appendChild(li);
  }
  list.appendChild(ul);
  if (isAdmin()) {
    const add = document.createElement('button');
    add.type = 'button';
    add.id = 'add-person';
    add.textContent = '+ Añadir persona';
    add.addEventListener('click', addPerson);
    list.appendChild(add);
  }
}

function persist() {
  saveData(data, getToken()).catch(err => alert(err.message));
}

function commit() { persist(); renderScene(); }

function addPerson() {
  const number = Math.max(0, ...data.cast.map(c => c.number)) + 1;
  data.cast.push({ number, name: 'Nueva persona', role: '', type: 'ancentros' });
  commit();
}

function renumber(person, n) {
  if (!Number.isInteger(n) || n < 1) { alert('El número debe ser un entero positivo.'); return renderCast(); }
  if (data.cast.some(c => c !== person && c.number === n)) { alert(`El número ${n} ya está asignado.`); return renderCast(); }
  const old = person.number;
  person.number = n;
  for (const sc of data.scenes) for (const p of sc.positions) if (p.number === old) p.number = n;
  data.cast.sort((x, y) => x.number - y.number);
  commit();
}

function removePerson(person) {
  if (!confirm(`¿Eliminar a ${person.name || 'esta persona'} (nº ${person.number}) del elenco y de todas las escenas?`)) return;
  data.cast = data.cast.filter(c => c !== person);
  for (const sc of data.scenes) sc.positions = sc.positions.filter(p => p.number !== person.number);
  commit();
}

function togglePresence(number) {
  const scene = data.scenes.find(s => s.id === sceneId);
  const i = scene.positions.findIndex(p => p.number === number);
  if (i >= 0) scene.positions.splice(i, 1);
  else scene.positions.push({ number, x: 50, y: 50 });
  persist();
  renderScene();
}

function renderScene() {
  const scene = data.scenes.find(s => s.id === sceneId);
  renderStage($('stage'), data, sceneId, isAdmin(), () => { persist(); renderCast(); });
  document.body.classList.toggle('admin', isAdmin());
  $('admin-toggle').textContent = isAdmin() ? 'Salir de admin' : 'Modo admin';
  $('admin-toggle').hidden = !canToggle();
  $('reset').hidden = !isAdmin() || isRemote;
  $('admin-help').hidden = !isAdmin();
  renderCast();
  renderTools(scene);
  $('scene-notes').textContent = scene.notes || '';
  $('scene-select').value = sceneId;
}

// ---- Panel admin: escenas y copias ----
function renderTools(scene) {
  const tools = $('scene-tools');
  tools.hidden = !isAdmin();
  if (!isAdmin()) return;
  const i = data.scenes.indexOf(scene);
  $('scene-title').value = scene.title;
  $('scene-notes-edit').value = scene.notes || '';
  $('scene-up').disabled = i <= 0;
  $('scene-down').disabled = i >= data.scenes.length - 1;
  $('scene-del').disabled = data.scenes.length <= 1;
}

function currentScene() { return data.scenes.find(s => s.id === sceneId); }

function newSceneId() {
  let id;
  do { id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  while (data.scenes.some(s => s.id === id));
  return id;
}

function addScene() {
  const scene = { id: newSceneId(), title: `Escena ${data.scenes.length + 1}`, notes: '', positions: [] };
  data.scenes.push(scene);
  sceneId = scene.id;
  fillScenes();
  persist();
  renderScene();
  $('scene-title').focus();
  $('scene-title').select();
}

function moveScene(delta) {
  const i = data.scenes.findIndex(s => s.id === sceneId);
  const j = i + delta;
  if (j < 0 || j >= data.scenes.length) return;
  [data.scenes[i], data.scenes[j]] = [data.scenes[j], data.scenes[i]];
  fillScenes();
  persist();
  renderScene();
}

function deleteScene() {
  const scene = currentScene();
  if (data.scenes.length <= 1) return;
  if (!confirm(`¿Borrar la escena «${scene.title}» y sus posiciones?`)) return;
  const i = data.scenes.indexOf(scene);
  data.scenes.splice(i, 1);
  sceneId = data.scenes[Math.min(i, data.scenes.length - 1)].id;
  fillScenes();
  persist();
  renderScene();
}

function downloadBackup() {
  const slug = (data.play || 'teatro').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug || 'teatro'}-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Comprueba la forma mínima de una copia antes de reemplazar los datos.
function validBackup(d) {
  const ok = d && typeof d === 'object' && Array.isArray(d.cast) && Array.isArray(d.scenes) && d.scenes.length > 0
    && d.cast.every(c => c && Number.isInteger(c.number) && typeof c.name === 'string')
    && d.scenes.every(s => s && typeof s.id === 'string' && typeof s.title === 'string' && Array.isArray(s.positions)
      && s.positions.every(p => p && Number.isInteger(p.number) && Number.isFinite(p.x) && Number.isFinite(p.y)));
  return !!ok && new Set(d.scenes.map(s => s.id)).size === d.scenes.length
    && new Set(d.cast.map(c => c.number)).size === d.cast.length;
}

async function restoreBackup(file) {
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch { return alert('El archivo no es un JSON válido.'); }
  if (!validBackup(parsed)) return alert('El archivo no parece una copia de esta app.');
  if (!confirm(`Se reemplazará todo el elenco y las escenas actuales por la copia (${parsed.cast.length} personas, ${parsed.scenes.length} escenas). ¿Continuar?`)) return;
  data = parsed;
  sceneId = data.scenes[0].id;
  $('play-title').textContent = data.play || '';
  fillScenes();
  persist();
  renderScene();
}

// Elenco: comprueba cada POLL_MS si el admin ha guardado cambios y, si es así, recarga y repinta.
// El admin no se actualiza solo (no se le pisa lo que edita).
const POLL_MS = 20000;
let version;
function fillScenes() {
  const select = $('scene-select');
  select.replaceChildren(...data.scenes.map(s => new Option(s.title, s.id)));
}
async function checkUpdates() {
  if (!isRemote || isAdmin() || document.hidden || !data) return;
  try {
    const v = await getVersion(readToken());
    if (version !== undefined && v !== version) {
      data = await loadData(readToken());
      if (!data.scenes.some(s => s.id === sceneId)) sceneId = data.scenes[0].id;
      fillScenes();
      renderScene();
    }
    version = v;
  } catch { /* sin red o pausado: se reintenta en el siguiente ciclo */ }
}

// Abre las cortinas de la pantalla de carga y la quita del DOM.
function hideSplash() {
  const el = $('splash');
  if (!el) return;
  el.classList.add('done');
  setTimeout(() => el.remove(), 900);
}

async function init() {
  try { await start(); } finally { hideSplash(); }
}

async function start() {
  await initAdmin();
  try {
    if (isRemote) version = await getVersion(readToken()).catch(() => undefined);
    data = await loadData(readToken());
  } catch (err) {
    $('admin-toggle').hidden = true;
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = err instanceof AccessError
      ? 'Necesitas el enlace de acceso del elenco. Pídeselo a quien gestiona la obra.'
      : 'No se pudo cargar. Inténtalo de nuevo en un momento.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Reintentar';
    retry.addEventListener('click', () => location.reload());
    msg.append(document.createElement('br'), retry);
    $('stage').replaceChildren(msg);
    return;
  }
  $('play-title').textContent = data.play;
  document.title = data.play;
  const select = $('scene-select');
  fillScenes();
  sceneId = data.scenes[0].id;
  select.addEventListener('change', () => { sceneId = select.value; renderScene(); });
  $('scene-title').addEventListener('change', e => {
    currentScene().title = e.target.value.trim() || 'Sin título';
    fillScenes(); persist(); renderScene();
  });
  $('scene-notes-edit').addEventListener('change', e => { currentScene().notes = e.target.value.trim(); persist(); renderScene(); });
  $('scene-new').addEventListener('click', addScene);
  $('scene-up').addEventListener('click', () => moveScene(-1));
  $('scene-down').addEventListener('click', () => moveScene(1));
  $('scene-del').addEventListener('click', deleteScene);
  $('backup-save').addEventListener('click', downloadBackup);
  $('backup-load').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) restoreBackup(f);
  });
  $('admin-toggle').addEventListener('click', () => { toggleAdmin(); renderScene(); });
  $('reset').addEventListener('click', async () => {
    if (!confirm('¿Descartar todos los cambios y volver al ejemplo?')) return;
    resetData();
    data = await loadData(readToken());
    sceneId = data.scenes[0].id;
    renderScene();
  });
  renderScene();
  if (isRemote) {
    setInterval(checkUpdates, POLL_MS);
    document.addEventListener('visibilitychange', checkUpdates);
  }
}
init();
