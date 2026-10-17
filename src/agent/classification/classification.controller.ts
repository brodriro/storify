import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ClassificationService } from './classification.service';

/** Lives in the AI module so the core file browser doesn't depend on the LLM. */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class ClassificationController {
  constructor(private readonly classificationService: ClassificationService) {}

  @Post('classify')
  async classifyFile(
    @Body() body: { path?: unknown },
    @CurrentUser() user: AuthUser,
  ) {
    const classification = await this.classificationService.classifyFile(
      user,
      body.path,
    );
    return { success: true, classification };
  }
}
