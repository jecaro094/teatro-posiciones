// Dibuja el plano del escenario y los círculos numerados de una escena.
// Posiciones en porcentaje (x, y entre 0 y 100); y=0 fondo, y=100 público.
// Los círculos se reutilizan entre escenas para que se deslicen a su nueva posición.
export function renderStage(container, data, sceneId, editable, onChange = () => {}) {
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!container.querySelector('.label')) {
    container.innerHTML = '<span class="label back">Fondo</span><span class="label front">Público</span>';
  }
  const existing = new Map([...container.querySelectorAll('.token')].map(el => [el.dataset.n, el]));
  const present = new Set();
  for (const pos of scene?.positions ?? []) {
    const key = String(pos.number);
    present.add(key);
    let el = existing.get(key);
    if (!el) {
      el = document.createElement('div');
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
    el.classList.remove('gone');
    requestAnimationFrame(() => { el.style.left = pos.x + '%'; el.style.top = pos.y + '%'; });
    el.classList.toggle('editable', !!editable);
    el.onpointerdown = editable ? e => startDrag(e, el, container, pos, onChange) : null;
  }
  for (const [key, el] of existing) if (!present.has(key)) el.remove();
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
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
  };
  const end = () => {
    el.classList.remove('dragging');
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
