import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { CodeTourRequestDto, CodeTourResponseDto } from './dto/code-tour.dto';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('code-tour')
  async generateCodeTour(
    @Body() request: CodeTourRequestDto,
  ): Promise<CodeTourResponseDto> {
    if (!this.aiService.isAvailable()) {
      throw new HttpException(
        'AI service is not available. Please configure OPENAI_API_KEY.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const response = await this.aiService.generateCodeTour(request);
      return response;
    } catch (error) {
      throw new HttpException(
        `Failed to generate code tour: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Check if AI service is available
  @Post('status')
  getStatus(): { available: boolean } {
    return { available: this.aiService.isAvailable() };
  }
}
