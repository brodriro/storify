# Storify · Sistema de diseño

Describe lo que el código aplica hoy. Si cambias la interfaz, actualízalo en el mismo commit. El contexto de producto (quién lo usa y para qué) está en `PRODUCT.md`, en la raíz.

## Carácter

Una consola de NAS profesional. El dueño de un homelab busca, ordena y comparte archivos y comprueba el estado del servidor de un vistazo, así que la interfaz prima la densidad y la legibilidad sobre la decoración. Superficies grafito separadas por bordes de 1 px, un solo acento azul, tablas con cifras tabulares. Sustituye a la identidad "NAS técnico" (verde sobre pizarra, títulos en Fira Code) y a la dirección «Hoja de datos», que se descartó (PR #15).

Principios:
- **Nada falso.** No hay navegación ni datos de relleno: si algo aparece, funciona.
- **El estado se lee antes de actuar.** El uso del almacenamiento está arriba en el explorador, con su nivel; la vista previa y las filas muestran tamaño y fecha.
- **Un acento con un significado.** El azul marca acciones primarias, enlaces, carpetas, la ubicación actual y la selección. El rojo, solo lo destructivo y el almacenamiento crítico; el ámbar, el aviso de almacenamiento.
- **Sombras solo para lo que flota** (menús, diálogos, avisos, chat). Los paneles se separan con bordes. Sin desenfoques ni brillos.
- **El teclado es un ciudadano de primera.** Todo lo que se hace con el ratón se puede hacer con el teclado o en una pantalla táctil.
- **Sin dependencias de Internet.** Fuentes y librerías se sirven desde el propio servidor.

## Archivos

| Archivo | Contenido |
|---|---|
| `public/css/tokens.css` | Colores, espaciado, radios, escala tipográfica y medidas, por tema. Los componentes no usan colores literales. |
| `public/css/fonts.css` | `@font-face` de Fira Sans y Fira Code (latin y latin-ext), servidas desde `/vendor/fira-*`. |
| `public/css/style.css` | Componentes por secciones: base, iconos, botones, shell, páginas, migas de pan, medidor, barra de herramientas, área de archivos, lista, cuadrícula, menús, vacío y paginación, selección, diálogos, avisos, login, dashboard, movimiento, táctil, pantallas pequeñas. |
| `public/css/chat.css` | Widget del asistente; solo se carga con sesión. |
| `views/partials/` | `sidebar` (navegación y cuenta, con sesión), `header` (barra superior sin sesión), `fileMenu` (menú ⋯, compartido por lista y cuadrícula). |
| `src/i18n/es.ts` | Todos los textos de la interfaz (decisión D5). |

No hay estilos inline ni bloques `<style>` en las vistas: la CSP es `style-src 'self'`. Un test e2e lo comprueba.

## Tema

`html[data-theme="light"|"dark"]`. Lo fija `public/js/theme.js` en `<head>`, antes de pintar la página, a partir de la elección guardada o, si no la hay, de `prefers-color-scheme` (y sigue los cambios del sistema hasta que la persona elige). Sin JavaScript, una media query aplica el tema del sistema. El botón "Tema oscuro" es un interruptor con `aria-pressed`.

## Color

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `--bg` | Fondo de la página | `#f3f4f6` | `#101317` |
| `--surface` | Barra lateral, paneles, tablas, diálogos | `#ffffff` | `#171b20` |
| `--surface-sunken` | Cajas de miniatura, pista del segmentado | `#eef0f3` | `#0c0f12` |
| `--surface-hover` | Hover de filas, enlaces y botones | `#e9ecf0` | `#222830` |
| `--surface-selected` | Filas seleccionadas, sección actual, vista actual | `#e5edf9` | `#1b2a40` |
| `--border` | Bordes y separadores; pista de los medidores | `#dde1e6` | `#2a3038` |
| `--border-strong` | Bordes de controles (campos, botones secundarios) | `#6b7380` | `#7b8490` |
| `--text` / `--text-muted` | Texto principal / secundario | `#15181d` / `#525a66` | `#e7e9ec` / `#9ba3ae` |
| `--accent` / `--on-accent` | Botón primario, carpetas, relleno del medidor | `#1f5fbf` / blanco | `#5c9bef` / `#0a1628` |
| `--accent-text` | Enlaces, elemento actual | `#1d58b0` | `#7fb1f3` |
| `--danger` / `--danger-text` | Acciones destructivas, almacenamiento ≥ 90 % | `#b42318` | `#e5484d` / `#ff8b8b` |
| `--warning` | Almacenamiento ≥ 75 % | `#b25e09` | `#e0a03a` |
| `--focus-ring` | Anillo de foco | `#1f5fbf` | `#7fb1f3` |

**Contraste (WCAG AA):** `src/ui/contrast.spec.ts` comprueba en cada tema el texto (4,5:1) sobre fondo, superficie, hover y selección, y los elementos no textuales (3:1): bordes de controles, foco, y los rellenos de acento, aviso y peligro sobre la superficie y sobre la pista. También que el bloque sin JavaScript coincide con el tema oscuro.

## Tipografía

- Todo en `--font-sans` (Fira Sans), títulos incluidos, con peso 600. `--font-mono` (Fira Code) solo para etiquetas de tipo (`PNG`, `.pdf`) y código en el chat.
- Escala para una herramienta densa: `--text-xs` 12 px (metadatos), `--text-sm` 13 px (cabeceras de tabla, migas), `--text-md` 14 px (tablas, controles), cuerpo 15 px, `--text-lg` 16 px (títulos de panel), `--text-xl` 20 px (cifras), `--text-2xl` 24 px (título de página).
- Cifras tabulares en tamaños, fechas, porcentajes y totales.
- Un único `h1` por página: el nombre de la carpeta en el explorador, "Panel de administración" en el dashboard, "Iniciar sesión" en el login. Paneles y diálogos usan `h2`.

## Medidas

- Espaciado: `--space-xs` (4 px) a `--space-2xl` (48 px).
- Radios: `--rounded-sm` 4 px, `--rounded-md` 6 px (controles), `--rounded-lg` 8 px (paneles, tarjetas, diálogos).
- Barra lateral: `--sidebar-width` 232 px. Filas de la lista: `--row-height` 48 px (miniatura de 32 px).
- Objetivos: con ratón, botones de 36 px (32 px los pequeños), ⋯ de 32 px, casillas de 18-20 px. Con puntero grueso (`pointer: coarse`) todos los controles llegan a 44 px y las casillas a 24 px (WCAG 2.5.8).
- Botón flotante del chat: `--fab-size` y `--fab-offset` (56 px y 24 px; 52 px y 16 px en pantallas pequeñas). Todo lo que se ancla abajo (avisos, barra de selección en móvil, panel del chat, el final del contenido) deja `--fab-clearance` para no taparlo.

## Estructura

- **Con sesión:** barra lateral fija a la izquierda (marca, navegación "Archivos" / "Administración" con `aria-current="page"`, y abajo la cuenta: usuario, rol, tema, cerrar sesión) y el contenido a la derecha. Por debajo de 900 px la barra lateral pasa a ser una barra superior; por debajo de 640 px, la marca y los controles de la cuenta (solo icono, con el texto como nombre accesible) van en la primera línea y la navegación en la segunda.
- **Sin sesión:** barra superior con la marca y el tema, y el formulario centrado.
- **Cabecera de página:** migas de pan pequeñas encima del título y, a la derecha, el medidor de almacenamiento.

## Componentes y patrones de interacción

- **Medidor de almacenamiento**: `<progress>` nativo con etiqueta, porcentaje y "usado de total · libres". El nivel lo calcula el servidor (`usageLevel`: `ok`, `warning` desde el 75 %, `critical` desde el 90 %) y cambia el relleno a ámbar o rojo.
- **Barra de herramientas**: acciones primarias a la izquierda (Subir, Nueva carpeta); a la derecha, en cuadrícula, el orden (selector + sentido) y el segmentado Lista / Cuadrícula (dos enlaces, el actual con `aria-current`). La vista se guarda en la cookie `browserView`.
- **Lista**: `<table>` con casilla, Nombre, Tamaño, Modificado y Tipo. Las cabeceras ordenables son enlaces con `aria-sort` (la activa cambia de sentido; otra empieza ascendente por nombre y descendente por tamaño y fecha). La casilla de la cabecera selecciona todo y muestra el estado intermedio. La fila de "Carpeta superior" va primero; el pie (`tfoot`) da los totales. Las carpetas son enlaces y los archivos botones (abren la vista previa). En móvil se ocultan Tamaño, Modificado y Tipo y su información pasa a una línea bajo el nombre.
- **Cuadrícula**: tarjetas con una caja de 4:3 para la miniatura o el icono (los archivos sin miniatura muestran su extensión), nombre en 2 líneas como máximo y tamaño. La casilla y ⋯ aparecen al pasar el ratón o al enfocar; sin ratón (`hover: none`) están siempre visibles. Debajo, la misma línea de totales.
- **Menú ⋯**: patrón *menu button* de WAI-ARIA. Enter o flecha abajo lo abren con el foco en la primera opción; las flechas, Inicio y Fin recorren las opciones; Escape lo cierra y devuelve el foco al botón.
- **Diálogos**: `<dialog>` nativo con `showModal()`, que da el foco atrapado, el cierre con Escape y el resto de la página inerte. Al cerrarse, el foco vuelve al elemento. Los avisos y confirmaciones son un formulario, así que Enter confirma. El botón de confirmar es rojo cuando la acción es destructiva. La vista previa muestra tamaño y fecha (los bytes exactos en el `title`).
- **Mover**: arrastrar es un atajo de ratón (filas o tarjetas sobre carpetas o "Carpeta superior"). ⋯ → Mover (o la selección → Mover) abre un selector de carpetas: migas de pan, subcarpetas como botones (flechas para recorrerlas, Retroceso para subir de nivel) y "Mover aquí", que se desactiva explicando el motivo en una región `status`.
- **Selección**: barra flotante con el recuento, Mover, Eliminar y Cancelar.
- **Avisos (toasts)**: `role="status"` o `role="alert"` según el tipo; 3 s (6 s los errores).
- **Dashboard**: paneles con borde; el de uso combina cifras (`<dl>`) y el medidor; uso por carpeta y tipos de archivo son tablas con la cifra alineada a la derecha.
- **Chat**: panel lateral `inert` mientras está cerrado; Escape lo cierra. La conversación es un `role="log"` con `aria-live`.

## Movimiento

Una sola curva, `--ease-out`, en `--transition-fast` (150 ms) y `--transition-medium` (250 ms), solo en color, fondo, opacidad y los giros de los indicadores de orden. Las transiciones enumeran sus propiedades, nunca `all`. No hay animación de entrada de página ni elevación al pasar el ratón. Con `prefers-reduced-motion: reduce` nada se desliza ni gira; los avisos y el panel del chat aparecen con un fundido y los puntos de "escribiendo…" laten en opacidad.

## Textos

En español (decisión D5), todos en `src/i18n/es.ts`. Las vistas usan `{{t "clave" param=valor}}` y los scripts `t('clave', { param })`. `src/i18n/i18n.spec.ts` falla si una clave no existe o si queda texto de interfaz fuera del catálogo. El tono es directo y neutro en género.

## Revisión

Detector de impeccable (`impeccable detect`) sobre `views/` y `public/` sin hallazgos. Sobre el HTML renderizado quedan avisos aceptados: la tabla va a ras del borde de su panel (las celdas llevan su padding), el segmentado tiene un inset de 2 px, los puntos de "escribiendo…" solo laten mientras se espera una respuesta real, y el damero de la vista previa es el fondo para imágenes con transparencia.
