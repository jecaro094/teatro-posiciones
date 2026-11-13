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
  const mine = hasFilter() ? castOf(filter.p) : null;
  const people = mine ? [mine, ...data.cast.filter(c => c !== mine)] : data.cast;
  for (const c of people) {
    const here = onStage.has(c.number);
    const li = document.createElement('li');
    li.className = here ? 'on' : 'off';
    if (c === mine) li.classList.add('me');
    if (isAdmin()) {
      li.classList.add('editing');
      li.innerHTML = `<input class="f-num" type="text" maxlength="3" aria-label="Código">
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
      li.querySelector('.f-num').addEventListener('change', e => renumber(c, e.target.value.trim()));
      li.querySelector('.f-del').addEventListener('click', () => removePerson(c));
    } else {
      li.innerHTML = `<span class="num"></span><span class="who"><b></b><small></small></span><em></em>`;
      li.querySelector('.num').textContent = c.number;
      li.querySelector('.num').classList.toggle('type-addams', c.type === 'addams');
      li.querySelector('b').textContent = c.name;
      li.querySelector('small').textContent = c.role || '';
      li.querySelector('em').textContent = here ? 'En escena' : 'Fuera';
      // Tocar una fila que está en escena localiza su círculo en el plano
      if (here) {
        li.classList.add('tap');
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `Localizar a ${c.name} en el plano`);
        const go = () => locate(c.number);
        li.addEventListener('click', go);
        li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      }
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

// Localiza en el plano el círculo de una persona: lo muestra con su nombre y lo hace latir.
function locate(number) {
  const stage = $('stage');
  const tok = stage.querySelector(`.token[data-n="${CSS.escape(String(number))}"]`);
  if (!tok) return;
  stage.querySelectorAll('.token.show').forEach(t => t.classList.remove('show'));
  tok.classList.add('show', 'pulse');
  setTimeout(() => tok.classList.remove('pulse'), 2000);
  stage.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ---- Guardado con estado visible (admin): guardando / guardado / error con reintento. Las escrituras no se solapan. ----
let saveState = 'saved', saving = false, pendingSave = false;
function setSave(state) {
  saveState = state;
  const el = $('save-state');
  el.dataset.state = state;
  el.textContent = state === 'saving' ? 'Guardando…' : state === 'saved' ? '✓ Guardado' : '⚠ Sin guardar · Reintentar';
}
async function flushSave() {
  if (saving) { pendingSave = true; return; }
  saving = true;
  do {
    pendingSave = false;
    setSave('saving');
    try { await saveData(data, getToken()); setSave('saved'); }
    catch (err) { setSave('error'); notify(err.message); }
  } while (pendingSave);
  saving = false;
}
function persist() { flushSave(); }
window.addEventListener('beforeunload', e => { if (saveState !== 'saved') { e.preventDefault(); e.returnValue = ''; } });

// Borrados y movimientos sin diálogo de confirmación: se hacen y se ofrece «Deshacer».
function withUndo(msg, mutate) {
  const snap = JSON.stringify(data), keep = sceneId;
  mutate();
  fillScenes();
  persist();
  renderScene();
  toast(msg, { action: { label: 'Deshacer', run: () => {
    data = JSON.parse(snap);
    sceneId = data.scenes.some(s => s.id === keep) ? keep : data.scenes[0].id;
    fillScenes();
    persist();
    renderScene();
  } } });
}

function commit() { persist(); renderScene(); }

function addPerson() {
  const number = Math.max(0, ...data.cast.map(c => c.number).filter(Number.isInteger)) + 1;
  data.cast.push({ number, name: 'Nueva persona', role: '', type: 'ancentros' });
  commit();
}

function renumber(person, n) {
  if (/^\d+$/.test(n)) n = +n;
  if (n === '' || n === 0) { notify('El código no puede estar vacío.'); return renderCast(); }
  if (data.cast.some(c => c !== person && c.number === n)) { notify(`El código ${n} ya está asignado.`); return renderCast(); }
  const old = person.number;
  person.number = n;
  for (const sc of data.scenes) for (const p of sc.positions) if (p.number === old) p.number = n;
  commit();
}

function removePerson(person) {
  withUndo(`${person.name || 'Persona'} (${person.number}) eliminada del elenco`, () => {
    data.cast = data.cast.filter(c => c !== person);
    for (const sc of data.scenes) sc.positions = sc.positions.filter(p => p.number !== person.number);
  });
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
  $('save-state').hidden = !isAdmin();
  $('admin-help').hidden = !isAdmin();
  renderCast();
  renderPosNav();
  renderFilter();
  $('sym-tools').hidden = !isAdmin();
  $('sym-undo').disabled = !symUndo.has(sceneId);
  if (!isAdmin()) $('sym-msg').textContent = '';
  renderTools(scene);
  $('scene-notes').textContent = scene.notes || '';
  fillScenes();
  syncLocation();
}

// ---- Panel admin: escenas y copias ----
function renderTools(scene) {
  const tools = $('scene-tools');
  tools.hidden = $('work-tools').hidden = !isAdmin();
  if (!isAdmin()) return;
  const i = data.scenes.indexOf(scene);
  $('scene-act').value = scene.act;
  $('scene-num').value = scene.scene;
  $('scene-title').value = scene.title;
  $('act-name').value = actName(scene.act);
  $('scene-name').value = sceneName(scene.act, scene.scene);
  $('scene-notes-edit').value = scene.notes || '';
  $('scene-up').disabled = i <= 0;
  $('scene-down').disabled = i >= data.scenes.length - 1;
  $('scene-del').disabled = data.scenes.length <= 1;
}

// Todas las posiciones de la obra en orden (acto, escena y orden dentro de la escena).
const ordered = () => [...data.scenes].sort((a, b) => a.act - b.act || a.scene - b.scene);

// ---- «Mi personaje» (no se ofrece al admin): resalta mi círculo y atenúa el resto; opcionalmente salta las posiciones donde no salgo ----
const FKEY = 'teatro:filter', ASKED = 'teatro:asked', NAMES = 'teatro:names';
const filter = { p: '', only: false };
try {
  const st = JSON.parse(localStorage.getItem(FKEY) || '{}');
  if (typeof st.p === 'string') filter.p = st.p;
  if (st.v === 2) filter.only = !!st.only; // antes «solo mías» venía activado sin elegirlo
} catch { /* sin almacenamiento */ }
const castOf = n => data.cast.find(c => String(c.number) === String(n));
const hasFilter = () => !isAdmin() && !!filter.p;
const hasMe = (sc, p) => sc.positions.some(pos => String(pos.number) === p);
function posMatches(sc) {
  if (!hasFilter() || !filter.only) return true;
  return hasMe(sc, filter.p);
}
const navList = () => ordered().filter(sc => sc.id === sceneId || posMatches(sc));

function renderFilter() {
  const adm = isAdmin();
  if (filter.p && !castOf(filter.p)) filter.p = '';
  $('me-btn').hidden = adm;
  $('only-label').hidden = adm || !filter.p;
  if (!adm) {
    const me = castOf(filter.p);
    $('me-btn').textContent = me ? `Eres: ${me.number} · ${me.name} ✎` : '¿Quién eres? Elige tu personaje';
    $('me-btn').classList.toggle('active', !!me);
    if (me) {
      const hidden = ordered().filter(sc => !hasMe(sc, filter.p)).length;
      $('f-only').checked = filter.only;
      $('only-txt').textContent = filter.only ? `Solo donde salgo (${hidden} ocultas)` : 'Solo donde salgo';
    }
  }
  applyFilter();
}
function applyFilter() {
  const on = hasFilter();
  for (const el of $('stage').querySelectorAll('.token')) {
    if (!on) { el.classList.remove('me', 'dim'); continue; }
    const me = el.dataset.n === filter.p;
    el.classList.toggle('me', me);
    el.classList.toggle('dim', !me);
  }
  let msg = '';
  if (on && !hasMe(currentScene(), filter.p)) msg = 'No sales en esta posición';
  const stage = $('stage');
  let el = stage.querySelector('.stage-msg');
  if (!el && msg) { el = document.createElement('div'); el.className = 'stage-msg'; el.setAttribute('role', 'status'); stage.append(el); }
  if (el) { if (msg) el.textContent = msg; el.classList.toggle('show', !!msg); }
}
function saveFilter() {
  try { localStorage.setItem(FKEY, JSON.stringify({ ...filter, v: 2 })); } catch { /* ignorar */ }
  renderFilter(); renderPosNav(); renderCast();
}

function openSheet(d) { if (!d.open) d.showModal(); }
function closeSheet(d) { if (d.open) d.close(); }

function openMe() {
  const list = $('me-list');
  const pick = (value, content, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls + (String(value) === filter.p ? ' cur' : '');
    b.append(...content);
    b.addEventListener('click', () => { filter.p = String(value); try { localStorage.setItem(ASKED, '1'); } catch { /* ignorar */ } saveFilter(); closeSheet($('me-dialog')); });
    return b;
  };
  const num = c => { const n = document.createElement('span'); n.className = 'num' + (c.type === 'addams' ? ' type-addams' : ''); n.textContent = c.number; return n; };
  const txt = c => { const w = document.createElement('span'); w.className = 'who'; const b = document.createElement('b'); b.textContent = c.name; w.append(b); if (c.role) { const sm = document.createElement('small'); sm.textContent = c.role; w.append(sm); } return w; };
  const none = pick('', [document.createTextNode('Solo mirar (no soy nadie en concreto)')], 'none');
  list.replaceChildren(none, ...data.cast.map(c => pick(c.number, [num(c), txt(c)])));
  openSheet($('me-dialog'));
}

function initFilter() {
  $('me-btn').addEventListener('click', openMe);
  $('f-only').addEventListener('change', e => { filter.only = e.target.checked; saveFilter(); });
  $('me-dialog').addEventListener('close', () => { try { localStorage.setItem(ASKED, '1'); } catch { /* ignorar */ } hint(); });
  // Nombres bajo los círculos (se recuerda)
  let names = false;
  try { names = localStorage.getItem(NAMES) === '1'; } catch { /* ignorar */ }
  const paint = () => { document.body.classList.toggle('names', names); $('names-btn').setAttribute('aria-pressed', String(names)); $('names-btn').textContent = names ? 'Números' : 'Nombres'; };
  $('names-btn').addEventListener('click', () => { names = !names; try { localStorage.setItem(NAMES, names ? '1' : '0'); } catch { /* ignorar */ } paint(); });
  paint();
}

// Primera visita: si no ha dicho quién es, se le pregunta una vez.
function askWho() {
  let asked = false;
  try { asked = !!localStorage.getItem(ASKED); } catch { /* ignorar */ }
  if (isAdmin() || asked || filter.p || !data.cast.length) { hint(); return; }
  setTimeout(() => { if (!isAdmin()) openMe(); }, 900);
}

// Pista única sobre el gesto de deslizar (solo táctil)
function hint() {
  if (isAdmin() || !matchMedia('(pointer: coarse)').matches) return;
  try { if (localStorage.getItem('teatro:hint')) return; localStorage.setItem('teatro:hint', '1'); } catch { return; }
  setTimeout(() => toast('Desliza sobre el plano para cambiar de posición', { ms: 3500 }), 600);
}

// Avanza por la lista global: al pasar de la última posición de una escena se entra en la siguiente (y de un acto al otro).
function stepPosition(delta) {
  const all = navList();
  const cur = currentScene();
  const next = all[all.indexOf(cur) + delta];
  if (!next) {
    // Extremo: o no hay más posiciones, o las que quedan están filtradas («Mi personaje»)
    const full = ordered();
    const filtered = full[full.indexOf(cur) + delta];
    toast(filtered ? (delta > 0 ? 'No hay más posiciones donde sales' : 'No hay posiciones anteriores donde sales')
      : (delta > 0 ? 'Última posición' : 'Primera posición'));
    return;
  }
  const full = ordered();
  const skipped = Math.abs(full.indexOf(next) - full.indexOf(cur)) - 1;
  sceneId = next.id;
  renderScene();
  // Texto: «Posición n/m» y, si el título es personalizado, «: título» (como en el desplegable); si cambia de escena o acto, delante va «Acto · Escena».
  const pos = posText(next);
  const place = `${label(`Acto ${next.act}`, actName(next.act))} · ${label(`Escena ${next.scene}`, sceneName(next.act, next.scene))}`;
  const where = next.act !== cur.act || next.scene !== cur.scene ? `${place} · ${pos}` : pos;
  toast(skipped > 0 ? `${where} · ${skipped === 1 ? '1 saltada' : `${skipped} saltadas`}` : where);
}

let toastTimer;
// Aviso breve. Con action: {label, run} lleva un botón (p. ej. «Deshacer»). error: aviso de fallo.
function toast(text, opts = {}) {
  const el = $('nav-toast');
  el.replaceChildren(text);
  el.classList.toggle('error', !!opts.error);
  el.classList.toggle('act', !!opts.action);
  if (opts.action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = opts.action.label;
    b.addEventListener('click', () => { el.classList.remove('show'); opts.action.run(); });
    el.append(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), opts.ms ?? (opts.action || opts.error ? 6000 : 1800));
}
const notify = text => toast(text, { error: true });

// «Posición n/m» entre las posiciones visibles de su escena (con «Solo donde salgo» solo cuentan las mías) y «: título» si es personalizado.
function posText(s) {
  const vis = data.scenes.filter(x => x.act === s.act && x.scene === s.scene && (x === s || posMatches(x)));
  const counter = `${vis.indexOf(s) + 1}/${vis.length}`;
  return /^posici[oó]n \d+$/i.test(s.title) ? `Posición ${counter}` : `Posición ${counter}: ${s.title}`;
}

function renderPosNav() {
  const cur = currentScene();
  const all = navList();
  const g = all.indexOf(cur);
  $('pos-nav').hidden = ordered().length < 2;
  $('goto-place').textContent = `${label(`Acto ${cur.act}`, actName(cur.act))} · ${label(`Escena ${cur.scene}`, sceneName(cur.act, cur.scene))}`;
  $('goto-pos').textContent = posText(cur);
  $('pos-prev').disabled = g <= 0;
  $('pos-next').disabled = g >= all.length - 1;
}

// Hoja «Ir a…»: toda la obra agrupada por acto y escena; las posiciones donde no salgo salen atenuadas.
function openGoto() {
  const list = $('goto-list');
  list.replaceChildren();
  let act, scn, grid;
  const posIdx = new Map();
  for (const s of ordered()) {
    if (s.act !== act) {
      act = s.act; scn = undefined;
      const h = document.createElement('h3'); h.textContent = label(`Acto ${act}`, actName(act)); list.append(h);
    }
    if (s.scene !== scn) {
      scn = s.scene;
      const h = document.createElement('h4'); h.textContent = label(`Escena ${scn}`, sceneName(act, scn));
      grid = document.createElement('div'); grid.className = 'pos-grid';
      list.append(h, grid);
    }
    const key = `${s.act}.${s.scene}`;
    const i = (posIdx.get(key) || 0) + 1;
    posIdx.set(key, i);
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = /^posici[oó]n\b/i.test(s.title) ? s.title : `Posición ${i}: ${s.title}`;
    if (s.id === sceneId) { b.classList.add('cur'); b.setAttribute('aria-current', 'true'); }
    if (hasFilter() && !hasMe(s, filter.p)) b.classList.add('skip');
    b.addEventListener('click', () => { sceneId = s.id; closeSheet($('goto-sheet')); renderScene(); });
    grid.append(b);
  }
  openSheet($('goto-sheet'));
  list.querySelector('.cur')?.scrollIntoView({ block: 'center' });
}

// ---- Dónde estoy: la posición actual va en el hash de la URL (#p=ID) y se recuerda; «atrás» vuelve a la anterior ----
const LAST_KEY = 'teatro:last';
let locationInit = false;
function idFromHash() { const m = /^#p=(.+)$/.exec(location.hash); return m ? decodeURIComponent(m[1]) : null; }
function initialSceneId() {
  let id = idFromHash();
  if (!id) { try { id = localStorage.getItem(LAST_KEY); } catch { /* sin almacenamiento */ } }
  return data.scenes.some(s => s.id === id) ? id : data.scenes[0].id;
}
function syncLocation() {
  const hash = '#p=' + encodeURIComponent(sceneId);
  try { localStorage.setItem(LAST_KEY, sceneId); } catch { /* ignorar */ }
  if (location.hash === hash) { locationInit = true; return; }
  try { history[locationInit ? 'pushState' : 'replaceState'](null, '', hash); } catch { /* ignorar */ }
  locationInit = true;
}

// ---- Exportar a PDF: se monta una hoja por posición (A4 apaisado) y se abre el diálogo de imprimir → «Guardar como PDF» ----
function printPlay(all) {
  const list = all ? [...data.scenes].sort((a, b) => a.act - b.act || a.scene - b.scene) : [currentScene()];
  const area = $('print-area');
  area.replaceChildren(...list.map(s => {
    const page = document.createElement('section');
    page.className = 'ppage';
    const head = document.createElement('header');
    const h = document.createElement('h2'); h.textContent = data.play;
    const sub = document.createElement('p');
    sub.textContent = `${label(`Acto ${s.act}`, actName(s.act))} · ${label(`Escena ${s.scene}`, sceneName(s.act, s.scene))} · ${s.title}`;
    head.append(h, sub);
    const body = document.createElement('div'); body.className = 'pbody';
    const stage = document.createElement('div'); stage.className = 'pstage';
    renderStage(stage, data, s.id, false);
    const side = document.createElement('aside');
    const ul = document.createElement('ul'); ul.className = 'plegend' + (s.positions.length > 7 ? ' two' : '');
    for (const pos of s.positions) {
      const c = data.cast.find(x => x.number === pos.number);
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'pnum' + (c?.type === 'addams' ? ' type-addams' : ''); n.textContent = pos.number;
      const who = document.createElement('span'); who.textContent = c ? c.name : '';
      if (c?.role) { const sm = document.createElement('small'); sm.textContent = ` · ${c.role}`; who.append(sm); }
      li.append(n, who); ul.append(li);
    }
    side.append(ul);
    if (s.notes) { const np = document.createElement('p'); np.className = 'pnotes'; np.textContent = s.notes; side.append(np); }
    body.append(stage, side);
    page.append(head, body);
    return page;
  }));
  // Pestaña sin título mientras se imprime (así no sale en la cabecera del navegador); deja calcular el diseño antes
  const prev = document.title;
  setTimeout(() => {
    document.title = ' ';
    window.addEventListener('afterprint', () => { document.title = prev; }, { once: true });
    window.print();
  }, 100);
}

// Gesto de deslizar sobre el escenario (solo modo elenco): izquierda = siguiente, derecha = anterior.
function initSwipe() {
  const stage = $('stage');
  let start = null;
  stage.addEventListener('pointerdown', e => { start = isAdmin() || e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY }; });
  stage.addEventListener('pointercancel', () => { start = null; });
  stage.addEventListener('pointerup', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    stepPosition(dx < 0 ? 1 : -1);
  });
}

// ---- Simetría (admin): empareja cada círculo con su espejo respecto a x = 50 % y los corrige ----
const SYM_TOL = 15;        // distancia máxima (en % del plano) entre un círculo y la posición espejo de su pareja
const SYM_CENTER = 3;      // los círculos a menos de esto del eje se centran
const symUndo = new Map(); // sceneId → posiciones previas (un nivel)

function symmetrize(positions) {
  const pairs = [];
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    const a = positions[i], b = positions[j];
    if (Math.abs(a.x - 50) <= SYM_CENTER || Math.abs(b.x - 50) <= SYM_CENTER) continue;
    if ((a.x < 50) === (b.x < 50)) continue; // deben estar en lados opuestos
    const dist = Math.hypot((100 - a.x) - b.x, a.y - b.y);
    if (dist <= SYM_TOL) pairs.push({ a, b, dist });
  }
  pairs.sort((p, q) => p.dist - q.dist);
  const used = new Set();
  let paired = 0, centered = 0;
  const r = v => Math.round(v * 10) / 10;
  for (const { a, b } of pairs) {
    if (used.has(a) || used.has(b)) continue;
    used.add(a); used.add(b);
    const [l, rt] = a.x < b.x ? [a, b] : [b, a];
    const half = (rt.x - l.x) / 2, y = r((l.y + rt.y) / 2);
    l.x = r(50 - half); rt.x = r(50 + half); l.y = rt.y = y;
    paired++;
  }
  for (const p of positions) if (!used.has(p) && Math.abs(p.x - 50) <= SYM_CENTER && p.x !== 50) { p.x = 50; centered++; }
  return { paired, centered };
}

function applySymmetry() {
  const scene = currentScene();
  const before = JSON.stringify(scene.positions);
  const { paired, centered } = symmetrize(scene.positions);
  const changed = JSON.stringify(scene.positions) !== before;
  if (changed) { symUndo.set(scene.id, before); persist(); }
  renderScene();
  $('sym-msg').textContent = `${paired} parejas ajustadas, ${centered} centradas${changed ? '' : ' (ya estaba simétrico)'}`;
}

function undoSymmetry() {
  const scene = currentScene();
  const prev = symUndo.get(scene.id);
  if (!prev) return;
  scene.positions = JSON.parse(prev);
  symUndo.delete(scene.id);
  persist();
  renderScene();
  $('sym-msg').textContent = 'Deshecho';
}

function currentScene() { return data.scenes.find(s => s.id === sceneId); }

function newSceneId() {
  let id;
  do { id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  while (data.scenes.some(s => s.id === id));
  return id;
}

// Nueva escena (siguiente número del acto actual) o nueva posición dentro de la escena actual.
// Con copy, la nueva posición duplica los círculos y las notas de la actual y se coloca justo detrás.
function addScene(samePlace = false, copy = false) {
  const cur = currentScene();
  const inAct = data.scenes.filter(s => s.act === cur.act);
  const scene = { id: newSceneId(), act: cur.act, notes: copy ? cur.notes || '' : '',
    positions: copy ? structuredClone(cur.positions) : [],
    scene: samePlace || copy ? cur.scene : Math.max(...inAct.map(s => s.scene)) + 1 };
  scene.title = `Posición ${data.scenes.filter(s => s.act === scene.act && s.scene === scene.scene).length + 1}`;
  if (copy) data.scenes.splice(data.scenes.indexOf(cur) + 1, 0, scene);
  else data.scenes.push(scene);
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
  withUndo('Posición movida', () => { [data.scenes[i], data.scenes[j]] = [data.scenes[j], data.scenes[i]]; });
}

function deleteScene() {
  const scene = currentScene();
  if (data.scenes.length <= 1) return;
  withUndo(`Posición «${scene.title}» borrada`, () => {
    const i = data.scenes.indexOf(scene);
    data.scenes.splice(i, 1);
    sceneId = data.scenes[Math.min(i, data.scenes.length - 1)].id;
  });
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
const validCode = n => Number.isInteger(n) || (typeof n === 'string' && n.length > 0);
function validBackup(d) {
  const ok = d && typeof d === 'object' && Array.isArray(d.cast) && Array.isArray(d.scenes) && d.scenes.length > 0
    && d.cast.every(c => c && validCode(c.number) && typeof c.name === 'string')
    && d.scenes.every(s => s && typeof s.id === 'string' && typeof s.title === 'string' && Array.isArray(s.positions)
      && s.positions.every(p => p && validCode(p.number) && Number.isFinite(p.x) && Number.isFinite(p.y)));
  return !!ok && new Set(d.scenes.map(s => s.id)).size === d.scenes.length
    && new Set(d.cast.map(c => c.number)).size === d.cast.length;
}

async function restoreBackup(file) {
  let parsed;
  try { parsed = JSON.parse(await file.text()); } catch { return notify('El archivo no es un JSON válido.'); }
  if (!validBackup(parsed)) return notify('El archivo no parece una copia de esta app.');
  if (!confirm(`Se reemplazará todo el elenco y las escenas actuales por la copia (${parsed.cast.length} personas, ${parsed.scenes.length} escenas). ¿Continuar?`)) return;
  data = normalize(parsed);
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
// Nombres opcionales: se guardan en cada entrada (actName / sceneName) y valen para todas las del mismo acto / acto+escena.
const actName = a => (data.scenes.find(s => s.act === a && s.actName) || {}).actName || '';
const sceneName = (a, n) => (data.scenes.find(s => s.act === a && s.scene === n && s.sceneName) || {}).sceneName || '';
const label = (base, name) => name ? `${base} · ${name}` : base;
// La barra inferior y la hoja «Ir a…» se construyen a partir de los datos; aquí solo se refresca la barra.
function fillScenes() { renderPosNav(); }

// Los datos antiguos solo tienen título («Acto 1 · …»): saca acto y escena de ahí y numera las escenas dentro de cada acto.
function normalize(d) {
  let lastAct = 1;
  const counters = {};
  for (const s of d.scenes) {
    if (!Number.isInteger(s.act) || s.act < 1) {
      const m = /^\s*acto\s+(\d+)\s*[·:\-–—]\s*(.*)$/i.exec(s.title);
      if (m) { s.act = +m[1]; s.title = m[2].trim() || s.title; } else s.act = lastAct;
    }
    lastAct = s.act;
    if (!Number.isInteger(s.scene) || s.scene < 1) { counters[s.act] = (counters[s.act] || 0) + 1; s.scene = counters[s.act]; }
    else counters[s.act] = Math.max(counters[s.act] || 0, s.scene);
  }
  return d;
}
async function checkUpdates() {
  if (!isRemote || isAdmin() || document.hidden || !data) return;
  try {
    const v = await getVersion(readToken());
    if (version !== undefined && v !== version) {
      data = normalize(await loadData(readToken()));
      if (!data.scenes.some(s => s.id === sceneId)) sceneId = data.scenes[0].id;
      fillScenes();
      renderScene();
      toast('Plano actualizado');
    }
    version = v;
  } catch { /* sin red o pausado: se reintenta en el siguiente ciclo */ }
}

// Abre las cortinas de la pantalla de carga y la quita del DOM.
function hideSplash() {
  const el = $('splash');
  if (!el) return;
  try { sessionStorage.setItem('teatro:curtain', '1'); } catch { /* ignorar */ }
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
    data = normalize(await loadData(readToken()));
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
  sceneId = initialSceneId();
  window.addEventListener('popstate', () => {
    const id = idFromHash();
    if (id && id !== sceneId && data.scenes.some(s => s.id === id)) { sceneId = id; renderScene(); }
  });
  fillScenes();
  for (const [id, key] of [['scene-act', 'act'], ['scene-num', 'scene']]) {
    $(id).addEventListener('change', e => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isInteger(n) || n < 1) { notify('Debe ser un entero positivo.'); return renderScene(); }
      currentScene()[key] = n;
      persist(); renderScene();
    });
  }
  $('scene-title').addEventListener('change', e => {
    currentScene().title = e.target.value.trim() || 'Sin título';
    fillScenes(); persist(); renderScene();
  });
  $('act-name').addEventListener('change', e => {
    const a = currentScene().act, v = e.target.value.trim();
    for (const s of data.scenes) if (s.act === a) s.actName = v;
    persist(); renderScene();
  });
  $('scene-name').addEventListener('change', e => {
    const { act, scene } = currentScene(), v = e.target.value.trim();
    for (const s of data.scenes) if (s.act === act && s.scene === scene) s.sceneName = v;
    persist(); renderScene();
  });
  $('scene-notes-edit').addEventListener('change', e => { currentScene().notes = e.target.value.trim(); persist(); renderScene(); });
  $('scene-new').addEventListener('click', () => addScene(false));
  $('scene-pos').addEventListener('click', () => addScene(true));
  $('scene-copy').addEventListener('click', () => addScene(true, true));
  $('scene-up').addEventListener('click', () => moveScene(-1));
  $('scene-down').addEventListener('click', () => moveScene(1));
  $('scene-del').addEventListener('click', deleteScene);
  $('pos-prev').addEventListener('click', () => stepPosition(-1));
  $('pos-next').addEventListener('click', () => stepPosition(1));
  $('goto-btn').addEventListener('click', openGoto);
  for (const d of document.querySelectorAll('dialog.sheet')) {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('.sheet-x')) closeSheet(d); });
  }
  $('save-state').addEventListener('click', () => { if (saveState === 'error') flushSave(); });
  $('sym-apply').addEventListener('click', applySymmetry);
  $('sym-undo').addEventListener('click', undoSymmetry);
  initSwipe();
  initFilter();
  const pdfBtn = $('pdf-btn'), pdfList = $('pdf-list');
  const setPdfMenu = open => { pdfList.hidden = !open; pdfBtn.setAttribute('aria-expanded', String(open)); };
  pdfBtn.addEventListener('click', () => setPdfMenu(pdfList.hidden));
  document.addEventListener('pointerdown', e => { if (!pdfList.hidden && !e.target.closest('#pdf-menu')) setPdfMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pdfList.hidden) { setPdfMenu(false); pdfBtn.focus(); } });
  $('pdf-current').addEventListener('click', () => { setPdfMenu(false); printPlay(false); });
  $('pdf-all').addEventListener('click', () => { setPdfMenu(false); printPlay(true); });
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
    data = normalize(await loadData(readToken()));
    sceneId = data.scenes[0].id;
    renderScene();
  });
  renderScene();
  askWho();
  if (isRemote) {
    setInterval(checkUpdates, POLL_MS);
    document.addEventListener('visibilitychange', checkUpdates);
  }
}
init();
