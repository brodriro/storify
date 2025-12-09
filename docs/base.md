# 📦 **PROMPT MAESTRO PARA PROYECTO NAS --- NestJS + Node.js + HBS + pnpm (TypeScript)**

## 🧭 **Contexto General del Proyecto**

Este proyecto consiste en la creación de un **gestor de archivos tipo NAS**, construido con **Node.js**, **NestJS**, **TypeScript**, **HBS como motor de plantillas**, y manejado con **pnpm**. Su finalidad es proporcionar una solución ligera, modular, escalable y extensible para administrar archivos de forma remota mediante una interfaz web minimalista y moderna.

El proyecto implementado:
-   Permite **subir, eliminar, leer, listar, mover y descargar archivos**.
-   Tiene una **arquitectura limpia y mantenible**, basada en módulos (Auth, Filesystem, Admin, Notification).
-   Ofrece autenticación por usuarios declarados en variables de entorno (`USERS`).
-   Maneja roles: **public**, **moderator**, **admin**.
-   Permite tareas administrativas como **generación de backups** (ZIP) y **visualización de estadísticas** del almacenamiento.
-   Administra archivos en carpetas individuales para cada usuario en `/public/users/{USERNAME}/`.
-   Cuenta con un diseño **Premium** (Glassmorphism, Animaciones, Iconos SVG).

# 🔧 **Implementación Técnica**

### 1. Arquitectura limpia
El proyecto sigue una arquitectura modular de NestJS:
-   **AuthModule**: Estrategia JWT y Guards.
-   **FileSystemModule**: Lógica core de archivos (`fs` operations).
-   **AdminModule**: Dashboard y Backups (`archiver`).
-   **NotificationModule**: Servicio de notificaciones (Mock Email).

### 2. Gestión de dependencias
-   Se usa **pnpm**.
-   Dependencias clave: `@nestjs/common`, `hbs`, `archiver`, `cookie-parser`.

### 3. Estructura de Proyecto
-   Control de versiones con `.mb` y `.gitignore` optimizado.
-   Configuración mediante `.env` (seguro).

### 4. Variables de entorno
Variables implementadas:
```env
PORT=3000
STORAGE_PATH=./public/users
TOTAL_STORAGE_GB=10
ADMIN_EMAIL=admin@storify.local
USERS="ALICE,INVITADO,ADMIN"
USER_ALICE=...
```

### 5. Frontend (HBS + CSS)
-   Plantillas: `browser.hbs`, `dashboard.hbs`, `index.hbs`.
-   Partials: `header.hbs`.
-   **CSS Centralizado**: Todo el estilo se encuentra en `/public/css/style.css`.
-   **Iconografía**: Se utilizan Iconos SVG (Heroicons) en lugar de emojis.

### 6. Almacenamiento
-   Ruta base: `/public/users/{USERNAME}/`.
-   Prevención de Path Traversal estricta.

# 📁 **Funcionalidades**

### 1. Gestión de archivos
-   Listar archivos y carpetas con ordenamiento (Nombre/Fecha).
-   **Subir**: Drag & Drop con barra de progreso.
-   **Mover**: Funcionalidad explícita para trasladar archivos entre carpetas.
-   **Previsualización**: Modal para imágenes y videos sin descargar.

### 2. Seguridad
-   Roles implementados:
    -   **public**: Solo lectura.
    -   **moderator**: Gestión de archivos (Subir/Mover/Borrar).
    -   **admin**: Acceso global y Dashboard.

### 3. Manejo de duplicados
-   Detección automática de archivos existentes.
-   Renombrado automático: `archivo_duplicado.ext`.
-   **Feedback UI**: Alerta al usuario cuando un archivo es renombrado.

### 4. Backups y Notificaciones
-   Generación de ZIP de todo el directorio `users`.
-   **Notificación**: Se utiliza `NotificationService` para simular el envío de un correo al `ADMIN_EMAIL` (visible en logs).

# 📊 **Dashboard Administrativo**
-   Visualización de uso de disco total vs límite.
-   Gráfico de distribución por tipos de archivo.
-   Cuotas de uso por usuario.
-   Descarga directa de Backups.

# 🎨 **Interfaz Web**
-   Diseño **Glassmorphism** moderno.
-   Tema Claro/Oscuro persistente.
-   Totalmente Responsive.
-   Animaciones suaves (Fade-in, Slide-up).
