// Acceso por enlace secreto (con backend):
//   ?v=TOKEN  → elenco: solo lectura.   ?k=TOKEN → admin: lectura y edición.
// El servidor valida el token en cada llamada; aquí solo lo recogemos y recordamos.
// Sin backend (desarrollo local): botón para alternar admin.
import { isRemote, verifyToken } from './storage.js';

let adminToken = null;
let viewerToken = null;
let admin = false;

export const isAdmin = () => admin;
export const getToken = () => adminToken;             // para escribir
export const readToken = () => adminToken || viewerToken; // para leer
export const canToggle = () => !isRemote || !!adminToken;

// Lee y guarda un token de la URL (lo quita de la barra). Si no hay, usa el recordado.
// Admin: sessionStorage (se olvida al cerrar). Elenco: localStorage (cómodo en el móvil).
function pick(url, param, store, key) {
  let t = url.searchParams.get(param);
  try {
    if (t) { store.setItem(key, t); url.searchParams.delete(param); history.replaceState(null, '', url); }
    else t = store.getItem(key);
  } catch { /* sin almacenamiento: vale solo en esta carga */ }
  return t;
}

export async function initAdmin() {
  if (!isRemote) return;
  const url = new URL(location.href);
  const k = pick(url, 'k', sessionStorage, 'teatro:k');
  viewerToken = pick(url, 'v', localStorage, 'teatro:v');
  if (k && await verifyToken(k)) { adminToken = k; admin = true; }
  else { try { sessionStorage.removeItem('teatro:k'); } catch { /* ignorar */ } }
}

export function toggleAdmin() {
  if (canToggle()) admin = !admin;
}
