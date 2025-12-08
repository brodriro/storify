# 📦 **PROMPT MAESTRO PARA PROYECTO NAS --- NestJS + Node.js + HBS + pnpm (TypeScript)**

## 🧭 **Contexto General del Proyecto**

Este proyecto consiste en la creación de un **gestor de archivos tipo
NAS**, construido con **Node.js**, **NestJS**, **TypeScript**, **HBS
como motor de plantillas**, y manejado con **pnpm**. Su finalidad es
proporcionar una solución ligera, modular, escalable y extensible para
administrar archivos de forma remota mediante una interfaz web
minimalista y moderna.

El proyecto debe: - Permitir **subir, eliminar, leer, listar, mover y
descargar archivos**. - Tener una **arquitectura limpia y mantenible**,
adecuada para NestJS. - Ofrecer autenticación por usuarios declarados en
variables de entorno. - Manejar roles: **public**, **moderator**,
**admin**. - Permitir tareas administrativas como **generación de
backups** y **visualización de estadísticas** del almacenamiento
mediante gráficos. - Administrar archivos en carpetas individuales para
cada usuario, con accesos restringidos. - Ser fácilmente extensible, de
modo que este prompt sirva como documento base para futuras mejoras.

# 🔧 **Requerimientos Técnicos**

### 1. Arquitectura limpia

El proyecto debe usar una arquitectura limpia y bien organizada: -
Modules separados por dominios. - Services, Controllers, Repositories,
Entities, DTOs. - Separación estricta de capas.

### 2. Gestión de dependencias

-   Se usa **pnpm**.
-   Todas las dependencias con **versiones exactas** (sin \^).

### 3. GIT obligatorio

-   Implementar control de versiones.
-   `.gitignore` completo para NestJS.
-   `.env` no debe ser rastreado.

### 4. Variables de entorno

Debe existir un `.env` y un `env_example`.\
Variables mínimas:

    PORT=
    STORAGE_PATH=/public/
    TOTAL_STORAGE_GB=
    ADMIN_EMAIL=
    USERS="ALICE,INVITADO,ADMIN"
    USER_ALICE=
    USER_INVITADO=
    USER_ADMIN=

### 5. Motor de plantillas HBS

Estructura requerida:

    /views/partials/header.hbs
    /views/partials/content.hbs
    /views/partials/footer.hbs

### 6. Carpeta pública

Los archivos estarán en `/public/`.

### 7. Carpeta por usuario

Cada usuario tendrá:

    /public/users/{USERNAME}/

Se crea automáticamente si no existe.\
El admin ve todo; los demás solo su carpeta.

# 📁 **Requerimientos Funcionales**

### 1. Gestión de archivos

-   Listar archivos y carpetas.
-   Subir, eliminar, descargar, mover.
-   Drag & drop.
-   Orden asc/desc por nombre o fecha.

### 2. Seguridad con .env

-   Usuarios listados en USERS.
-   Contraseñas con USER_USERNAME.
-   Se detectan automáticamente variables USER\_.

### 3. Roles

**public:** leer/descargar.\
**moderator:** leer/subir/mover/descargar.\
**admin:** todo + backups.

### 4. Manejo de duplicados

Si se sube un archivo existente: - Mostrar advertencia. - Guardar como
`archivo_duplicado`. - Si existe otro, `archivo_duplicado2`, etc.

### 5. Backups

-   El admin genera backups.
-   Notificación navegador + correo a ADMIN_EMAIL.

# 📊 **Dashboard Administrativo (Una sola página)**

Incluye: - Botón de backups. - Gráficos de tipos de archivo. - Gráfico
de almacenamiento. - Datos por usuario.

# 🎨 **Interfaz Web**

-   Minimalista.
-   Tema claro/oscuro con botón.
-   Responsive.

# 🌐 **Objetivo del Prompt**

Este prompt sirve como base completa para: - Generar código. - Mantener
coherencia. - Extender funcionalidad. - Guiar a futuros modelos en
mejoras del proyecto NAS.
