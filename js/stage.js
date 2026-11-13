// Dibuja el plano del escenario y los círculos numerados de una escena.
// Posiciones en porcentaje (x, y entre 0 y 100); y=0 fondo, y=100 público.
// Los círculos se reutilizan entre escenas para que se deslicen a su nueva posición.
export function renderStage(container, data, sceneId, editable, onChange = () => {}) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!container.querySelector('.label')) {
    container.innerHTML = '<div class="zone curtain"></div><div class="zone floor"></div><div class="zone pit"></div><div class="axis"></div>'
      + '<span class="label back">Fondo</span><span class="label front">Público</span>';
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
      el.style.left = pos.x + '%';
      el.style.top = pos.y + '%';
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
    el.classList.remove('gone');
    requestAnimationFrame(() => { el.style.left = pos.x + '%'; el.style.top = pos.y + '%'; });
    el.classList.toggle('editable', !!editable);
    el.onpointerdown = editable ? e => startDrag(e, el, container, pos, onChange) : null;
    el.onkeydown = editable ? e => moveByKey(e, el, pos, onChange) : null;
  }
  for (const [key, el] of existing) if (!present.has(key)) el.remove();
}

// Teclado (admin): flechas mueven 1 %, con Mayús 5 %.
function moveByKey(e, el, pos, onChange) {
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (!d) return;
  e.preventDefault();
  const step = e.shiftKey ? 5 : 1;
  pos.x = Math.min(100, Math.max(0, Math.round((pos.x + d[0] * step) * 10) / 10));
  pos.y = Math.min(100, Math.max(0, Math.round((pos.y + d[1] * step) * 10) / 10));
  el.style.left = pos.x + '%';
  el.style.top = pos.y + '%';
  onChange();
}

// Arrastre con puntero (ratón o dedo). Guarda x/y en % al soltar.
function startDrag(e, el, container, pos, onChange) {
  e.preventDefault();
  el.setPointerCapture(e.pointerId);
  el.classList.add('dragging');
  const move = ev => {
    const r = container.getBoundingClientRect();
    pos.x = Math.round(Math.min(100, Math.max(0, (ev.clientX - r.left) / r.width * 100)) * 10) / 10;
    pos.y = Math.round(Math.min(100, Math.max(0, (ev.clientY - r.top) / r.height * 100)) * 10) / 10;
    // Imán al eje central (el que usa «Simetrizar»)
    if (Math.abs(pos.x - 50) <= 1.5) pos.x = 50;
    container.classList.toggle('snap', pos.x === 50);
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
  };
  const end = () => {
    el.classList.remove('dragging');
    container.classList.remove('snap');
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
