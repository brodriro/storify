---
name: Storify
description: Gestor de archivos para un NAS doméstico, impreso como la hoja de datos de un componente.
colors:
  paper: "#ffffff"
  paper-sunken: "#f3f3f2"
  paper-hover: "#ececea"
  hairline: "#d6d6d3"
  ink: "#111111"
  ink-hover: "#333333"
  ink-muted: "#555555"
  control-border: "#6b6b6b"
  location-blue: "#1d4ed8"
  location-blue-deep: "#1e40af"
  location-blue-wash: "rgba(29, 78, 216, 0.09)"
  caution-red: "#b91c1c"
  caution-red-deep: "#991b1b"
  caution-red-wash: "rgba(185, 28, 28, 0.07)"
  overlay: "rgba(17, 17, 17, 0.45)"
  negative-paper: "#0e0f11"
  negative-paper-sunken: "#17191c"
  negative-paper-hover: "#1f2226"
  negative-hairline: "#2e3237"
  negative-rule: "#e8e8e6"
  negative-ink: "#ececea"
  negative-ink-hover: "#c9c9c6"
  negative-ink-muted: "#a2a6ad"
  negative-control-border: "#8b9098"
  negative-location-blue: "#7aa2ff"
  negative-location-blue-text: "#8fb0ff"
  negative-location-blue-hover: "#a3bfff"
  negative-on-blue: "#0b1220"
  negative-caution-red: "#dc2626"
  negative-caution-red-text: "#f87171"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0"
    fontVariation: "'wdth' 72"
    fontFeature: "'tnum'"
  wordmark:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 72"
  figure-code:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.04em"
    fontVariation: "'wdth' 72"
  headline:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    fontVariation: "'wdth' 72"
  body:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  body-row:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    fontFeature: "'tnum'"
  button:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 87"
  label:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 87"
  type-code:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 72"
  code:
    fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
rounded:
  none: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-hover}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.caution-red}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-danger-hover:
    backgroundColor: "{colors.caution-red-deep}"
    textColor: "{colors.paper}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 8px"
    height: "32px"
  segment-current:
    backgroundColor: "{colors.location-blue-wash}"
    textColor: "{colors.location-blue}"
    rounded: "{rounded.none}"
    padding: "0 8px"
    height: "32px"
  type-code:
    textColor: "{colors.ink}"
    typography: "{typography.type-code}"
    rounded: "{rounded.none}"
    padding: "1px 5px"
    width: "40px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  spec-row:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-row}"
    padding: "0 8px"
    height: "46px"
  spec-row-hover:
    backgroundColor: "{colors.paper-hover}"
  spec-row-selected:
    backgroundColor: "{colors.location-blue-wash}"
  caution-box:
    backgroundColor: "{colors.caution-red-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 16px 16px"
  menu-item-danger:
    textColor: "{colors.caution-red}"
    padding: "0 16px"
    height: "40px"
---

# Design System: Storify

Describe lo que el código aplica hoy, el mundo "Hoja de datos". Sustituye al sistema anterior (verde sobre pizarra oscura con Fira), retirado por completo. Si cambias la interfaz, actualiza este archivo en el mismo commit. Los tokens del encabezado son normativos; la fuente de verdad de los valores es `public/css/tokens.css`.

## Overview

**Creative North Star: "La hoja de datos del componente"**

Cada carpeta es la hoja de datos de un componente: su contenido y su estado, medidos y tabulados. La página es papel blanco con una sola tinta casi negra, filetes de 1 px y un gris para la tinta secundaria. La cabecera es un membrete con el logotipo, el título del documento (el nombre de la carpeta), una referencia (la ruta) y un bloque de revisión (usuario, rol, fecha). Debajo vienen la tabla de capacidad, la fila de acciones y la carpeta como tabla de especificaciones; en cuadrícula, como figuras numeradas ("Fig. n · JPG"). El dashboard sigue el mismo modelo con tablas de características, y el login es la portada de la hoja.

Es una herramienta de experto: densa, rápida de escanear y nunca rellena. El color no decora. Hay dos colores de señal y cada uno tiene un único trabajo: el azul marca dónde estás y qué está seleccionado, y el rojo marca precaución (cajas PRECAUCIÓN y acciones destructivas). Las acciones primarias son de tinta sólida. Esquinas rectas, sin sombras y sin desenfoque: la profundidad se expresa con filetes. El tema oscuro es el negativo de la misma hoja, no un sistema aparte.

