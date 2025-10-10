import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WorkOS } from '@workos-inc/node';
import {
  CreateUserData,
  UpdateUserData,
  UserResponse,
  GetUsersQuery,
  PaginatedUsersResponse,
} from './interfaces/user.interface';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private workos: WorkOS;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('WORKOS_API_KEY');
    this.workos = new WorkOS(apiKey);
  }

  async createUser(data: CreateUserData): Promise<UserResponse> {
    try {
      // Check if user with workosId or email already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ workosId: data.workosId }, { email: data.email }],
        },
      });

      if (existingUser) {
        throw new ConflictException(
          'User with this WorkOS ID or email already exists',
        );
      }

      const user = await this.prisma.user.create({
        data: {
          workosId: data.workosId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role ? UserRole[data.role] : UserRole.CONCIERGE,
          emailVerified: data.emailVerified ?? false,
        },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error creating user:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Failed to create user');
    }
  }

  async getAllUsers(
    query: GetUsersQuery = {},
  ): Promise<PaginatedUsersResponse> {
    try {
      const { role, search, status, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (role && role !== 'all') {
        where.role = role.toUpperCase();
      }

      if (status && status !== 'all') {
        where.status = status.toUpperCase();
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users.map((user) => this.mapUserToResponse(user)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  async updateUserRole(id: string, role: string): Promise<UserResponse> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { role: UserRole[role as keyof typeof UserRole] },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error updating user role:', error);
      throw new NotFoundException('User not found');
    }
  }

  async inviteUser(inviteData: any): Promise<{ message: string }> {
    try {
      // Check if user already exists in our database
      const existingUser = await this.prisma.user.findUnique({
        where: { email: inviteData.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Send invitation through WorkOS
      const invitation = await this.workos.userManagement.sendInvitation({
        email: inviteData.email,
        organizationId: this.configService.get<string>(
          'WORKOS_ORGANIZATION_ID',
        ),
        expiresInDays: 7, // Invitation expires in 7 days
      });

      console.log(invitation);

      this.logger.log(
        `Invitation sent to ${inviteData.email}, ID: ${invitation.id}`,
      );

      // Create a pending user record with invitation reference
      const tempWorkosId = `invited_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.prisma.user.create({
        data: {
          workosId: tempWorkosId,
          email: inviteData.email,
          firstName: 'Pending',
          lastName: 'User',
          role: UserRole[inviteData.role as keyof typeof UserRole],
        },
      });

      return {
        message: `User invitation sent successfully to ${inviteData.email}`,
      };
    } catch (error) {
      this.logger.error('Error inviting user:', error);
      if (error instanceof ConflictException) {
        throw error;
      }

      // Handle WorkOS specific errors
      if (error.response?.status === 422) {
        throw new BadRequestException(
          'Invalid email address or organization configuration',
        );
      }

      throw new BadRequestException('Failed to send user invitation');
    }
  }

  async acceptInvitation(
    invitationId: string,
    userData: { firstName: string; lastName: string; password: string },
  ): Promise<{ message: string }> {
    try {
      // Get invitation details from WorkOS
      const invitation =
        await this.workos.userManagement.getInvitation(invitationId);

      if (!invitation || invitation.state !== 'pending') {
        throw new BadRequestException('Invalid or expired invitation');
      }

      // Find the pending user record
      const pendingUser = await this.prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (!pendingUser) {
        throw new NotFoundException('Pending user record not found');
      }

      // Accept the invitation in WorkOS (this creates the actual WorkOS user)
      const workosUser = await this.workos.userManagement.createUser({
        email: invitation.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password,
      });

      // Update our database with the real WorkOS user ID
      await this.prisma.user.update({
        where: { email: invitation.email },
        data: {
          workosId: workosUser.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
        },
      });

      this.logger.log(
        `Invitation accepted for ${invitation.email}, WorkOS user created: ${workosUser.id}`,
      );

      return {
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      this.logger.error('Error accepting invitation:', error);
      throw new BadRequestException('Failed to accept invitation');
    }
  }

  async confirmInvitationWithCode(
    code: string,
  ): Promise<{ message: string; user: UserResponse }> {
    console.log('code', code);

    try {
      // Exchange the authorization code for user information using WorkOS
      const { user: workosUser } =
        await this.workos.userManagement.authenticateWithCode({
          code,
          clientId: this.configService.get<string>('WORKOS_CLIENT_ID') || '',
        });

      // Find the pending user record by email
      const pendingUser = await this.prisma.user.findUnique({
        where: { email: workosUser.email },
      });

      if (!pendingUser) {
        throw new NotFoundException('Pending user record not found');
      }

      // Update our database with the real WorkOS user ID and names
      const updatedUser = await this.prisma.user.update({
        where: { email: workosUser.email },
        data: {
          workosId: workosUser.id,
          firstName: workosUser.firstName || 'Pending',
          lastName: workosUser.lastName || 'Pending',
          emailVerified: true,
        },
      });

      this.logger.log(
        `Invitation confirmed for ${workosUser.email}, WorkOS user: ${workosUser.id}`,
      );

      return {
        message: 'Invitation confirmed successfully',
        user: this.mapUserToResponse(updatedUser),
      };
    } catch (error) {
      console.log('error: ', error);

      this.logger.error('Error confirming invitation with code:', error);
      throw new BadRequestException('Failed to confirm invitation');
    }
  }

  async findByWorkosId(workosId: string): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { workosId },
      });

      return user ? this.mapUserToResponse(user) : null;
    } catch (error) {
      this.logger.error('Error finding user by WorkOS ID:', error);
      return null;
    }
  }

  async findByEmail(email: string): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      return user ? this.mapUserToResponse(user) : null;
    } catch (error) {
      this.logger.error('Error finding user by email:', error);
      return null;
    }
  }

  async findById(id: string): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      return user ? this.mapUserToResponse(user) : null;
    } catch (error) {
      this.logger.error('Error finding user by ID:', error);
      return null;
    }
  }

  async updateUser(id: string, data: UpdateUserData): Promise<UserResponse> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.email && { email: data.email }),
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.role && { role: UserRole[data.role] }),
        },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw new NotFoundException('User not found');
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      // First check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if this is the last admin user
      if (user.role === UserRole.ADMIN) {
        const adminCount = await this.prisma.user.count({
          where: { role: UserRole.ADMIN },
        });

        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot delete the last admin user. At least one admin must remain.',
          );
        }
      }

      // Delete from WorkOS first (if it's not a temporary invited user)
      if (user.workosId) {
        try {
          await this.workos.userManagement.deleteUser(user.workosId);
          this.logger.log(`User deleted from WorkOS: ${user.workosId}`);
        } catch (workosError: any) {
          // Log the WorkOS error but continue with local deletion
          // WorkOS user might already be deleted or not exist
          this.logger.warn(
            `Failed to delete user from WorkOS (${user.workosId}): ${workosError.message}`,
          );
        }
      }

      // Delete from local database
      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(
        `User deleted from local database: ${user.email} (${user.id})`,
      );
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new NotFoundException('User not found');
    }
  }

  async updateUserStatus(
    workosId: string,
    status: UserStatus,
  ): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.update({
        where: { workosId },
        data: {
          status,
          lastLogin: status === UserStatus.ACTIVE ? new Date() : undefined,
          updatedAt: new Date(),
        },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error updating user status:', error);
      return null;
    }
  }

  async updateEmailVerification(
    workosId: string,
    emailVerified: boolean,
  ): Promise<UserResponse | null> {
    try {
      const user = await this.prisma.user.update({
        where: { workosId },
        data: {
          emailVerified,
          updatedAt: new Date(),
        },
      });

      return this.mapUserToResponse(user);
    } catch (error) {
      this.logger.error('Error updating email verification:', error);
      return null;
    }
  }

  private mapUserToResponse(user: any): UserResponse {
    return {
      id: user.id,
      workosId: user.workosId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
