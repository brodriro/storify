# 📦 **PROMPT MAESTRO PARA PROYECTO NAS --- NestJS + Node.js + HBS + pnpm (TypeScript)**

## 🧭 **Contexto General del Proyecto**

Este proyecto consiste en la creación de un **gestor de archivos tipo NAS**, construido con **Node.js**, **NestJS**, **TypeScript**, **HBS como motor de plantillas**, y manejado con **pnpm**. Su finalidad es proporcionar una solución ligera, modular, escalable y extensible para administrar archivos de forma remota mediante una interfaz web minimalista y moderna.

El proyecto implementado:
-   Permite **subir, eliminar, leer, listar, mover y descargar archivos**.
-   Tiene una **arquitectura limpia y mantenible**, basada en módulos (Auth, Filesystem, Admin, Notification).
-   Ofrece autenticación por usuarios declarados en variables de entorno (`USERS`).
-   Maneja roles: **public**, **moderator**, **admin**.
-   Permite tareas administrativas como **generación de backups** (ZIP) y **visualización de estadísticas** del almacenamiento.
-   Administra archivos en una **raíz compartida** `/public/users/` con carpetas individuales por usuario en `/public/users/{USERNAME}/`.
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
-   Ruta base física: `/public/users/` (raíz común para todos los usuarios).
-   Estructura lógica por usuario: `/public/users/{USERNAME}/`.
-   Prevención de Path Traversal estricta (validación de rutas y normalización en backend).

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
    
-   Reglas de visibilidad de archivos y carpetas:
    -   Todos los usuarios operan sobre la raíz compartida `/users`.
    -   Usuarios **no admin**:
        -   Solo pueden navegar dentro de su propia carpeta (`/users/{USERNAME}/`).
        -   No pueden listar ni acceder a carpetas de otros usuarios.
        -   Pueden operar sobre elementos sueltos ubicados directamente en la raíz `/users` (p. ej. archivos compartidos), siempre sin acceder a subcarpetas ajenas.
    -   Usuarios **admin**:
        -   Pueden ver y operar sobre todas las carpetas y archivos bajo `/users`.

-   Flujo de autenticación y cierre de sesión:
    -   Login mediante formulario en `/` que envía `POST /auth/login`.
    -   Tras login correcto se emite un JWT que se guarda en cookie (`jwt`) y se redirige al navegador de archivos (`/files/browser`).
    -   El logout (`/auth/logout`) limpia la cookie `jwt` y **redirige siempre al login** (`/`).

### 3. Manejo de duplicados
-   Detección automática de archivos existentes.
-   Renombrado automático: `archivo_duplicado.ext`.
-   **Feedback UI**: Alerta al usuario cuando un archivo es renombrado.

### 4. Backups y Notificaciones
-   Generación de ZIP de todo el directorio `users`.
-   **Notificación**: Se utiliza `NotificationService` para simular el envío de un correo al `ADMIN_EMAIL` (visible en logs).

# 📊 **Dashboard Administrativo**
-   Visualización de uso de disco total vs límite (`TOTAL_STORAGE_GB`), incluyendo:
    -   **Barra de uso** con porcentaje (`0–100%`) calculado según el total en bytes almacenados.
    -   Tamaño total agregado mostrado en **MB**.
-   Gráfico / listado de distribución por tipos de archivo.
-   Cuotas de uso por usuario (uso en bytes por cada `USERNAME`).
-   Descarga directa de Backups (ZIP completo del directorio `users`).
-   Para usuarios con rol **admin**:
    -   Acceso al dashboard desde el navegador de archivos mediante un botón "Admin Dashboard" en el header.
    -   Botón en el propio dashboard para **volver al navegador de archivos** (`/files/browser`).

# 🎨 **Interfaz Web**
-   Diseño **Glassmorphism** moderno.
-   Tema Claro/Oscuro persistente.
-   Totalmente Responsive.
-   Animaciones suaves (Fade-in, Slide-up).
-   Header común con:
    -   Botón de cambio de tema.
    -   Mensaje de bienvenida contextual: `Bienvenido {USERNAME}` para el usuario autenticado.
    -   Botón de **Logout** que limpia la cookie `jwt` y redirige al login.
