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
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private workos: WorkOS;
  private clientId: string;
  private redirectUri: string;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
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
      const { email, password, firstName, lastName } = signupDto;

      // Create user with WorkOS
      const user = await this.workos.userManagement.createUser({
        email,
        password,
        firstName,
        lastName,
        emailVerified: false,
      });

      // Send email verification
      await this.workos.userManagement.sendVerificationEmail({
        userId: user.id,
      });

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
}
