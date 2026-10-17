# Storify · Sistema de diseño

Describe lo que el código aplica hoy. Si cambias la interfaz, actualízalo en el mismo commit. Sustituye al antiguo `MASTER.md`, que era una plantilla generada ("Smart Home/IoT Dashboard") y describía un sistema distinto del aplicado.

## Carácter

Una herramienta de trabajo para un NAS doméstico o de equipo: hay que escanear, actuar sobre archivos y fiarse de lo que se ve. La identidad es "NAS técnico": verde sobre pizarra oscura, Fira Code en los títulos y Fira Sans en el texto (decisión D6). El tema claro se deriva del oscuro y no es un sistema aparte.

Principios:
- **Nada falso.** No hay navegación ni datos de relleno: si algo aparece, funciona (la barra lateral "Próximamente" y el "45 % de 1 TB" fijo se eliminaron).
- **El teclado es un ciudadano de primera.** Todo lo que se hace con el ratón se puede hacer con el teclado o en una pantalla táctil.
- **Sin dependencias de Internet.** Fuentes y librerías se sirven desde el propio servidor.

## Archivos

| Archivo | Contenido |
|---|---|
| `public/css/tokens.css` | Todos los colores y medidas, por tema. Los componentes no usan colores literales. |
| `public/css/fonts.css` | `@font-face` de Fira (latin y latin-ext), servidas desde `/vendor/fira-*`. |
| `public/css/style.css` | Componentes, ordenados por secciones (base, iconos, botones, cabecera, migas de pan, cuadrícula, diálogos, avisos, login, dashboard, movimiento, pantallas pequeñas). |
| `public/css/chat.css` | Widget del asistente; solo se carga con sesión. |
| `src/i18n/es.ts` | Todos los textos de la interfaz (decisión D5). |

No hay estilos inline ni bloques `<style>` en las vistas: la CSP es `style-src 'self'`. Un test e2e lo comprueba.

## Tema

`html[data-theme="light"|"dark"]`. Lo fija `public/js/theme.js` en `<head>`, antes de pintar la página, a partir de la elección guardada o, si no la hay, de `prefers-color-scheme` (y sigue los cambios del sistema hasta que la persona elige). Sin JavaScript, una media query aplica el tema del sistema. El botón "Tema oscuro" es un interruptor con `aria-pressed`.

## Color

Tokens semánticos (valores en `tokens.css`):

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `--bg` | Fondo de la página | `#f8fafc` | `#020617` |
| `--surface` | Paneles, tarjetas, diálogos | `#ffffff` | `#0f172a` |
| `--surface-hover` | Hover de filas y botones | `#f1f5f9` | `#1e293b` |
| `--border` | Bordes decorativos | `#e2e8f0` | `#1e293b` |
| `--border-strong` | Bordes de controles (campos, checkbox, botones secundarios) | `#64748b` | `#64748b` |
| `--text` / `--text-muted` | Texto principal / secundario | `#0f172a` / `#475569` | `#f8fafc` / `#94a3b8` |
| `--accent` / `--on-accent` | Botón primario y su texto | `#15803d` / blanco | `#22c55e` / `#052e16` |
| `--accent-text` | Enlaces y títulos de acento | `#15803d` | `#4ade80` |
| `--danger` / `--danger-text` | Acciones destructivas | `#b91c1c` | `#dc2626` / `#f87171` |
| `--focus-ring` | Anillo de foco | `#15803d` | `#4ade80` |

**Contraste (WCAG AA):** `src/ui/contrast.spec.ts` comprueba 20 combinaciones de texto y de controles en cada tema (4,5:1 en texto, 3:1 en bordes de controles, iconos y foco), y que el bloque sin JavaScript coincide con el tema oscuro. El verde del master (`#22c55e`) con texto blanco da 2,28:1; por eso en claro el acento es `#15803d` (5,02:1) y en oscuro el texto sobre el verde es casi negro (6,54:1).

## Tipografía

- Texto: `--font-sans` (Fira Sans 400/500/600/700).
- Títulos (`h1`-`h3`), nombres en diálogos y código: `--font-mono` (Fira Code 400/500/600).
- Un único `h1` por página (título de la página); las tarjetas del dashboard y los diálogos usan `h2`.

## Medidas

- Espaciado: `--space-xs` (4 px) a `--space-2xl` (48 px).
- Radios: `--rounded-sm` 6 px, `--rounded-md` 10 px, `--rounded-lg` 16 px; tarjetas de archivo 12 px; botones 8 px.
- Objetivos táctiles: `--target-min` 44 px para botones normales; 36 px en botones pequeños y en ⋯; 24 px en la casilla de selección (WCAG 2.5.8).

## Superficies y profundidad

Paneles y tarjetas son sólidos. El desenfoque (`backdrop-filter`) se reserva para superficies superpuestas únicas: fondo de los diálogos, chat, menú abierto y avisos. Nunca se aplica a elementos repetidos, porque doscientas tarjetas con desenfoque hacen que el scroll vaya a tirones en GPU modestas. Sombras: `--shadow-sm` a `--shadow-xl`, más intensas en el tema oscuro.

## Componentes y patrones de interacción

- **Tarjeta de archivo**: el control principal ocupa toda la tarjeta; es un enlace en las carpetas y un botón (abre la vista previa) en los archivos. Encima van la casilla de selección y el botón ⋯. Con ratón aparecen al pasar por encima o al enfocar; sin ratón (`hover: none`) están siempre visibles.
- **Menú ⋯**: patrón *menu button* de WAI-ARIA. Enter o flecha abajo lo abren con el foco en la primera opción; las flechas, Inicio y Fin recorren las opciones; Escape lo cierra y devuelve el foco al botón.
- **Diálogos**: `<dialog>` nativo con `showModal()`, que da el foco atrapado, el cierre con Escape y el resto de la página inerte. Al cerrarse, el foco vuelve a la tarjeta. Los avisos y confirmaciones son un formulario, así que Enter confirma. El botón de confirmar es rojo cuando la acción es destructiva.
- **Mover**: arrastrar es un atajo de ratón; el camino con teclado o en pantalla táctil es ⋯ → Mover, o la selección múltiple → Mover.
- **Migas de pan**: `<nav>` con enlaces y `aria-current="page"` en la carpeta actual.
- **Avisos (toasts)**: `role="status"` o `role="alert"` según el tipo; 3 s (6 s los errores).
- **Chat**: panel lateral `inert` mientras está cerrado; Escape lo cierra. La conversación es un `role="log"` con `aria-live`.
- **Barra de uso**: `<progress>` nativo.

## Movimiento

Una sola curva, `--ease-out` (exponencial), en `--transition-fast` (150 ms) y `--transition-medium` (250 ms). Las transiciones enumeran las propiedades que animan, nunca `all`. Con `prefers-reduced-motion: reduce` no hay animaciones de entrada, desplazamientos al pasar el ratón ni scroll suave.

## Textos

En español (decisión D5), todos en `src/i18n/es.ts`. Las vistas usan `{{t "clave" param=valor}}` y los scripts `t('clave', { param })`. `src/i18n/i18n.spec.ts` falla si una clave no existe o si queda texto de interfaz fuera del catálogo. El tono es directo y neutro en género ("Hola, {name}").
