import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { LlmService } from '../llm/llm.service';
import { FileReaderService } from '../file-reader/file-reader.service';
import { FileClassificationRequest, FileClassificationResponse } from '../interfaces/classification.interface';

const MIME_MAP: Record<string, string> = {
    '.txt': 'text/plain', '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.xml': 'application/xml', '.csv': 'text/csv',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
    '.heic': 'image/heic', '.heif': 'image/heif',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
    '.zip': 'application/zip', '.tar': 'application/x-tar', '.gz': 'application/gzip',
    '.rar': 'application/vnd.rar', '.7z': 'application/x-7z-compressed',
    '.iso': 'application/x-iso9660-image',
    '.ts': 'text/typescript', '.py': 'text/x-python', '.java': 'text/x-java',
    '.sh': 'application/x-sh', '.sql': 'application/sql',
};

@Injectable()
export class ClassificationService {
    private readonly logger = new Logger(ClassificationService.name);
    private baseStoragePath: string;

    constructor(
        private readonly llmService: LlmService,
        private readonly fileReaderService: FileReaderService,
        private readonly configService: ConfigService,
    ) {
        this.baseStoragePath = this.configService.get<string>('storagePath') ?? './public_storage';
    }

    /**
     * Classify a single file within the NAS.
     * @param relativePath - path relative to public_storage/users/, e.g. "ADMIN/docs/invoice.pdf"
     */
    async classifyFile(relativePath: string): Promise<FileClassificationResponse> {
        // Normalize: strip common prefixes that tools like list_documents_by_name may include
        relativePath = relativePath
            .replace(/^\.?\/?(public_storage\/)?users\//, '')
            .replace(/^\.?\//, '');

        const fullPath = path.join(this.baseStoragePath, 'users', relativePath);

        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
            throw new NotFoundException(`File not found: ${relativePath}`);
        }

        const stats = fs.statSync(fullPath);
        const filename = path.basename(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = MIME_MAP[ext] || 'application/octet-stream';

        // Attempt text extraction for supported document types
        let extractedText = '';
        const textExtractable = ['.txt', '.docx', '.pdf'];
        if (textExtractable.includes(ext)) {
            try {
                extractedText = await this.fileReaderService.readFileContent(fullPath);
                // Truncate to avoid exceeding token limits
                if (extractedText.length > 4000) {
                    extractedText = extractedText.substring(0, 4000) + '\n... [truncated]';
                }
            } catch (error) {
                this.logger.warn(`Could not extract text from ${relativePath}: ${error.message}`);
                extractedText = '[No se pudo extraer texto]';
            }
        } else {
            extractedText = '[Tipo de archivo no soportado para extracción de texto]';
        }

        // Get current folder structure (top 2 levels)
        const folderStructure = this.getFolderStructure(
            path.join(this.baseStoragePath, 'users'),
            2,
        );

        const formatSize = (bytes: number): string => {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };

        const request: FileClassificationRequest = {
            filename,
            current_path: relativePath,
            size: formatSize(stats.size),
            created_at: stats.birthtime.toISOString(),
            modified_at: stats.mtime.toISOString(),
            mime_type: mimeType,
            extracted_text: extractedText,
            custom_metadata: JSON.stringify({
                extension: ext,
                sizeBytes: stats.size,
            }),
            existing_folder_structure: folderStructure,
        };

        this.logger.log(`Classifying file: ${relativePath}`);
        return this.llmService.classifyFile(this.buildPrompt(request));
    }

    private buildPrompt(req: FileClassificationRequest): string {
        return `Eres un agente experto en clasificación automática de archivos dentro de un sistema NAS.

Tu objetivo es analizar archivos y decidir:

1. Categoría principal  
2. Subcategoría  
3. Nivel de confidencialidad  
4. Etiquetas relevantes  
5. Nombre recomendado  
6. Ruta recomendada dentro del NAS  
7. Acciones sugeridas (mover, renombrar, indexar, marcar como sensible)

Debes:

- Basarte en metadata y contenido.
- Priorizar organización lógica y consistente.
- Detectar si el archivo es:
  - Documento legal
  - Factura
  - Proyecto de software
  - Imagen personal
  - Multimedia
  - Backup
  - Archivo temporal
- Detectar posibles datos sensibles (DNI, cuentas bancarias, tokens, claves).
- Responder exclusivamente en formato JSON válido.
- No agregar texto fuera del JSON.

Analiza el siguiente archivo del NAS y genera una clasificación inteligente.

Archivo:
- Nombre: ${req.filename}
- Ruta actual: ${req.current_path}
- Tamaño: ${req.size}
- Fecha creación: ${req.created_at}
- Fecha modificación: ${req.modified_at}
- Tipo MIME: ${req.mime_type}

Contenido extraído (si aplica):
${req.extracted_text}

Metadata adicional:
${req.custom_metadata}

Estructura actual del NAS:
${req.existing_folder_structure}

Devuelve respuesta en este formato exacto:

{
  "category": "",
  "subcategory": "",
  "confidence_score": 0-100,
  "is_sensitive": true/false,
  "sensitivity_reason": "",
  "suggested_filename": "",
  "suggested_path": "",
  "tags": [],
  "actions": [
    {
      "type": "move|rename|flag|index|archive",
      "reason": ""
    }
  ],
  "summary": ""
}`;
    }

    /**
     * Returns a textual representation of the folder structure up to maxDepth levels deep.
     */
    private getFolderStructure(dirPath: string, maxDepth: number, currentDepth: number = 0): string {
        if (!fs.existsSync(dirPath) || currentDepth >= maxDepth) return '';

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            const indent = '  '.repeat(currentDepth);
            let result = '';

            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                if (entry.isDirectory()) {
                    result += `${indent}📁 ${entry.name}/\n`;
                    result += this.getFolderStructure(
                        path.join(dirPath, entry.name),
                        maxDepth,
                        currentDepth + 1,
                    );
                }
            }

            return result;
        } catch {
            return '';
        }
    }
}