Se rechaza explícitamente el patrón por defecto de la categoría: un dashboard oscuro de tarjetas con un acento de neón.

**Key Characteristics:**
- Una familia (Archivo variable) con dos anchos: condensado para membrete, referencias y códigos de tipo; normal para leer.
- Cifras tabulares en todas partes.
- Filetes como única fuente de jerarquía y profundidad.
- Azul solo para ubicación y selección; rojo solo para precaución.
- Códigos de tipo (DIR, PDF, JPG) como número de pieza de cada fila.
- Escala de tamaño fija y logarítmica, comparable entre carpetas.
- Tema oscuro como negativo de impresión.

## Colors

Tinta sobre papel, con dos tintas de señal de uso restringido.

### Primary
- **Azul de ubicación** (`location-blue`; negativo `negative-location-blue`, texto `negative-location-blue-text`): la miga de pan actual (`aria-current`), el segmento de vista activo, la selección (fondo `location-blue-wash`, casilla marcada, contorno de figura seleccionada), el contorno de arrastrar y soltar, el botón del chat abierto, la selección de texto, el cursor de texto y el anillo de foco. Nunca en un botón de acción.

### Secondary
- **Rojo de precaución** (`caution-red`, `caution-red-deep`; negativo `negative-caution-red`, texto `negative-caution-red-text`): el botón de confirmar una acción destructiva, la opción "Eliminar" de los menús, la caja PRECAUCIÓN del asistente, el mensaje de error del login y el icono de los avisos de error. El fondo lavado (`caution-red-wash`) acompaña siempre a un borde o a un texto rojo.

### Neutral
- **Papel** (`paper`; negativo `negative-paper`): fondo de página y de superficies. Página y superficie tienen el mismo valor: los paneles no se distinguen por tono, sino por filetes.
- **Papel hundido** (`paper-sunken`): fondo de miniaturas, iconos de fila, mensajes del usuario en el chat y bloques de código.
- **Papel de hover** (`paper-hover`): hover de filas, opciones de menú y botones secundarios; el damero de la vista previa.
- **Filete fino** (`hairline`): reglas interiores, entre filas de una tabla o de una lista.
- **Tinta** (`ink`; negativo `negative-ink` para texto y `negative-rule` para filetes): texto, filetes de sección y relleno de los botones primarios y del botón del chat. En los tokens, la tinta del texto es `--text` y la de los filetes es `--rule`; en claro coinciden y en el negativo se separan ligeramente.
- **Tinta secundaria** (`ink-muted`): etiquetas, encabezados de columna, fechas, totales, metadatos.
- **Borde de control** (`control-border`): el borde que identifica un control (campos, casillas, botones secundarios, códigos de tipo, menú ⋯), siempre a 3:1 o más.
- **Velo** (`overlay`): fondo de los `<dialog>` modales.

### Named Rules
**La regla de un trabajo por color.** El azul significa "estás aquí / esto está seleccionado" y el rojo significa "precaución". Ningún otro elemento usa color; si algo nuevo necesita destacar, lo hace con peso, ancho o un filete.

**La regla de la tinta única.** Las acciones primarias (Subir, Entrar, enviar en el chat, el botón del chat) son bloques de tinta sólida con texto de papel. El azul está reservado para la ubicación y no sirve para llamar a la acción.

**La regla del negativo.** El tema oscuro invierte la misma hoja. Sus valores viven dos veces en `tokens.css`, en `:root[data-theme='dark']` y en el bloque sin JavaScript (`@media (prefers-color-scheme: dark)` sobre `:root:not([data-theme])`), y los dos deben coincidir. `src/ui/contrast.spec.ts` comprueba el contraste WCAG AA de los pares de tokens en ambos temas (4,5:1 para texto, 3:1 para bordes de control, iconos y foco) y que el bloque sin JavaScript coincide con el tema oscuro. Ejecútalo después de tocar un color. `tokens.css` es el único lugar con valores de color: los componentes usan nombres semánticos.

## Typography

**Display Font:** Archivo Variable, ancho condensado (con 'Helvetica Neue', Arial, sans-serif)
**Body Font:** Archivo Variable, ancho normal (con 'Helvetica Neue', Arial, sans-serif)
**Label/Mono Font:** Archivo Variable al 87 % de ancho para etiquetas; `ui-monospace` solo para código en las respuestas del asistente

