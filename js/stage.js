// Dibuja el plano del escenario y los círculos numerados de una escena.
// Posiciones en porcentaje (x, y entre 0 y 100); y=0 fondo, y=100 público.
// Los círculos se reutilizan entre escenas para que se deslicen a su nueva posición.
export function renderStage(container, data, sceneId, editable, onChange = () => {}) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!container.querySelector('.label')) {
    // El fondo (.bg) se amplía con el zoom; los círculos no (mantienen su tamaño y se recolocan con --k/--tx/--ty).
    container.innerHTML = '<div class="bg"><div class="zone curtain"></div><div class="zone floor"></div><div class="zone pit"></div><div class="axis"></div>'
      + '<span class="label back">Fondo</span><span class="label front">Público</span></div>';
    // Toca fuera de un círculo: oculta el nombre mostrado
    container.addEventListener('click', e => {
      if (e.target.closest('.token')) return;
      container.querySelectorAll('.token.show').forEach(t => t.classList.remove('show'));
    });
  }
  const existing = new Map([...container.querySelectorAll('.token')].map(el => [el.dataset.n, el]));
  const present = new Set();
  for (const pos of scene?.positions ?? []) {
    const key = String(pos.number);
    present.add(key);
    let el = existing.get(key);
    if (!el) {
      el = document.createElement('button');
      el.type = 'button';
      el.className = 'token';
      el.dataset.n = key;
      el.textContent = pos.number;
      // Nace en su sitio, sin deslizarse desde (0,0)
      setXY(el, pos);
      container.appendChild(el);
    }
    const person = data.cast.find(c => c.number === pos.number);
    el.classList.toggle('type-addams', person?.type === 'addams');
    el.title = person ? `${person.name} · ${person.role ?? ''}` : '';
    el.dataset.name = person?.name ?? '';
    el.dataset.first = (person?.name ?? '').trim().split(/\s+/)[0];
    el.setAttribute('aria-label', person ? `${pos.number}: ${person.name}${person.role ? ' · ' + person.role : ''}` : String(pos.number));
    // Solo lectura: tocar un círculo muestra el nombre
    el.onclick = editable ? null : () => {
      const was = el.classList.contains('show');
      container.querySelectorAll('.token.show').forEach(t => t.classList.remove('show'));
      el.classList.toggle('show', !was);
    };
    el._pos = pos;
    el.classList.remove('gone');
    setXY(el, pos);
    el.classList.toggle('editable', !!editable);
    el.onpointerdown = editable ? e => startDrag(e, el, container, pos, onChange) : null;
    el.onkeydown = editable ? e => moveByKey(e, el, pos, onChange) : null;
  }
  for (const [key, el] of existing) if (!present.has(key)) el.remove();
  if (container.id === 'stage') placeLabels(container);
}

// Elige para cada círculo el lado donde su etiqueta (nombre) choca menos con otros círculos y etiquetas.
export function placeLabels(container) {
  const W = container.clientWidth, Hh = container.clientHeight;
  if (!W) return;
  const v = getView(container);
  const r = { width: W, height: Hh };
  const D = 44, H = 14;
  const pts = [...container.querySelectorAll('.token')].filter(t => t._pos)
    .map(t => ({ t, x: v.tx + t._pos.x / 100 * W * v.k, y: v.ty + t._pos.y / 100 * Hh * v.k }));
  const circles = pts.map(p => ({ l: p.x - D / 2, r: p.x + D / 2, t: p.y - D / 2, b: p.y + D / 2 }));
  const placed = [];
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  pts.forEach((p, i) => {
    const w = Math.max(18, (p.t.dataset.first || '').length * 7) + 4, c = circles[i];
    const cand = {
      bottom: { l: p.x - w / 2, r: p.x + w / 2, t: c.b + 2, b: c.b + 2 + H },
      top: { l: p.x - w / 2, r: p.x + w / 2, t: c.t - 2 - H, b: c.t - 2 },
      right: { l: c.r + 3, r: c.r + 3 + w, t: p.y - H / 2, b: p.y + H / 2 },
      left: { l: c.l - 3 - w, r: c.l - 3, t: p.y - H / 2, b: p.y + H / 2 },
    };
    let best = 'bottom', bestScore = Infinity;
    for (const [side, box] of Object.entries(cand)) {
      let score = circles.reduce((n, o, j) => n + (j !== i && hit(box, o) ? 1 : 0), 0) + placed.reduce((n, o) => n + (hit(box, o) ? 1 : 0), 0);
      if (box.l < 0 || box.r > r.width || box.t < 0 || box.b > r.height) score += 0.5;
      if (score < bestScore) { best = side; bestScore = score; }
      if (score === 0) break;
    }
    placed.push(cand[best]);
    p.t.dataset.side = best;
  });
}

