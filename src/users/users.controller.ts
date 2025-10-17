import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserStatus } from '@prisma/client';
import {
  CreateUserDto,
  UpdateUserDto,
  InviteUserDto,
  GetUsersQueryDto,
  ConfirmInvitationDto,
} from './dto/users.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUsers(@Query() query: GetUsersQueryDto) {
    return this.usersService.getAllUsers(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async inviteUser(@Body() inviteUserDto: InviteUserDto) {
    return this.usersService.inviteUser(inviteUserDto);
  }

  @Post('accept-invitation/:invitationId')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('invitationId') invitationId: string,
    @Body() userData: { firstName: string; lastName: string; password: string },
  ) {
    return this.usersService.acceptInvitation(invitationId, userData);
  }

  @Post('confirm-invitation')
  @HttpCode(HttpStatus.OK)
  async confirmInvitationWithCode(
    @Body() confirmInvitationDto: ConfirmInvitationDto,
  ) {
    console.log('code: ', confirmInvitationDto);

    return this.usersService.confirmInvitationWithCode(
      confirmInvitationDto.code,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Put(':id/role')
  @UseGuards(JwtAuthGuard)
  async updateUserRole(@Param('id') id: string, @Body('role') role: string) {
    return this.usersService.updateUserRole(id, role);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateUserStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    // First get the user by id to find their workosId
    const existingUser = await this.usersService.findById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    // Update status using workosId
    const updatedUser = await this.usersService.updateUserStatus(
      existingUser.workosId,
      status as UserStatus,
    );

    if (!updatedUser) {
      throw new Error('Failed to update user status');
    }

    return updatedUser;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id: string) {
    try {
      await this.usersService.deleteUser(id);
    } catch (error) {
      throw error; // Re-throw to let NestJS handle the error response
    }
  }
}
