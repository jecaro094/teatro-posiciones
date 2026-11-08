# Despliegue gratuito: GitHub Pages + Supabase

Una sola web, dos enlaces secretos (el código es el mismo; lo que cambia es el token):
- **Elenco (solo lectura):** `https://<usuario>.github.io/<repo>/?v=<TOKEN_ELENCO>`
- **Admin (lectura y edición):** `https://<usuario>.github.io/<repo>/?k=<TOKEN_ADMIN>`

Sin ningún token la web no muestra datos. Los tokens se entregan a mano y no están en el repo.

## Cómo funciona el acceso
- Los datos (elenco + escenas) viven en una fila JSON de Supabase. Las tablas están cerradas (RLS, sin permisos para `anon`).
- Todo pasa por funciones SQL que validan el token en el servidor (`docs/supabase.sql`):
  `get_state` y `get_version` (elenco o admin), `save_state` (solo admin), `is_admin`.
- En la tabla `admin_tokens` solo se guarda el **sha256** de cada token, con su rol (`viewer` o `admin`).
- Al abrir el enlace, el token se guarda en el navegador y se quita de la barra de direcciones:
  - Admin (`?k=`): `sessionStorage`, clave `teatro:k` (se olvida al cerrar la pestaña).
  - Elenco (`?v=`): `localStorage`, clave `teatro:v` (queda recordado en ese móvil).
- `js/config.js` contiene la URL del proyecto y la clave *publishable*. Ambas son públicas por diseño.
  **Nunca** pongas ahí la clave `secret` / `service_role`.

## 1. Supabase
1. Crea un proyecto en supabase.com (plan Free). Deja activo el Data API y la RLS automática.
2. SQL Editor → pega `docs/supabase.sql` → Run. Es idempotente: se puede repetir tras cada actualización del repo.
3. Genera los dos tokens y sus hashes (ver más abajo) y sustituye los dos `insert` del final del SQL por los tuyos.
4. Project Settings → API: copia **Project URL** y la clave **publishable** en `js/config.js`.
5. Activa 2FA en tu cuenta de Supabase y de GitHub.

## 2. GitHub Pages
1. Sube los cambios a `main` (el repo debe ser público en el plan gratuito).
2. Settings → Pages → Source: `main` / `/ (root)`.

## 3. Primer uso
Abre el enlace de admin y edita lo que quieras: el primer guardado crea la fila en Supabase
(hasta entonces se muestra `data/sample.json`, con nombres ficticios).

## Uso del modo admin
- Arrastrar círculos para colocarlos; editar número, nombre, personaje y tipo en la lista del elenco.
- Panel **Escenas y copias**: cambiar título y notas, crear escena nueva, reordenar (↑/↓) y borrar.
- **Copias de seguridad:** «Descargar copia» baja un JSON con todo; «Restaurar copia» lo sube y reemplaza
  los datos (valida la estructura y pide confirmación). La copia contiene los nombres reales:
  guárdala en un sitio privado y no la subas al repo.

## Actualización automática del elenco
La vista del elenco consulta `get_version` cada 20 s (solo con la pestaña visible) y recarga los datos si el
admin ha guardado cambios. El modo admin no se actualiza solo, para no pisar lo que se está editando.
Coste: unos pocos KB por petición, muy por debajo del límite gratuito.

## Crear, cambiar o revocar tokens
Genera uno aleatorio de 128 bits y su hash:

```sh
TOKEN=$(openssl rand -hex 16); echo "$TOKEN"; printf %s "$TOKEN" | shasum -a 256
```

En el SQL Editor (cambia `'viewer'` por `'admin'` según el caso):

```sql
delete from admin_tokens where role = 'viewer';
insert into admin_tokens (token_hash, role) values ('<hash>', 'viewer');
```

Al borrar un token, los enlaces antiguos dejan de funcionar al instante. Los datos que alguien ya hubiera visto no se pueden "des-ver".
Rota el token de elenco si se filtra o al acabar la temporada.

## Seguridad: resumen
- Es seguro tener el repo público: no hay tokens en claro ni claves secretas, solo hashes de tokens de 128 bits.
- Quien clone el repo y cree su propio Supabase obtiene una copia vacía, no tus datos.
- Riesgos que quedan: reenvío del enlace de elenco, fuga del enlace de admin, datos en claro en Supabase
  (protegidos por tu cuenta, con 2FA), y abuso de cuota (afecta a disponibilidad, no a confidencialidad).
- Usa solo nombres de pila en el elenco si quieres minimizar el impacto de una filtración.

## Notas
- Supabase Free pausa el proyecto tras ~1 semana sin actividad (se reactiva con un clic en el panel).
- Edición simultánea: gana el último guardado (pensado para un solo admin).
- Pruebas en local: `python3 -m http.server 8765` y abrir `http://localhost:8765/?v=<TOKEN>` (o `?k=`).
  Con `SUPABASE_URL` vacío en `config.js`, la app funciona en modo local con `localStorage` y un botón de admin.