// Teclado (admin): flechas mueven 1 %, con Mayús 5 %.
function moveByKey(e, el, pos, onChange) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d) return;
  e.preventDefault();
  const step = e.shiftKey ? 5 : 1;
  pos.x = Math.min(100, Math.max(0, Math.round((pos.x + d[0] * step) * 10) / 10));
  pos.y = Math.min(100, Math.max(0, Math.round((pos.y + d[1] * step) * 10) / 10));
  setXY(el, pos);
  onChange();
}

// Arrastre con puntero (ratón o dedo). Guarda x/y en % al soltar.
function startDrag(e, el, container, pos, onChange) {
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  el.classList.add('dragging');
  const move = ev => {
    const r = container.getBoundingClientRect(), v = getView(container);
    const px = ev.clientX - r.left - container.clientLeft - v.tx, py = ev.clientY - r.top - container.clientTop - v.ty;
    pos.x = Math.round(Math.min(100, Math.max(0, px / (container.clientWidth * v.k) * 100)) * 10) / 10;
    pos.y = Math.round(Math.min(100, Math.max(0, py / (container.clientHeight * v.k) * 100)) * 10) / 10;
    // Imán al eje central (el que usa «Simetrizar»)
    if (Math.abs(pos.x - 50) <= 1.5) pos.x = 50;
    container.classList.toggle('snap', pos.x === 50);
    setXY(el, pos);
  };
  const end = () => {
    el.classList.remove('dragging');
    container.classList.remove('snap');
    placeLabels(container);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', end);
    el.removeEventListener('pointercancel', end);
    onChange();
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  move(e);
}

// La posición (en %) va en variables CSS; el CSS la combina con la vista: left = --tx + x · --k.
function setXY(el, pos) {
  el.style.setProperty('--x', pos.x);
  el.style.setProperty('--y', pos.y);
}

// ---- Vista (zoom y desplazamiento) del plano ----
export const MAX_ZOOM = 4;
export function getView(container) { return container._view || { k: 1, tx: 0, ty: 0 }; }

// Aplica una vista (limitada para no salirse del plano). animate=false durante los gestos.
// auto=true: encuadre automático (no bloquea el desplazamiento de la página ni el deslizar entre posiciones).
export function setView(container, v, animate = true, auto = false) {
  const w = container.clientWidth, h = container.clientHeight;
  const k = Math.min(MAX_ZOOM, Math.max(1, v.k));
  const tx = Math.min(0, Math.max(w * (1 - k), v.tx)), ty = Math.min(0, Math.max(h * (1 - k), v.ty));
  container._view = { k, tx, ty };
  container._auto = auto && k > 1.001;
  container.style.setProperty('--k', k);
  container.style.setProperty('--tx', tx + 'px');
  container.style.setProperty('--ty', ty + 'px');
  container.classList.toggle('zoomed', k > 1.001 && !container._auto);
  container.classList.toggle('zooming', !animate);
  container.dispatchEvent(new CustomEvent('viewchange', { detail: container._view }));
  placeLabels(container);
}

// Zoom manteniendo fijo el punto (cx, cy) en px del plano.
export function zoomAt(container, k2, cx, cy, animate = true) {
  const v = getView(container), k = Math.min(MAX_ZOOM, Math.max(1, k2));
  setView(container, { k, tx: cx - (cx - v.tx) * k / v.k, ty: cy - (cy - v.ty) * k / v.k }, animate);
}

// Encuadra los círculos dados (positions) con margen; si apenas hay que ampliar, vista completa.
export function fitView(container, positions) {
  const w = container.clientWidth, h = container.clientHeight;
  if (!positions.length || !w) return setView(container, { k: 1, tx: 0, ty: 0 });

  const xs = positions.map(p => p.x / 100 * w), ys = positions.map(p => p.y / 100 * h);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 46; // medio círculo + aire, en px de pantalla
  const kx = x1 > x0 ? (w - 2 * pad) / (x1 - x0) : MAX_ZOOM, ky = y1 > y0 ? (h - 2 * pad) / (y1 - y0) : MAX_ZOOM;
  const k = Math.min(kx, ky, positions.length > 1 ? MAX_ZOOM : 2.5);
  if (k < 1.25) return setView(container, { k: 1, tx: 0, ty: 0 });
  setView(container, { k, tx: w / 2 - k * (x0 + x1) / 2, ty: h / 2 - k * (y0 + y1) / 2 }, true, true);
}

// ¿Hay círculos que se tocan o solapan a vista completa? (distancia entre centros menor que el círculo + un poco de aire)
export function isCrowded(container, positions) {
  const w = container.clientWidth, h = container.clientHeight;
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    if (Math.hypot((positions[i].x - positions[j].x) / 100 * w, (positions[i].y - positions[j].y) / 100 * h) < 50) return true;
  }
  return false;
}

