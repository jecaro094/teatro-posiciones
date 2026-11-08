// Configuración del backend. Ambos valores son públicos por diseño (la seguridad la dan las reglas RLS y el token).
// Si SUPABASE_URL está vacío, la app funciona en modo local (localStorage) para desarrollo.
export const SUPABASE_URL = 'https://jfjrodusnoefpulgmcgh.supabase.co';      // p. ej. https://abcd1234.supabase.co
export const SUPABASE_ANON_KEY = 'sb_publishable_IGrivqiFCB3N7vHcNzVGVQ_m37hZFla'; // Project Settings → API → anon public
