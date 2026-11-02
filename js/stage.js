// Dibuja el plano del escenario y los círculos numerados de una escena.
// Posiciones en porcentaje (x, y entre 0 y 100); y=0 fondo, y=100 público.
export function renderStage(container, data, sceneId, editable) {
  container.innerHTML = '';
  const scene = data.scenes.find(s => s.id === sceneId);
  if (!scene) return;
  for (const pos of scene.positions) {
    const el = document.createElement('div');
    el.className = 'token';
    el.textContent = pos.number;
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
    // TODO: tooltip con nombre; si editable, arrastrar y soltar
    container.appendChild(el);
  }
}
