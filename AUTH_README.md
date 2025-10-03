# AestheticMatch Backend - Authentication with WorkOS

This NestJS backend implements user authentication using WorkOS for the AestheticMatch platform.

## Features Implemented

### ✅ Complete Authentication API

- **User Registration**: Create new accounts with email verification
- **User Sign In**: Authenticate existing users with JWT tokens
- **Password Reset**: Request and complete password resets
- **Session Management**: JWT-based authentication
- **Route Protection**: Guards and decorators for protected routes
- **User Profile**: Get current user information

### ✅ WorkOS Integration

- User Management API integration
- Password authentication
- Email verification
- Password reset functionality
- Secure JWT token generation

### ✅ Security Features

- HIPAA compliance considerations
- JWT-based authentication
- Route-based access control
- Secure password requirements
- Global validation and error handling

## Environment Configuration

Create a `.env` file in the root directory with:

```bash
# WorkOS Configuration
WORKOS_API_KEY=your_workos_api_key_here
WORKOS_CLIENT_ID=your_workos_client_id_here
WORKOS_REDIRECT_URI=http://localhost:3001/auth/callback

# JWT Configuration
JWT_SECRET=your-jwt-secret-change-in-production-make-it-strong-and-random
JWT_EXPIRES_IN=24h

# Frontend URL for password reset links
FRONTEND_URL=http://localhost:3000

# NestJS Configuration
NODE_ENV=development
PORT=3001
```

## API Endpoints

The following authentication API endpoints are available:

### Authentication Routes

- `POST /auth/login` - User sign in
- `POST /auth/signup` - User registration
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Complete password reset
- `GET /auth/profile` - Get current user profile (protected)
- `GET /auth/session` - Get current user session (protected)
- `POST /auth/logout` - User sign out (protected)

### Example Requests

#### Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Signup

```bash
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Get Profile (Protected)

```bash
GET /auth/profile
Authorization: Bearer your_jwt_token_here
```

## Project Structure

```
src/
├── auth/
│   ├── decorators/
│   │   └── get-user.decorator.ts      # @GetUser() decorator
│   ├── dto/
│   │   └── auth.dto.ts                # Request/Response DTOs
│   ├── guards/
│   │   └── jwt-auth.guard.ts          # JWT authentication guard
│   ├── interfaces/
│   │   └── auth.interface.ts          # TypeScript interfaces
│   ├── strategies/
│   │   └── jwt.strategy.ts            # Passport JWT strategy
│   ├── auth.controller.ts             # Authentication endpoints
│   ├── auth.module.ts                 # Authentication module
│   └── auth.service.ts                # WorkOS integration service
├── common/
│   ├── filters/
│   │   └── all-exceptions.filter.ts   # Global exception handling
│   └── interceptors/
│       └── transform.interceptor.ts   # Response transformation
├── app.module.ts                      # Main application module
└── main.ts                           # Application bootstrap
```

## Running the Application

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   - Copy the example environment variables above
   - Replace with your actual WorkOS credentials

3. **Start the development server:**

   ```bash
   npm run start:dev
   ```

4. **The API will be available at:**
   ```
   http://localhost:3001
   ```

## Authentication Flow

1. **User Registration:**
   - User submits registration form
   - Backend creates user in WorkOS
   - Verification email sent
   - Success response returned

2. **User Login:**
   - User submits email/password
   - Backend authenticates with WorkOS
   - JWT token generated and returned
   - Client stores token for future requests

3. **Protected Routes:**
   - Client sends JWT token in Authorization header
   - JwtAuthGuard validates token
   - User information attached to request
   - Route handler processes request

4. **Password Reset:**
   - User requests password reset
   - Backend sends reset email via WorkOS
   - User clicks reset link
   - User submits new password with reset token

## Guards and Decorators Usage

### Protecting Routes

```typescript
@Get('protected')
@UseGuards(JwtAuthGuard)
async getProtectedData(@GetUser() user: User) {
  return { message: `Hello ${user.firstName}!` };
}
```

### Optional Authentication

```typescript
@Get('optional')
async getOptionalData(@GetUser() user?: User) {
  if (user) {
    return { message: `Hello ${user.firstName}!` };
  }
  return { message: 'Hello guest!' };
}
```

## Error Handling

The API uses a global exception filter that returns consistent error responses:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Email and password are required",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/auth/login"
}
```

## Migration from Next.js

This backend replaces the Next.js API routes with equivalent NestJS endpoints:

- Next.js `/api/auth/login` → NestJS `/auth/login`
- Next.js `/api/auth/signup` → NestJS `/auth/signup`
- Next.js `/api/auth/session` → NestJS `/auth/session`
- And so on...

The frontend can be updated to call these new endpoints while maintaining the same authentication flow.

## Security Considerations

- JWT tokens expire in 24 hours (configurable)
- Passwords are handled securely by WorkOS
- CORS configured for frontend domain
- Global validation prevents invalid data
- Error messages don't reveal sensitive information

## Next Steps

1. Update frontend to use the new backend endpoints
2. Implement refresh token rotation (if needed)
3. Add rate limiting for authentication endpoints
4. Set up monitoring and logging
5. Configure production environment variables
