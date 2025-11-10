import { Controller, Post, Body } from '@nestjs/common';
import { NextechService } from './nextech.service';
import { NextechCheckCredentialsDto } from './dto/check-credentials.dto';
import {
  NextechCredentialResponse,
} from './dto/nextech-response.dto';

@Controller('nextech')
export class NextechController {
  constructor(private readonly nextechService: NextechService) {}

  @Post('check-credentials')
  async checkCredentials(
    @Body() dto: NextechCheckCredentialsDto,
  ): Promise<NextechCredentialResponse> {
    return this.nextechService.checkCredentials(dto);
  }
}