// Gestos: pellizco (2 dedos) y arrastre (con zoom) en táctil; arrastre con ratón; Ctrl/⌘ + rueda (o pellizco del trackpad).
// A 1× no se bloquea el desplazamiento vertical de la página.
export function initZoom(container) {
  let g = null; // { type: 'pan'|'pinch', ... }
  const pt = (t) => { const r = container.getBoundingClientRect(); return { x: t.clientX - r.left - container.clientLeft, y: t.clientY - r.top - container.clientTop }; };
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const stamp = () => { container._gestureAt = performance.now(); };
  const admin = () => document.body.classList.contains('admin');

  let multi = false, start1 = null, lastTap = 0, lastPt = null;
  container.addEventListener('touchstart', e => {
    const ts = [...e.touches].map(pt);
    if (e.touches.length > 1) multi = true; else start1 = ts[0];
    if (e.touches.length === 2) {
      if (admin() && [...e.touches].some(t => t.target.closest?.('.token'))) { g = null; return; }
      const v = getView(container);
      g = { type: 'pinch', d: dist(ts[0], ts[1]), m: mid(ts[0], ts[1]), v };
      stamp();
    } else if (e.touches.length === 1 && getView(container).k > 1.001 && !container._auto) {
      if (admin() && e.target.closest('.token')) { g = null; return; }
      g = { type: 'pan', p: ts[0], v: getView(container), moved: false };
    } else g = null;
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    if (!g) return;
    const ts = [...e.touches].map(pt);
    if (g.type === 'pinch' && ts.length === 2) {
      e.preventDefault(); stamp();
      const m = mid(ts[0], ts[1]), k = g.v.k * dist(ts[0], ts[1]) / g.d;
      // zoom alrededor del punto medio inicial + desplazamiento del punto medio
      const kk = Math.min(MAX_ZOOM, Math.max(1, k));
      const tx = m.x - (g.m.x - g.v.tx) * kk / g.v.k, ty = m.y - (g.m.y - g.v.ty) * kk / g.v.k;
      setView(container, { k: kk, tx, ty }, false);
    } else if (g.type === 'pan' && ts.length === 1) {
      const dx = ts[0].x - g.p.x, dy = ts[0].y - g.p.y;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      e.preventDefault(); stamp();
      setView(container, { k: g.v.k, tx: g.v.tx + dx, ty: g.v.ty + dy }, false);
    }
  }, { passive: false });

  const endTouch = e => {
    // Doble toque (fuera de los círculos): evento 'doubletap' (encuadrar / vista completa)
    if (e.type === 'touchend' && e.touches.length === 0 && !multi && start1 && !(g && g.moved) && !e.target.closest('.token')) {
      const p = pt(e.changedTouches[0]), now = performance.now();
      if (Math.hypot(p.x - start1.x, p.y - start1.y) < 10) {
        if (lastPt && now - lastTap < 300 && Math.hypot(p.x - lastPt.x, p.y - lastPt.y) < 30) {
          lastTap = 0; lastPt = null; stamp();
          if (e.cancelable) e.preventDefault();
          container.dispatchEvent(new CustomEvent('doubletap'));
        } else { lastTap = now; lastPt = p; }
      }
    }
    if (e.touches.length === 0) { multi = false; start1 = null; }
    if (e.touches.length === 0) { if (g) { container.classList.remove('zooming'); } g = null; }
    else if (g?.type === 'pinch') g = null; // al quedar un dedo, no se sigue (evita saltos)
  };
  container.addEventListener('touchend', endTouch);
  container.addEventListener('touchcancel', endTouch);

  // Ratón: arrastrar para desplazar con zoom (en admin, solo fuera de los círculos)
  container.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || getView(container).k <= 1.001 || container._auto) return;
    if (e.target.closest('.token')) return;
    const start = { x: e.clientX, y: e.clientY, v: getView(container) };
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true; stamp();
      setView(container, { k: start.v.k, tx: start.v.tx + dx, ty: start.v.ty + dy }, false);
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); container.classList.remove('zooming'); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });

  container.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return; // la rueda sola sigue desplazando la página
    e.preventDefault();
    const p = pt(e);
    zoomAt(container, getView(container).k * Math.exp(-e.deltaY * 0.01), p.x, p.y, false);
    clearTimeout(container._wheelT);
    container._wheelT = setTimeout(() => container.classList.remove('zooming'), 150);
  }, { passive: false });

  // Tras un gesto no se debe interpretar el «clic» final como tocar un círculo
  container.addEventListener('click', e => {
    if (performance.now() - (container._gestureAt || 0) < 350) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
