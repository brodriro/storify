# 🤖 Clasificación Automática de Archivos

## Descripción General

El sistema de **Clasificación Automática** analiza archivos dentro del NAS y genera una clasificación inteligente basada en:

- **Metadata** del archivo (nombre, tipo MIME, tamaño, fechas)
- **Contenido extraído** (para `.txt`, `.docx`, `.pdf`)
- **Estructura actual** del NAS (carpetas existentes)

El resultado es un JSON estructurado con categoría, subcategoría, nivel de sensibilidad, etiquetas, nombre/ruta sugeridos y acciones recomendadas.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────┐
│                  FileSystemController                │
│                POST /files/classify                  │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│              ClassificationService                   │
│  1. Resuelve archivo en disco                        │
│  2. Obtiene metadata (stat, MIME)                    │
│  3. Extrae texto (FileReaderService)                 │
│  4. Obtiene estructura de carpetas del NAS           │
│  5. Construye prompt de clasificación                │
│  6. Llama a LlmService.classifyFile()               │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│                    LlmService                        │
│  classifyFile() → OpenAI GPT (JSON mode)             │
└──────────────────────────────────────────────────────┘
```

El feature también está integrado como **herramienta del agente chat** (`classify_file`), para que el asistente NAS pueda clasificar archivos por solicitud en lenguaje natural.

---

## Uso vía API REST

### Endpoint

```
POST /files/classify
```

### Headers

| Header          | Valor                  |
|-----------------|------------------------|
| Authorization   | Bearer `<JWT_TOKEN>`   |
| Content-Type    | application/json       |

### Request Body

```json
{
  "path": "ADMIN/documentos/factura_2026.pdf"
}
```

> `path` es la ruta **relativa** del archivo dentro de `public_storage/users/`.

### Response (éxito)

```json
{
  "success": true,
  "classification": {
    "category": "Finanzas",
    "subcategory": "Factura",
    "confidence_score": 92,
    "is_sensitive": true,
    "sensitivity_reason": "Contiene datos de cuenta bancaria y montos financieros",
    "suggested_filename": "factura_proveedor_marzo_2026.pdf",
    "suggested_path": "ADMIN/finanzas/facturas/2026/",
    "tags": ["factura", "finanzas", "proveedor", "2026", "sensible"],
    "actions": [
      {
        "type": "move",
        "reason": "Mover a carpeta organizada por año dentro de finanzas"
      },
      {
        "type": "rename",
        "reason": "Renombrar con formato descriptivo estandarizado"
      },
      {
        "type": "flag",
        "reason": "Marcar como sensible por contener datos bancarios"
      }
    ],
    "summary": "Factura de proveedor con datos financieros sensibles. Se recomienda mover a una estructura organizada y marcar como confidencial."
  }
}
```

### Response (error)

```json
{
  "success": false,
  "error": "Missing \"path\" in request body"
}
```

---

## Uso vía Chat (Agente NAS)

El agente de chat tiene acceso a la herramienta `classify_file`. Puedes pedirle en lenguaje natural:

- *"Clasifica el archivo ADMIN/backup_2026.tar.gz"*
- *"Analiza qué tipo de documento es DINA/contrato_alquiler.pdf"*
- *"¿Qué categoría tiene el archivo ADMIN/foto_vacaciones.jpg?"*

El agente automáticamente invocará la clasificación y te devuelve el resultado formateado.

---

## Tipos de Archivos Detectados

| Tipo               | Extensiones Soportadas                    |
|--------------------|-------------------------------------------|
| Documentos         | `.txt`, `.pdf`, `.docx`, `.doc`           |
| Hojas de cálculo   | `.xls`, `.xlsx`, `.csv`                   |
| Presentaciones     | `.ppt`, `.pptx`                           |
| Imágenes           | `.jpg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.heic` |
| Video              | `.mp4`, `.webm`, `.ogg`, `.mov`           |
| Audio              | `.mp3`, `.wav`, `.flac`                   |
| Comprimidos        | `.zip`, `.tar`, `.gz`, `.rar`, `.7z`      |
| Código fuente      | `.ts`, `.js`, `.py`, `.java`, `.sh`, `.sql` |
| Datos              | `.json`, `.xml`, `.html`, `.css`          |

> **Extracción de texto** solo disponible para `.txt`, `.docx` y `.pdf`. Otros tipos se clasifican únicamente por metadata.

---

## Detección de Datos Sensibles

El agente analiza el contenido extraído para detectar patrones de:

- **DNI / Documentos de identidad**
- **Números de cuentas bancarias (IBAN, etc.)**
- **Tokens y claves API**
- **Contraseñas y credenciales**
- **Información personal identificable (PII)**

Cuando se detectan, `is_sensitive` retorna `true` con una explicación en `sensitivity_reason`.

---

## Categorías de Clasificación

El agente puede asignar categorías como:

| Categoría        | Subcategorías Ejemplo                      |
|------------------|--------------------------------------------|
| Documento Legal  | Contrato, Licencia, Acuerdo, NDA           |
| Finanzas         | Factura, Recibo, Estado de cuenta, Nómina  |
| Software         | Código fuente, Configuración, Dependencias |
| Multimedia       | Fotografía, Video, Audio, Diseño           |
| Personal         | Imagen personal, Documento ID              |
| Backup           | Respaldo completo, Respaldo incremental    |
| Temporal         | Archivo temporal, Cache, Log               |

---

## Acciones Sugeridas

| Acción    | Descripción                                |
|-----------|--------------------------------------------|
| `move`    | Mover archivo a la ruta sugerida           |
| `rename`  | Renombrar con el nombre sugerido           |
| `flag`    | Marcar como sensible/importante            |
| `index`   | Agregar a índice de búsqueda               |
| `archive` | Archivar (comprimir o mover a backup)      |

---

## Archivos del Feature

| Archivo | Descripción |
|---------|-------------|
| `src/agent/interfaces/classification.interface.ts` | Interfaces TypeScript para request/response |
| `src/agent/classification/classification.service.ts` | Servicio orquestador de clasificación |
| `src/agent/classification/classification.module.ts` | Módulo NestJS del feature |
| `src/agent/llm/llm.service.ts` | Método `classifyFile()` (llamada LLM) |
| `src/filesystem/filesystem.controller.ts` | Endpoint `POST /files/classify` |
| `src/agent/agent.service.ts` | Tool `classify_file` para el agente chat |

---

## Ejemplo cURL

```bash
# 1. Obtener token JWT
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ADMIN","password":"123456"}' | jq -r '.access_token')

# 2. Clasificar un archivo
curl -X POST http://localhost:3000/files/classify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path": "ADMIN/mi_documento.pdf"}'
```
