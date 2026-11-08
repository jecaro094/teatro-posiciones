# Despliegue gratuito: GitHub Pages + Supabase

Dos URLs, mismo código:
- Elenco (solo lectura): `https://<usuario>.github.io/<repo>/`
- Admin: la misma URL con `?k=<TOKEN>` (el token se guarda en la sesión y se quita de la barra).

## 1. Supabase
1. Crea un proyecto en supabase.com (plan Free).
2. SQL Editor → pega `docs/supabase.sql` → Run.
3. Project Settings → API: copia **Project URL** y la clave **anon public** en `js/config.js`.
   (Son públicas por diseño: sin el token nadie puede escribir.)

## 2. GitHub Pages
1. Sube los cambios a `main` (el repo debe ser público en el plan gratuito).
2. Settings → Pages → Source: `main` / `/ (root)`.

## 3. Primer uso
Abre la URL de admin, edita lo que quieras: el primer guardado crea la fila en Supabase
(hasta entonces se muestra `data/sample.json`).

## Cambiar o revocar el token
Genera uno: `openssl rand -hex 16`. Su hash: `printf %s TOKEN | shasum -a 256`.
En SQL: `delete from admin_tokens; insert into admin_tokens values ('<hash>');`

## Notas
- Supabase Free pausa el proyecto tras ~1 semana sin actividad (se reactiva con un clic).
- Edición simultánea: gana el último guardado (un solo admin).
