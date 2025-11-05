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
  ): Promise<{
    success: boolean;
    clientId?: string;
    staffId?: string | number;
    error?: string;
  }> {
    try {
      const clientId = await this.mindbodyClientService.ensureClientExists(
        body.patientId,
        this.mindbodyService,
      );

      // Get practice to extract staffId from connectorConfig
      const practice = await this.mindbodyClientService.getPracticeStaffId(
        body.practiceId,
      );

      if (clientId) {
        return {
          success: true,
          clientId,
          staffId: practice?.staffId,
        };
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

  @Post('book-appointment')
  @HttpCode(HttpStatus.OK)
  async bookAppointment(
    @Body(ValidationPipe)
    body: {
      patientId: string;
      practiceId: string;
      startDateTime: string;
      notes?: string;
    },
  ): Promise<{
    success: boolean;
    appointmentId?: string;
    error?: string;
    data?: any;
  }> {
    try {
      // This would need to get practice credentials and connector config
      // For now, returning a placeholder response
      // You'll need to implement fetching practice EMR credentials and calling bookAppointment
      return {
        success: false,
        error: 'Book appointment endpoint not yet fully implemented',
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
