import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { LlmModule } from '../llm/llm.module';
import { FileReaderModule } from '../file-reader/file-reader.module';

@Module({
    imports: [LlmModule, FileReaderModule],
    providers: [ClassificationService],
    exports: [ClassificationService],
})
export class ClassificationModule { }