**Character:** una sola familia que cambia de ancho como cambia la tipografía de una hoja técnica: condensada y negra en el membrete y los códigos, semicondensada en versalitas para las etiquetas y normal para leer. Archivo variable (pesos 100-900, ancho 62-125 %) se sirve desde el propio servidor bajo `/vendor/archivo/` (`public/css/fonts.css`, subconjuntos latin y latin-ext), sin CDN ni Google Fonts: la interfaz funciona sin Internet. Los anchos son tokens: `--stretch-condensed` (72 %) y `--stretch-semi` (87 %).

### Hierarchy
- **Display** (700, `clamp(2rem, 1.4rem + 2vw, 3rem)`, 1; 1,875rem en móvil): el título del documento, es decir, el nombre de la carpeta o el título de la página. Es el único `<h1>` de la página.
- **Wordmark** (800, 1,5rem, mayúsculas, 0,02em): el logotipo del membrete.
- **Figure code** (800, 2,25rem, 1): el código de tipo que ocupa el lugar de la imagen en las figuras sin miniatura. La cifra grande del dashboard usa el mismo registro (700, 2,5rem).
- **Headline** (700, 1,125rem): títulos de diálogo, de las tablas del dashboard y del chat (`<h2>`).
- **Body** (400, 1rem, 1,5): texto corrido. Las filas y los nombres usan 0,9375rem, y los metadatos, de 0,8125 a 0,875rem.
- **Button** (600, 0,875rem, 0,01em, ancho 87 %): botones y segmentos (0,8125rem en los compactos).
- **Label** (600, 0,75rem, 0,06em, MAYÚSCULAS, ancho 87 %, tinta secundaria): encabezados de columna, `dt` del bloque de revisión y de las tablas de datos, leyenda de figura, "Ref.", "Ordenar por", etiquetas de formulario, la leyenda de la escala. Siempre es la etiqueta de un dato o de un control, en su misma línea o celda.
- **Type code** (700, 0,75rem, 0,06em, ancho 72 %): el número de pieza dentro de su caja de filete.

### Named Rules
**La regla de las cifras tabulares.** `font-variant-numeric: tabular-nums` se aplica en `body` y lo hereda todo: tamaños, fechas, contadores y totales se alinean en columna. Las fechas usan el formato ordenable `AAAA-MM-DD HH:MM`, y los bytes exactos, separadores de miles.

**La regla del ancho como voz.** Lo condensado nombra (membrete, títulos, códigos), lo semicondensado etiqueta y lo normal se lee. No se usa una segunda familia para crear jerarquía.

## Layout

La página es una sola hoja centrada (`max-width` 1480 px, margen lateral de 32 px; 16 px en móvil). El orden vertical es fijo: membrete, cabecera de la hoja (título y referencia a la izquierda, tabla de capacidad a la derecha, en una rejilla `1fr auto`), fila de acciones (Subir y Nueva carpeta a la izquierda y primero en el orden de lectura y de tabulación; selector de vista y orden a la derecha) y el cuerpo. El cuerpo deja `--fab-clearance` de margen inferior para que el botón del chat no tape la última fila.

- **Ritmo:** la escala de espaciado (de 4 a 48 px) es la única fuente de márgenes. Las filas de la tabla miden 46 px, la cabecera 36 px y el pie de totales 44 px.
- **Lista:** una tabla de especificaciones con `table-layout: fixed` y columnas de ancho fijo: selección 44 px, tipo 72 px, tamaño 168 px (alineado a la derecha, con la barra de escala), fecha 152 px y acciones 52 px. Los totales de la carpeta van en el `tfoot`.
- **Cuadrícula:** figuras en `repeat(auto-fill, minmax(180px, 1fr))` con 24 px de separación, cada una con una caja de 4:3 y un pie bajo un filete de tinta. Los totales van en una línea bajo un filete.
- **900 px:** el bloque de revisión pasa a una segunda línea del membrete y la capacidad baja bajo el título, a todo el ancho.
- **640 px:** presupuesto del primer viewport, con la primera fila de archivo dentro de unos 420 px. El membrete se compacta (filete superior de 4 px y etiquetas de botón solo para lectores de pantalla), la capacidad se convierte en una línea de pares etiqueta-valor más la barra, y la fila de acciones ocupa todo el ancho. Cada fila de la tabla pasa a ser una rejilla (selección · nombre · ⋯), y el tipo, el tamaño, la barra de escala y la fecha vuelven como una línea bajo el nombre. La cuadrícula baja a 2 columnas, y la barra de selección se ancla a los bordes por encima de `--fab-clearance`.
- **Botón flotante del chat:** `--fab-size` y `--fab-offset` (56 px y 32 px; 52 px y 16 px en móvil). Todo lo que se ancla abajo (avisos, barra de selección en móvil, panel del chat) deja `--fab-clearance` para no taparlo ni tapar su objetivo.

