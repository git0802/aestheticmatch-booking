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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/user.decorator';

@Controller('procedures')
@UseGuards(JwtAuthGuard)
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Post()
  @UseGuards(RoleGuard)
  @Roles('ADMIN')
  create(@Body() createProcedureDto: CreateProcedureDto, @GetUser() user: any) {
    return this.proceduresService.create(createProcedureDto, user.id);
  }

  @Get()
  findAll(@Query() query: QueryProceduresDto) {
    return this.proceduresService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proceduresService.findOne(id);
  }

  @Get('practice/:practiceId')
  findByPractice(@Param('practiceId') practiceId: string) {
    return this.proceduresService.findByPractice(practiceId);
  }

  @Patch(':id')
  @UseGuards(RoleGuard)
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateProcedureDto: UpdateProcedureDto,
    @GetUser() user: any,
  ) {
    return this.proceduresService.update(id, updateProcedureDto, user.id);
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.proceduresService.remove(id);
  }
}
