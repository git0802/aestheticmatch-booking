import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { EmrCredentialsService } from './emr-credentials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEmrCredentialDto } from './dto/create-emr-credential.dto';
import { UpdateEmrCredentialDto } from './dto/update-emr-credential.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '../auth/interfaces/auth.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emr-credentials')
export class EmrCredentialsController {
  constructor(private readonly service: EmrCredentialsService) {}

  @Get()
  async getMine(@GetUser() user: User) {
    return this.service.findMine(user.id);
  }

  @Get('all')
  @Roles('ADMIN')
  async getAll(@GetUser() user: User) {
    return this.service.findAll(user);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @GetUser() user: User) {
    return this.service.findOne(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateEmrCredentialDto, @GetUser() user: User) {
    return this.service.create(user.id, dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEmrCredentialDto,
    @GetUser() user: User,
  ) {
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @GetUser() user: User) {
    await this.service.remove(id, user);
    return {};
  }
}
