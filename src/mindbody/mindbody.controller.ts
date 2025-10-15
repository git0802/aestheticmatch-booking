import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MindbodyService } from './mindbody.service';
import { CheckCredentialsDto } from './dto/check-credentials.dto';
import { MindBodyCredentialResponse } from './dto/mindbody-response.dto';

@Controller('mindbody')
export class MindbodyController {
  constructor(private readonly mindbodyService: MindbodyService) {}

  @Post('check-credentials')
  @HttpCode(HttpStatus.OK)
  async checkCredentials(
    @Body(ValidationPipe) checkCredentialsDto: CheckCredentialsDto,
  ): Promise<MindBodyCredentialResponse> {
    return this.mindbodyService.checkCredentials(checkCredentialsDto);
  }
}