## Elevation & Depth

El sistema es plano: no hay sombras ni `backdrop-filter`. Los tokens `--shadow-*` valen `none` en los dos temas. La profundidad y la jerarquía se expresan con el grosor y la tinta del filete. Las superficies superpuestas (diálogos, barra de selección, panel del chat) se separan de la hoja con un filete de tinta de 2 px, y el velo de los diálogos con `--overlay`. Los menús y los avisos usan un filete de tinta de 1 px. La sombra interior de la casilla marcada (`inset 0 0 0 4px` de papel) no es elevación: es el margen blanco que deja el relleno dentro de la caja impresa.

### Named Rules
**La regla del filete.** Cada grosor tiene un significado: 1 px de `hairline` separa filas; 1 px de tinta abre y cierra secciones (cabecera de la hoja, encabezado y pie de la tabla, menús, avisos, pie de figura); 2 px de tinta delimitan lo que flota sobre la hoja o abre una tabla del dashboard; 6 px de tinta (4 px en móvil) es el filete superior del membrete y de la portada del login. No se añade un grosor nuevo sin un significado nuevo.

## Shapes

Todo es rectangular. Todas las esquinas miden 0: los tokens `--rounded-*` valen 0 y botones, campos, casillas, menús, diálogos, barras y el botón del chat tienen `border-radius: 0`. Las formas se dibujan con filetes, no con rellenos: el código de tipo es una caja de filete, la casilla es un cuadrado de filete que se rellena al marcarla, y las barras de uso y de escala son rectángulos de tinta sin redondear. Los iconos son SVG en línea, con trazo de 1,75 (1,25 en el tamaño grande) y remates y uniones rectos (`stroke-linecap: square`, `stroke-linejoin: miter`), en 18 px, 15 px o 44 px. El estado vacío y la zona de soltar usan un borde discontinuo.

## Components

### Buttons
Bloques de tinta y filete, firmes y sin adorno.
- **Shape:** esquinas rectas (0), 40 px de alto (32 px en los compactos `btn-sm` y de icono) y 16 px de relleno horizontal. Con puntero grueso, todos llegan a 44 px (`--target-min`).
- **Primary:** tinta sólida con texto de papel; en hover pasa a `ink-hover`.
- **Secondary / Ghost:** papel con borde de control y texto de tinta; en hover, `paper-hover`.
- **Danger:** rojo de precaución con texto blanco; solo para confirmar una acción destructiva.
- **Quiet:** transparente, para los controles del membrete (tema, administración, cerrar sesión). El interruptor de tema es un `aria-pressed` y, pulsado, muestra el borde de control.
- **Hover / Focus:** las transiciones enumeran `background-color`, `border-color` y `color` en `--transition-fast` (120 ms). El foco es un único estilo global: contorno de 2 px de `--focus-ring` separado 2 px. Deshabilitado: opacidad 0,5.

### Chips
- **Código de tipo:** caja de filete con el borde de control, texto condensado de 700, mínimo 40 px. Las carpetas son `DIR`, los archivos llevan su extensión en mayúsculas (máximo 4 caracteres) y lo que no tiene extensión lleva `—`. La carpeta superior usa `..`. El selector de carpetas de Mover repite el mismo código (`DIR`) delante de cada subcarpeta.
- **Selector de vista (segmentado):** dos segmentos separados por un filete dentro de un borde de control. El segmento actual (`aria-current`) usa el lavado azul y el texto azul.

### Cards / Containers
- **Corner Style:** recto (0).
- **Background:** papel; las cajas de imagen, papel hundido.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** la figura de la cuadrícula tiene una caja de 4:3 con filete fino, que pasa a tinta al pasar el ratón o al enfocar, y un pie bajo un filete de tinta con "Fig. n · CÓDIGO", el nombre (como mucho 2 líneas) y el tamaño. Seleccionada, lleva un contorno azul de 2 px por dentro. Las tablas del dashboard abren con un filete de tinta de 2 px y un título bajo un filete de 1 px, y sus filas son pares `dt`/`dd` separados por filetes finos.
- **Internal Padding:** 8 px entre filas de datos y 24 px en los diálogos.

