import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProceduresService } from './procedures.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '../auth/interfaces/auth.interface';

@Controller('procedures')
@UseGuards(JwtAuthGuard)
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Post()
  create(
    @Body() createProcedureDto: CreateProcedureDto,
    @GetUser() user: User,
  ) {
    return this.proceduresService.create(createProcedureDto, user);
  }

  @Get()
  findAll(@Query() query: QueryProceduresDto, @GetUser() user: User) {
    return this.proceduresService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.proceduresService.findOne(id);
  }

  @Get('practice/:practiceId')
  findByPractice(
    @Param('practiceId') practiceId: string,
    @GetUser() user: User,
  ) {
    return this.proceduresService.findByPractice(practiceId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProcedureDto: UpdateProcedureDto,
    @GetUser() user: User,
  ) {
    return this.proceduresService.update(id, updateProcedureDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.proceduresService.remove(id, user);
  }
}
