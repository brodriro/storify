# Storify - File Manager NAS (NestJS)

Aplicación construida con NestJS para gestionar un "mini NAS" multiusuario:

- Navegador de archivos web.
- Carga, previsualización y descarga de archivos.
- Cuotas por usuario y estadísticas globales de almacenamiento.
- Panel de administración con backups.

El backend está escrito con NestJS y renderiza vistas Handlebars.

---

## Finalidad del proyecto

Este proyecto resuelve un escenario típico de almacenamiento compartido en una red local:

- Todos los usuarios comparten un **directorio raíz común** bajo `users/`.
- Cada usuario tiene **su propia carpeta** (`users/<username>`) donde puede crear subcarpetas, subir, mover, renombrar y borrar archivos.
- Los usuarios **no admin**:
  - Pueden ver el contenido general del root (archivos sueltos y carpetas "globales").
  - No pueden entrar en carpetas cuyo nombre coincida con otro usuario registrado.
  - Pueden ver y gestionar completamente su propia carpeta de usuario.
- El usuario **admin** puede ver y gestionar **todo**.

Además, el admin dispone de un **dashboard** donde puede:

- Ver estadísticas de uso global (tamaño total, número de archivos, uso por usuario, tipos de archivo) en MB.
- Ver un desglose de archivos que no pertenecen a ningún usuario directo bajo la categoría `OTROS`.
- Lanzar la creación de un backup ZIP único del árbol `users/` (en segundo plano, sin bloquear) y descargar el último backup disponible.

La interfaz incluye:

- Navegador de archivos con drag & drop para subir archivos.
- Movimiento de archivos arrastrando sobre carpetas o sobre una "card" especial para subir de nivel.
- Previsualización de imágenes y vídeos.

La documentación funcional más detallada se encuentra en `docs/base.md`.

---

## Requisitos

- Node.js 18+ (recomendado).
- pnpm como gestor de paquetes.

---

## Configuración de entorno

El proyecto se configura principalmente mediante variables de entorno:

```bash
USERS="ADMIN,usuario1,usuario2"     # lista separada por comas
USER_ADMIN="admin_password"        # contraseña del usuario ADMIN
USER_usuario1="password1"          # ejemplo de usuario normal
USER_usuario2="password2"

STORAGE_PATH="./public"           # raíz física donde se creará la carpeta users/
TOTAL_STORAGE_GB="5"               # tamaño total de almacenamiento para el dashboard
ADMIN_EMAIL="admin@storify.local" # usado para notificaciones de backup

JWT_SECRET="cambia_esto_en_prod"  # secreto para las cookies JWT
PORT="3000"                        # puerto HTTP
```

Notas importantes:

- El árbol de almacenamiento efectivo queda como: `<STORAGE_PATH>/users/...`.
- Bajo ese directorio se crean:
  - `users/<username>` para cada usuario configurado.
  - Carpetas adicionales "globales" que no correspondan a ningún usuario.
  - Carpeta `backups/` para los ZIP generados por el panel de admin.

---

## Puesta en marcha en desarrollo

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Crear un fichero `.env` en la raíz del proyecto (opcional pero recomendado) con las variables del apartado anterior.

3. Arrancar en modo desarrollo (watch):

   ```bash
   pnpm run start:dev
   ```

4. Acceder a la aplicación:

   - Navegador de archivos: `http://localhost:3000/files/browser`
   - Login: `http://localhost:3000/auth/login`
   - Dashboard admin (solo usuario con rol `admin`): `http://localhost:3000/admin/dashboard`

---

## Despliegue en producción

### 1. Build

Generar el código compilado en `dist/`:

```bash
pnpm run build
```

### 2. Arranque en modo producción

Una vez compilado:

```bash
pnpm run start:prod
```

o, si prefieres usar directamente Node sobre el build:

```bash
node dist/main.js
```

Asegúrate de que las mismas variables de entorno usadas en desarrollo estén presentes en el entorno de producción (por ejemplo, mediante un `.env` gestionado por tu sistema de procesos o variables del sistema).

### 3. Servir detrás de un reverse proxy (opcional, recomendado)

En un entorno real se recomienda colocar la app detrás de un proxy como Nginx o Traefik que:

- Termine TLS (HTTPS).
- Redirija el tráfico a `http://localhost:3000` (o el puerto configurado en `PORT`).
- Aplique límites de tamaño de subida acordes a los ficheros que esperas manejar.

Ejemplo simplificado de `location` en Nginx:

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 4. Permisos de ficheros

Asegúrate de que el usuario del sistema que ejecuta Node tenga permisos de lectura/escritura sobre `STORAGE_PATH`, incluyendo:

- `STORAGE_PATH/users/**`
- `STORAGE_PATH/backups/**`

En caso contrario, las operaciones de subida, borrado o backup fallarán.

---

## Flujo de uso resumido

1. El admin configura usuarios mediante las variables `USERS` y `USER_<username>`.
2. Cada usuario inicia sesión con su `username` y contraseña.
3. Desde el navegador de archivos puede:
   - Ver su carpeta de usuario y otros ficheros globales permitidos.
   - Subir y gestionar archivos con drag & drop.
   - Mover archivos entre carpetas (incluyendo subir de nivel arrastrando a la card de puntos suspensivos).
4. El admin entra al dashboard para:
   - Revisar estadísticas de uso.
   - Generar y descargar backups.

---

## Licencia

Este proyecto está basado en el starter de NestJS y se distribuye bajo licencia MIT.

