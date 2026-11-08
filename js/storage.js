// Capa de datos única. Con Supabase configurado: lectura pública y escritura solo con token de admin (validado en el servidor).
// Sin configurar: JSON de ejemplo + localStorage. Interfaz: loadData / saveData / resetData / isRemote / verifyToken.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const KEY = 'teatro-posiciones:data';
export const isRemote = !!SUPABASE_URL;

// Las claves nuevas (sb_publishable_...) no son JWT: solo van en `apikey`. Las legacy (eyJ...) también en Authorization.
const headers = () => ({
  apikey: SUPABASE_ANON_KEY,
  ...(SUPABASE_ANON_KEY.startsWith('eyJ') && { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }),
  'Content-Type': 'application/json',
});
const rpc = (name, body) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
const sample = () => fetch('data/sample.json').then(r => r.json());

export class AccessError extends Error {}

export async function loadData(token) {
  if (isRemote) {
    if (!token) throw new AccessError('Falta el enlace de acceso');
    const res = await rpc('get_state', { p_token: token });
    if (res.status === 401 || res.status === 403) throw new AccessError('Enlace no válido');
    if (!res.ok) throw new Error('No se pudo cargar');
    return (await res.json()) ?? sample(); // sin datos guardados aún: ejemplo
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* sin almacenamiento */ }
  return sample();
}

export async function saveData(data, token) {
  if (isRemote) {
    const res = await rpc('save_state', { p_token: token, p_data: data });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Token de admin no válido' : 'No se pudo guardar');
    return;
  }
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignorar */ }
}

export async function verifyToken(token) {
  if (!isRemote) return true;
  try {
    const res = await rpc('is_admin', { p_token: token });
    return res.ok && (await res.json()) === true;
  } catch { return false; }
}

export function resetData() {
  try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
}