### Inputs / Fields
- **Style:** borde de control de 1 px, fondo de papel, esquinas rectas y 44 px de alto. La etiqueta va encima, en el registro de etiqueta.
- **Focus:** el borde pasa a tinta y se añade el anillo de foco global. En el chat, el anillo se dibuja en el contenedor y el `textarea` no lleva contorno propio, para que no se duplique.
- **Error:** caja con borde y texto en rojo de precaución sobre el lavado rojo, con `role="alert"`.
- **Casilla de selección:** 24 px (WCAG 2.5.8), dibujada con `appearance: none`: un cuadrado de filete que se rellena de azul al marcarse.

### Navigation
- **Membrete:** logotipo (enlace a la carpeta inicial), bloque de revisión (`<dl>` con celdas separadas por filetes finos y la etiqueta encima del valor) y controles de cuenta en un `<nav>`, todo entre el filete de 6 px y uno de 1 px.
- **Referencia (migas de pan):** "Ref." más la ruta en un `<nav>` con `<ol>`, separadas por `/` en tinta secundaria. Los enlaces van subrayados (1 px, 2 px en hover) y la carpeta actual lleva `aria-current="page"`, en azul, de 600 y sin subrayado.
- **Encabezados de tabla:** enlaces de orden con una flecha que aparece al pasar el ratón o cuando el orden está activo; la flecha gira 180° en orden descendente. En móvil, el orden se elige con el `<select>` de la fila de acciones.

### Barra de escala de tamaño
Cada archivo lleva un `<meter>` de 56 px sobre una escala logarítmica fija de décadas, de 1 B a 1 TB (0 a 12, `SIZE_SCALE_MAX` en `src/files/browser-view.ts`). La misma longitud significa el mismo tamaño en cualquier carpeta. El pie de la tabla muestra la leyenda "Escala 1 B – 1 TB". El relleno es de tinta secundaria sobre filete fino, nunca de color.

**La regla de la escala fija.** La escala no se normaliza por carpeta. Si una vista nueva compara tamaños, usa la misma escala logarítmica fija.

### Capacidad
Una tabla con "Capacidad" como `caption`, columnas Usado / Libre / Total y un `<progress>` nativo de 6 px (relleno de tinta dentro de un filete de tinta) con el porcentaje. Se comparte como parcial entre el navegador y el dashboard.

### Menú ⋯
Un botón de 32 px (44 px con puntero grueso) con el icono SVG de tres puntos, que sigue el patrón *menu button* de WAI-ARIA: Enter o flecha abajo lo abren con el foco en la primera opción; las flechas, Inicio y Fin recorren las opciones; Escape lo cierra y devuelve el foco al botón. La lista tiene un filete de tinta, opciones de 40 px separadas por filetes finos y "Eliminar" en rojo de precaución con el lavado rojo en hover. Con ratón, la casilla y ⋯ aparecen al pasar por encima o al enfocar (y siempre en modo selección). Sin ratón (`hover: none`) están siempre visibles: no hay acciones que dependan del hover.

### Barra de selección
Fija, centrada abajo y con un filete de tinta de 2 px. Muestra el recuento (`aria-live`) y las acciones. Cuando hay un solo elemento seleccionado, muestra su línea de ficha (código, tamaño y fecha). En móvil se ancla a los bordes por encima de `--fab-clearance`.

### Diálogos
`<dialog>` nativo con `showModal()`, que atrapa el foco, se cierra con Escape y deja inerte el resto de la página. Al cerrarse, el foco vuelve al elemento de origen. Tienen un filete de tinta de 2 px, una cabecera bajo un filete de tinta y un pie de botones bajo un filete fino. La vista previa añade una línea de metadatos bajo el título, un damero detrás de la imagen y botones anterior/siguiente de 44 px. Los avisos y confirmaciones son formularios, así que Enter confirma, y el botón de confirmar es rojo si la acción es destructiva. Mover abre un selector de carpetas con migas de pan, subcarpetas como botones (las flechas las recorren y Retroceso sube de nivel) y "Mover aquí". El botón se desactiva y explica el motivo en una región `status` cuando no hay permiso, cuando el elemento ya está en esa carpeta o cuando se intentaría mover una carpeta dentro de sí misma. Arrastrar es solo un atajo de ratón.

### Caja PRECAUCIÓN (asistente)
Cada cambio que propone el agente llega como una caja con filete rojo de 2 px sobre el lavado rojo. Lleva la etiqueta "Precaución" (condensada, 800, mayúsculas, 0,08em), el texto, la lista de acciones y los botones para aprobar o rechazar. Una vez decidida queda al 60 % de opacidad. Es el único lugar del chat donde aparece el rojo.

