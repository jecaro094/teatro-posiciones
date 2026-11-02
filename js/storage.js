// Capa de datos. Hoy: JSON de ejemplo. Después: backend compartido
// (Artifact con base de datos o Firebase/Supabase). Mantener esta interfaz estable.
export async function loadData() {
  const res = await fetch('data/sample.json');
  return res.json();
}
export async function saveData(_data) {
  // TODO: solo el admin; persistir en el backend elegido
  throw new Error('saveData no implementado');
}
