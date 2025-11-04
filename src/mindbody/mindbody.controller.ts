import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MindbodyService } from './mindbody.service';
import { MindBodyClientService } from './mindbody-client.service';
import { CheckCredentialsDto } from './dto/check-credentials.dto';
import { MindBodyCredentialResponse } from './dto/mindbody-response.dto';

@Controller('mindbody')
export class MindbodyController {
  constructor(
    private readonly mindbodyService: MindbodyService,
    private readonly mindbodyClientService: MindBodyClientService,
  ) {}

  @Post('check-credentials')
  @HttpCode(HttpStatus.OK)
  async checkCredentials(
    @Body(ValidationPipe) checkCredentialsDto: CheckCredentialsDto,
  ): Promise<MindBodyCredentialResponse> {
    return this.mindbodyService.checkCredentials(checkCredentialsDto);
  }

  @Post('add-client')
  @HttpCode(HttpStatus.OK)
  async addClientToEmr(
    @Body(ValidationPipe) body: { patientId: string; practiceId: string },
  ): Promise<{ success: boolean; clientId?: string; error?: string }> {
    try {
      const clientId = await this.mindbodyClientService.ensureClientExists(
        body.patientId,
        this.mindbodyService,
      );

      if (clientId) {
        return { success: true, clientId };
      } else {
        return {
          success: false,
          error: 'Failed to create or retrieve client ID',
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
