import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ModmedService } from './modmed.service';
import { ModmedCheckCredentialsDto } from './dto/check-credentials.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('modmed')
@UseGuards(JwtAuthGuard)
export class ModmedController {
  constructor(private readonly modmedService: ModmedService) {}

  @Post('check-credentials')
  async checkCredentials(@Body() dto: ModmedCheckCredentialsDto) {
    return this.modmedService.checkCredentials(dto);
  }
}
