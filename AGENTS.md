# Teatro Posiciones — guía para agentes

## Qué es
Web móvil sencilla para gestionar posiciones de un elenco de teatro amateur (<15 personas, <15 escenas).
Cada persona tiene un número asignado; cada escena tiene un plano de escenario con los números colocados.

## Reglas de producto
- **Elenco (solo lectura):** con el enlace elige escena y ve el plano. Toca un círculo → nombre.
- **Admin (único que edita):** gestiona elenco (número/nombre), escenas (crear/renombrar/reordenar/borrar) y arrastra círculos.
- Plano: rectángulo con fondo arriba y público abajo, círculos numerados, posiciones en % (x,y).
- Opcional: notas por escena, exportar a imagen/PDF.

## Stack
HTML + CSS + JS (módulos ES) sin dependencias ni build. Mobile-first, botones ≥44px, modo claro/oscuro con variables CSS.

## Estructura
- `index.html` — página única
- `css/styles.css` — estilos y tokens de tema
- `js/app.js` — arranque; `stage.js` — plano; `admin.js` — modo admin; `storage.js` — capa de datos
- `data/sample.json` — datos de ejemplo (elenco + escenas + posiciones)
- `docs/` — notas de diseño

## Decisiones y límites
- Despliegue: **GitHub Pages** (web estática) + **Supabase** (datos). Ver `docs/despliegue.md`.
- `storage.js` es la única capa de persistencia (Supabase por RPC con token; sin `SUPABASE_URL`, `localStorage`/`sample.json`).
- La seguridad de edición se valida en el servidor: funciones SQL `SECURITY DEFINER` que comprueban el sha256 del token
  (`docs/supabase.sql`). Las tablas no son accesibles directamente. Acceso por enlace: `?v=` (elenco, lectura) y `?k=` (admin).
- Nunca commitear tokens en claro ni claves `secret`/`service_role`. `js/config.js` solo lleva URL y clave publishable.
- El elenco se actualiza solo (polling de `get_version` cada 20 s); el admin no, para no pisar ediciones.
- Mantenerlo simple: no añadir frameworks sin necesidad.

## Interfaz
- Tema Addams (gótico elegante), claro y oscuro vía variables CSS. Plano: cortinas (fondo), tablado y foso de butacas (público).
- Navegación: barra fija inferior (‹ · «Acto · Escena / Posición n/m» · ›); tocar el centro abre la hoja «Ir a…» (toda la obra por acto/escena). Deslizar sobre el plano también cambia de posición.
- Elenco: «¿Quién eres?» se pregunta una vez (`teatro:asked`), resalta tu círculo y tu fila; «Solo donde salgo» está desactivado por defecto. Botón Nombres/Números (`teatro:names`). Tocar una fila localiza su círculo.
- Los círculos son `<button>` de 44 px. Cortinas de carga solo la primera vez por sesión.
- Admin: círculos arrastrables (imán al eje central; flechas del teclado mueven 1 %, Mayús 5 %), indicador de guardado con reintento
  (escrituras serializadas), borrar/mover con «Deshacer» en vez de `confirm()`, errores en toast (no `alert`). Paneles plegables:
  «Esta posición» (título, notas, +posición, copiar, mover, borrar) y «Obra: actos, escenas y copias» (numeración, nombres, +escena, backups JSON).

## Pendiente (TODO)
Exportar a imagen, dos columnas en escritorio, prueba manual en móvil real (los cambios de UX se probaron solo en Chrome de escritorio/headless).

## Tipos de círculo
Cada persona del elenco tiene `type`: `ancentros` (amarillo, por defecto si falta) o `addams` (morado). Se edita en modo admin desde la lista del elenco. Colores en `css/styles.css` (`--ancentros-*`, `--addams-*`).
