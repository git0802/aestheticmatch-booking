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

      // Generate JWT token
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        emailVerified: user.emailVerified,
      };

      const jwtToken = this.jwtService.sign(payload);

      const userResponse: User = {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profilePictureUrl: user.profilePictureUrl || undefined,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return {
        user: userResponse,
        accessToken: jwtToken,
      };
    } catch (error: any) {
      this.logger.error('Login error:', error);

      if (error.message?.includes('Invalid credentials')) {
        throw new UnauthorizedException('Invalid email or password');
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }

  async signup(signupDto: SignupDto): Promise<{ user: User; message: string }> {
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

      // Save user to our database
      try {
        await this.usersService.createUser({
          workosId: workosUser.id,
          email: workosUser.email,
          firstName: workosUser.firstName || firstName,
          lastName: workosUser.lastName || lastName,
          role: role || 'OPS_FINANCE', // Default role
        });
      } catch (dbError) {
        this.logger.error('Failed to save user to database:', dbError);
        // If database save fails, we should clean up the WorkOS user
        try {
          await this.workos.userManagement.deleteUser(workosUser.id);
        } catch (cleanupError) {
          this.logger.error('Failed to cleanup WorkOS user:', cleanupError);
        }
        throw new BadRequestException(
          'Failed to create account - database error',
        );
      }

      // Send email verification
      await this.workos.userManagement.sendVerificationEmail({
        userId: workosUser.id,
      });

      const userResponse: User = {
        id: workosUser.id,
        email: workosUser.email,
        firstName: workosUser.firstName || undefined,
        lastName: workosUser.lastName || undefined,
        profilePictureUrl: workosUser.profilePictureUrl || undefined,
        emailVerified: workosUser.emailVerified,
        createdAt: workosUser.createdAt,
        updatedAt: workosUser.updatedAt,
      };

      return {
        user: userResponse,
        message:
          'Account created successfully. Please check your email to verify your account.',
      };
    } catch (error: any) {
      this.logger.error('Signup error:', error);

      if (error.message?.includes('User already exists')) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to create account');
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
      const user = await this.workos.userManagement.getUser(id);

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

      // Verify the email with WorkOS
      const { user } = await this.workos.userManagement.verifyEmail({
        userId,
        code,
      });

      // If verification is successful, generate JWT token for immediate login
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        emailVerified: user.emailVerified,
      };

      const jwtToken = this.jwtService.sign(payload);

      const userResponse: User = {
        id: user.id,
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        profilePictureUrl: user.profilePictureUrl || undefined,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return {
        message: 'Email verified successfully',
        user: userResponse,
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
}
