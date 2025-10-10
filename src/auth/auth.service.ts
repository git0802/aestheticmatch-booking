import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WorkOS } from '@workos-inc/node';
import { ConfigService } from '@nestjs/config';
import { User, AuthSession, JwtPayload } from './interfaces/auth.interface';
import {
  LoginDto,
  SignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import { UsersService } from '../users/users.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private workos: WorkOS;
  private clientId: string;
  private redirectUri: string;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const apiKey = this.configService.get<string>('WORKOS_API_KEY');
    const clientId = this.configService.get<string>('WORKOS_CLIENT_ID');
    if (!clientId) {
      throw new Error('WORKOS_CLIENT_ID is required');
    }
    this.clientId = clientId;
    this.redirectUri =
      this.configService.get<string>('WORKOS_REDIRECT_URI') ||
      'http://localhost:3001/auth/callback';

    if (!apiKey) {
      throw new Error('WORKOS_API_KEY is required');
    }
    if (!this.clientId) {
      throw new Error('WORKOS_CLIENT_ID is required');
    }

    this.workos = new WorkOS(apiKey);
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ user: User; accessToken: string }> {
    try {
      const { email, password } = loginDto;

      // Authenticate user with WorkOS
      const { user, accessToken, refreshToken } =
        await this.workos.userManagement.authenticateWithPassword({
          email,
          password,
          clientId: this.clientId,
        });

      // Update user status to ACTIVE in our database
      await this.usersService.updateUserStatus(user.id, UserStatus.ACTIVE);

      // Generate JWT token
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        emailVerified: user.emailVerified,
      };

      const jwtToken = this.jwtService.sign(payload);

      // Get user data with role from database
      const userWithRole = await this.getUserById(user.id);

      if (!userWithRole) {
        throw new UnauthorizedException('User not found in database');
      }

      return {
        user: userWithRole,
        accessToken: jwtToken,
      };
    } catch (error: any) {
      this.logger.error('Login error:', error);

      throw new UnauthorizedException(error);
    }
  }

  async signup(signupDto: SignupDto): Promise<{ 
    user: User; 
    message: string; 
    id: string; 
    userId: string;
  }> {
    try {
      const { email, password, firstName, lastName, role } = signupDto;

      // Create user with WorkOS
      const workosUser = await this.workos.userManagement.createUser({
        email,
        password,
        firstName,
        lastName,
        emailVerified: false,
      });

      // Send email verification
      await this.workos.userManagement.sendVerificationEmail({
        userId: workosUser.id,
      });

      return {
        user: {
          id: workosUser.id, // WorkOS ID temporarily for frontend
          email: workosUser.email,
          firstName: workosUser.firstName || undefined,
          lastName: workosUser.lastName || undefined,
          role: (role as 'CONCIERGE' | 'OPS_FINANCE' | 'ADMIN') || 'CONCIERGE',
          emailVerified: workosUser.emailVerified,
          profilePictureUrl: workosUser.profilePictureUrl || undefined,
          createdAt: workosUser.createdAt,
          updatedAt: workosUser.updatedAt,
        },
        message:
          'Account created successfully. Please check your email to verify your account.',
        id: workosUser.id, // WorkOS ID for email verification
        userId: workosUser.id, // Temporarily same as WorkOS ID until verification
      };
    } catch (error: any) {
      this.logger.error('Signup error:', error.message);

      throw new BadRequestException(error.message);
    }
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    try {
      const { email } = forgotPasswordDto;

      // Get user by email
      const user = await this.getUserByEmail(email);

      if (!user) {
        // Don't reveal whether the email exists or not
        return {
          message:
            'If an account with this email exists, you will receive a password reset email.',
        };
      }

      // Send password reset email
      await this.workos.userManagement.sendPasswordResetEmail({
        email,
        passwordResetUrl: `${this.configService.get('FRONTEND_URL')}/reset-password`,
      });

      return {
        message:
          'If an account with this email exists, you will receive a password reset email.',
      };
    } catch (error: any) {
      this.logger.error('Forgot password error:', error);
      throw new BadRequestException('Failed to send password reset email');
    }
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    try {
      const { token, password } = resetPasswordDto;

      // Reset password with WorkOS
      await this.workos.userManagement.resetPassword({
        token,
        newPassword: password,
      });

      return {
        message: 'Password reset successfully',
      };
    } catch (error: any) {
      this.logger.error('Reset password error:', error);

      if (error.message?.includes('Invalid token')) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      throw new BadRequestException('Failed to reset password');
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data: users } = await this.workos.userManagement.listUsers({
        email,
        limit: 1,
      });

      if (users.length === 0) {
        return null;
      }

      const user = users[0];
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profilePictureUrl: user.profilePictureUrl || undefined,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      this.logger.error('Error fetching user by email:', error);
      return null;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      // First, get user from local database to get role and other local data
      const dbUser = await this.usersService.findByWorkosId(id);

      if (!dbUser) {
        this.logger.warn(`User not found in database with WorkOS ID: ${id}`);
        return null;
      }

      // Get user data from WorkOS for up-to-date profile information
      let workosUser;
      try {
        workosUser = await this.workos.userManagement.getUser(id);
      } catch (workosError) {
        this.logger.error('Error fetching user from WorkOS:', workosError);
        // If WorkOS fails, use database data as fallback
        return {
          id: dbUser.id, // Use database ID, not WorkOS ID
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          role: dbUser.role,
          profilePictureUrl: undefined,
          emailVerified: dbUser.emailVerified,
          createdAt: dbUser.createdAt.toISOString(),
          updatedAt: dbUser.updatedAt.toISOString(),
        };
      }

      // Combine WorkOS data with database data (database takes precedence for role)
      return {
        id: dbUser.id, // Use database ID, not WorkOS ID
        email: workosUser.email,
        firstName: workosUser.firstName || dbUser.firstName,
        lastName: workosUser.lastName || dbUser.lastName,
        role: dbUser.role, // Role comes from database
        profilePictureUrl: workosUser.profilePictureUrl || undefined,
        emailVerified: workosUser.emailVerified,
        createdAt: workosUser.createdAt,
        updatedAt: workosUser.updatedAt,
      };
    } catch (error) {
      this.logger.error('Error fetching user by ID:', error);
      return null;
    }
  }

  async validateUser(payload: JwtPayload): Promise<User | null> {
    return this.getUserById(payload.sub);
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string; user?: User; accessToken?: string }> {
    try {
      const { userId, code } = verifyEmailDto;

      // Verify the email with WorkOS (userId should be the WorkOS user ID)
      const { user: workosUser } = await this.workos.userManagement.verifyEmail({
        userId, // This should be the WorkOS user ID
        code,
      });

      // Check if user already exists in database
      let dbUser = await this.usersService.findByWorkosId(workosUser.id);
      
      if (!dbUser) {
        // Create user in database after successful email verification
        try {
          dbUser = await this.usersService.createUser({
            workosId: workosUser.id,
            email: workosUser.email,
            firstName: workosUser.firstName || 'Unknown',
            lastName: workosUser.lastName || 'User',
            role: 'CONCIERGE', // Default role, can be updated later
            emailVerified: true, // Set to true since email is verified
          });
        } catch (dbError) {
          this.logger.error('Failed to save user to database after verification:', dbError);
          throw new BadRequestException(
            'Email verified but failed to create account. Please contact support.',
          );
        }
      } else {
        // Update email verification status if user already exists
        await this.usersService.updateEmailVerification(workosUser.id, true);
      }

      // If verification is successful, generate JWT token for immediate login
      const payload: JwtPayload = {
        sub: workosUser.id,
        email: workosUser.email,
        firstName: workosUser.firstName || undefined,
        lastName: workosUser.lastName || undefined,
        emailVerified: workosUser.emailVerified,
      };

      const jwtToken = this.jwtService.sign(payload);

      return {
        message: 'Email verified successfully',
        user: {
          id: dbUser.id, // Use database ID, not WorkOS ID
          email: workosUser.email,
          firstName: workosUser.firstName || dbUser.firstName,
          lastName: workosUser.lastName || dbUser.lastName,
          role: dbUser.role, // Role comes from database
          profilePictureUrl: workosUser.profilePictureUrl || undefined,
          emailVerified: workosUser.emailVerified,
          createdAt: workosUser.createdAt,
          updatedAt: workosUser.updatedAt,
        },
        accessToken: jwtToken,
      };
    } catch (error: any) {
      this.logger.error('Email verification error:', error);

      if (
        error.message?.includes('Invalid code') ||
        error.message?.includes('expired')
      ) {
        throw new BadRequestException('Invalid or expired verification code');
      }

      throw new BadRequestException('Failed to verify email');
    }
  }

  async resendVerificationEmail(
    resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    try {
      const { userId } = resendVerificationDto;

      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.emailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      // Resend verification email
      await this.workos.userManagement.sendVerificationEmail({
        userId,
      });

      return {
        message: 'Verification email sent successfully',
      };
    } catch (error: any) {
      this.logger.error('Resend verification error:', error);

      if (error.message?.includes('User not found')) {
        throw new BadRequestException('User not found');
      }

      if (error.message?.includes('already verified')) {
        throw new BadRequestException('Email is already verified');
      }

      throw new BadRequestException('Failed to resend verification email');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    try {
      // Update user status to INACTIVE in our database
      await this.usersService.updateUserStatus(userId, UserStatus.INACTIVE);

      return {
        message: 'Logout successful',
      };
    } catch (error: any) {
      this.logger.error('Logout error:', error);
      throw new BadRequestException('Failed to logout');
    }
  }
}
