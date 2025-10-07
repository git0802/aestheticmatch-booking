import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  SignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import type { User } from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    try {
      const { user, accessToken } = await this.authService.login(loginDto);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
        },
        accessToken,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto): Promise<AuthResponseDto> {
    try {
      const { user, message } = await this.authService.signup(signupDto);

      return {
        success: true,
        message,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<AuthResponseDto> {
    try {
      const { message } =
        await this.authService.forgotPassword(forgotPasswordDto);

      return {
        success: true,
        message,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<AuthResponseDto> {
    try {
      const { message } =
        await this.authService.resetPassword(resetPasswordDto);

      return {
        success: true,
        message,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user: User): Promise<AuthResponseDto> {
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
      },
    };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async getSession(@GetUser() user: User): Promise<{ user: User }> {
    return { user };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@GetUser() user: User): Promise<AuthResponseDto> {
    try {
      const { message } = await this.authService.logout(user.id);

      return {
        success: true,
        message,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<AuthResponseDto> {
    try {
      const { message, user, accessToken } =
        await this.authService.verifyEmail(verifyEmailDto);

      return {
        success: true,
        message,
        user: user
          ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              emailVerified: user.emailVerified,
            }
          : undefined,
        accessToken,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<AuthResponseDto> {
    try {
      const { message } = await this.authService.resendVerificationEmail(
        resendVerificationDto,
      );

      return {
        success: true,
        message,
      };
    } catch (error) {
      throw error;
    }
  }
}
