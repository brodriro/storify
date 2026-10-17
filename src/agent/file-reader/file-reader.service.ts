import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class FileReaderService {
  /**
   * Extracts plain text from .txt/.docx/.pdf. `filePath` must be an absolute
   * path already authorized through the access policy
   * (FileSystemService.resolveReadableFile); this service does no ACL checks.
   */
  async readFileContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    let content = '';

    try {
      if (ext === '.txt') {
        content = await fs.readFile(filePath, 'utf8');
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        content = result.value;
      } else if (ext === '.pdf') {
        const dataBuffer = await fs.readFile(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        content = result.text;
      } else {
        throw new InternalServerErrorException(`Unsupported file type: ${ext}`);
      }

      return this.cleanText(content);
    } catch (error) {
      Logger.error(
        `Error reading file ${filePath}: ${error.message}`,
        error.stack,
        'FileReaderService',
      );
      throw new InternalServerErrorException(
        `Failed to read file ${path.basename(filePath)}`,
      );
    }
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
