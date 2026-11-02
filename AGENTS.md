# Teatro Posiciones — guía para agentes

## Qué es
Web móvil sencilla para gestionar posiciones de un elenco de teatro amateur (<15 personas, <15 escenas).
Cada persona tiene un número asignado; cada escena tiene un plano de escenario con los números colocados.

## Reglas de producto
- **Elenco (solo lectura):** con el enlace elige escena y ve el plano. Toca un círculo → nombre.
- **Admin (único que edita):** gestiona elenco (número/nombre), escenas (crear/duplicar/borrar) y arrastra círculos.
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
- Despliegue previsto: **Artifact de Claude** (opción 1). Los datos compartidos necesitan backend; mantener `storage.js` como única capa de persistencia para poder migrar a Firebase/Supabase.
- La seguridad de edición no puede depender solo del cliente: la contraseña/permiso admin debe validarse en el backend.
- Mantenerlo simple: no añadir frameworks sin necesidad.

## Pendiente (TODO)
Selector de escenas, lista de elenco, notas, arrastrar y soltar, CRUD de admin, persistencia compartida, autenticación admin.
