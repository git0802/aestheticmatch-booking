import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PracticesService } from './practices.service';
import { CreatePracticeDto, EmrCredentialDto } from './dto/create-practice.dto';
import { UpdatePracticeDto } from './dto/update-practice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '../auth/interfaces/auth.interface';

@Controller('practices')
@UseGuards(JwtAuthGuard)
export class PracticesController {
  constructor(private readonly practicesService: PracticesService) {}

  @Post()
  create(@Body() createPracticeDto: CreatePracticeDto, @GetUser() user: User) {
    return this.practicesService.create(createPracticeDto, user);
  }

  @Post('test-emr-credentials')
  testEmrCredentials(@Body() emrCredential: EmrCredentialDto) {
    return this.practicesService.testEmrCredentials(emrCredential);
  }

  @Get()
  findAll(@GetUser() user: User) {
    return this.practicesService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.practicesService.findOne(id, user);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updatePracticeDto: UpdatePracticeDto,
    @GetUser() user: User,
  ) {
    return this.practicesService.update(id, updatePracticeDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.practicesService.remove(id, user);
  }
}