### Panel del asistente
Un panel fijo con filete de tinta de 2 px, anclado sobre el botón del chat (un cuadrado de tinta de 56 px, azul cuando está abierto). Está `inert` mientras está cerrado y Escape lo cierra. La conversación es un `role="log"` con `aria-live`. Los mensajes del usuario van en caja de papel hundido con filete fino, y los del asistente entre un filete de tinta arriba y uno fino abajo, con una etiqueta en versalitas encima. El contenido del modelo pasa por `DOMPurify.sanitize(marked.parse(...))`. Solo se renderiza con sesión.

### Avisos (toasts)
Una caja de papel con filete de tinta de 1 px, anclada a la derecha por encima de `--fab-clearance`, que entra deslizándose en 200 ms. Usan `role="status"` o `role="alert"` según el tipo y duran 3 s (6 s los errores). El icono de error va en rojo de precaución.

### Movimiento
Una sola curva, `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`), en `--transition-fast` (120 ms) y `--transition-medium` (200 ms). Las transiciones enumeran las propiedades que animan, nunca `all`. Las páginas y los diálogos entran con un fundido de opacidad. Con `prefers-reduced-motion: reduce` nada se desliza ni gira: los avisos y el panel del chat solo se funden, las flechas de orden no rotan con transición, los puntos de "escribiendo…" laten en opacidad en vez de en escala y no hay scroll suave.

## Do's and Don'ts

### Do:
- **Do** usa solo los tokens semánticos de `public/css/tokens.css`: es el único archivo con valores de color. Mantén sincronizados el tema claro, el oscuro y el bloque sin JavaScript, y ejecuta `src/ui/contrast.spec.ts` (WCAG AA) después de cambiar un color.
- **Do** expresa jerarquía y profundidad con filetes: 1 px fino entre filas, 1 px de tinta en secciones, 2 px de tinta en lo que flota y 6 px en el membrete.
- **Do** reserva el azul para la ubicación y la selección, y el rojo para la precaución y las acciones destructivas.
- **Do** haz las acciones primarias de tinta sólida (`ink` con texto `paper`).
- **Do** mantén las cifras tabulares, las fechas `AAAA-MM-DD HH:MM` y la escala de tamaño logarítmica fija de 1 B a 1 TB.
- **Do** etiqueta los datos con el registro de etiqueta (0,75rem, 600, mayúsculas, 0,06em, ancho 87 %) en la misma celda o línea que el dato.
- **Do** dibuja los iconos como SVG en línea con trazo de 1,75 y remates rectos, con `aria-hidden="true"` y un nombre accesible en el control.
- **Do** da 44 px a todos los objetivos con `pointer: coarse` y 24 px como mínimo a la casilla de selección. Deja `--fab-clearance` en todo lo que se ancle abajo.
- **Do** conserva los patrones de accesibilidad: las carpetas son enlaces y los archivos son botones que cubren la fila o la figura; ⋯ es un *menu button* de WAI-ARIA; los diálogos son `<dialog>` nativos con `showModal()`; el chat está `inert` cuando está cerrado; hay un único `<h1>` por página dentro del `<main id="main">` del layout.
- **Do** pon todos los textos en español en `src/i18n/es.ts` (decisión D5), con un tono neutro en género.
- **Do** sirve las fuentes y las librerías desde el propio servidor (Archivo en `/vendor/archivo/`).

### Don't:
- **Don't** redondees esquinas, añadas sombras ni uses `backdrop-filter` o desenfoque.
- **Don't** uses el azul en botones de acción ni el rojo como decoración o para estados que no sean de precaución.
- **Don't** escribas colores literales fuera de `tokens.css`, estilos inline, atributos `style=""` ni bloques `<style>`: la CSP es `style-src 'self'` y un test e2e lo comprueba.
- **Don't** introduzcas una segunda familia tipográfica para crear jerarquía. Archivo cambia de ancho y de peso; el monoespaciado es solo para código.
- **Don't** normalices la barra de tamaño por carpeta.
- **Don't** pongas acciones que solo aparecen con hover en dispositivos sin hover.
- **Don't** animes `all` ni conserves movimiento con `prefers-reduced-motion: reduce`: solo se permiten fundidos de opacidad.
- **Don't** uses caracteres tipográficos (×, !, flechas de texto) como iconos: los iconos son SVG.
- **Don't** cargues fuentes ni scripts desde un CDN o Google Fonts.
