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
    locationId?: string | number;
    sessionTypeId?: string | number;
    error?: string;
  }> {
    try {
      const context = await this.mindbodyClientService.getPracticeContext(
        body.practiceId,
      );

      const result = await this.mindbodyClientService.ensureClientExists(
        body.patientId,
        body.practiceId,
        this.mindbodyService,
        context,
      );

      if (result.clientId) {
        return {
          success: true,
          clientId: result.clientId,
          staffId: context.staffId,
          locationId: context.locationId,
          sessionTypeId: context.sessionTypeId,
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
      staffId?: string | number;
      locationId?: string | number;
      sessionTypeId?: string | number;
    },
  ): Promise<{
    success: boolean;
    appointmentId?: string;
    error?: string;
    data?: any;
  }> {
    try {
      const context = await this.mindbodyClientService.getPracticeContext(
        body.practiceId,
      );

      const ensured = await this.mindbodyClientService.ensureClientExists(
        body.patientId,
        body.practiceId,
        this.mindbodyService,
        context,
      );

      if (!ensured.clientId) {
        return {
          success: false,
          error:
            'Unable to resolve or create a Mindbody client record for the patient',
        };
      }

      const bookingResult = await this.mindbodyService.bookAppointment(
        context.credentials,
        {
          startDateTime: body.startDateTime,
          notes: body.notes,
          staffId: body.staffId ?? context.staffId,
          locationId: body.locationId ?? context.locationId,
          sessionTypeId: body.sessionTypeId ?? context.sessionTypeId,
          clientId: ensured.clientId,
          patient: ensured.patient,
        },
      );

      return {
        success: bookingResult.success,
        appointmentId: bookingResult.appointmentId,
        error: bookingResult.error,
        data: bookingResult.success ? undefined : bookingResult,
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
