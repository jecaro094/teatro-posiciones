// Punto de entrada: carga datos, pinta la escena elegida y gestiona el modo admin.
import { loadData, saveData, resetData, isRemote, AccessError } from './storage.js';
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
  $('scene-notes').textContent = scene.notes || '';
  $('scene-select').value = sceneId;
}

async function init() {
  await initAdmin();
  try {
    data = await loadData(readToken());
  } catch (err) {
    $('admin-toggle').hidden = true;
    $('stage').textContent = err instanceof AccessError
      ? 'Necesitas el enlace de acceso del elenco. Pídeselo a quien gestiona la obra.'
      : 'No se pudo cargar. Inténtalo de nuevo en un momento.';
    return;
  }
  $('play-title').textContent = data.play;
  document.title = data.play;
  const select = $('scene-select');
  for (const s of data.scenes) select.add(new Option(s.title, s.id));
  sceneId = data.scenes[0].id;
  select.addEventListener('change', () => { sceneId = select.value; renderScene(); });
  $('admin-toggle').addEventListener('click', () => { toggleAdmin(); renderScene(); });
  $('reset').addEventListener('click', async () => {
    if (!confirm('¿Descartar todos los cambios y volver al ejemplo?')) return;
    resetData();
    data = await loadData(readToken());
    sceneId = data.scenes[0].id;
    renderScene();
  });
  renderScene();
}
init();
