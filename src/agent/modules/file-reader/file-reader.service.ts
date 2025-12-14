import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class FileReaderService {
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
      Logger.error(`Error reading file ${filePath}: ${error.message}`, error.stack, 'FileReaderService');
      throw new InternalServerErrorException(`Failed to read file ${filePath}`);
    }
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  async listDocumentsByName(searchName: string): Promise<string[]> {
    const directoryPath = path.join('./public_storage', 'users');
    const matchingDocuments: string[] = [];

    try {
      await this.findDocumentsRecursively(directoryPath, searchName, matchingDocuments);
      return matchingDocuments;
    } catch (error) {
      Logger.error(`Error listing documents in ${directoryPath}: ${error.message}`, error.stack, 'FileReaderService');
      throw new InternalServerErrorException(`Failed to list documents in ${directoryPath}`);
    }
  }

  private async findDocumentsRecursively(directory: string, searchName: string, matchingDocuments: string[]): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.findDocumentsRecursively(fullPath, searchName, matchingDocuments);
      } else if (entry.isFile() && entry.name.toLowerCase().includes(searchName.toLowerCase()) && !entry.name.startsWith('.')) {
        matchingDocuments.push(fullPath);
      }
    }
  }
}
