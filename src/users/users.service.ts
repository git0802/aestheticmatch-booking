import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateUserData,
  UpdateUserData,
  UserResponse,
} from './interfaces/user.interface';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

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
      await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      throw new NotFoundException('User not found');
    }
  }

  async getAllUsers(): Promise<UserResponse[]> {
    try {
      const users = await this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return users.map((user) => this.mapUserToResponse(user));
    } catch (error) {
      this.logger.error('Error fetching all users:', error);
      return [];
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
