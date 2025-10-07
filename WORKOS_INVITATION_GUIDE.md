# WorkOS User Invitation System

## Overview

This implementation integrates WorkOS User Management API to send actual email invitations when inviting users to your platform.

## Configuration Required

### 1. Environment Variables

Add to your `.env` file:

```bash
WORKOS_ORGANIZATION_ID=org_your_organization_id_here
```

### 2. WorkOS Setup Steps

1. **Log into WorkOS Dashboard**: https://dashboard.workos.com/
2. **Create/Select Organization**:
   - Go to "User Management" → "Organizations"
   - Create a new organization or use existing one
   - Copy the Organization ID (starts with `org_`)

3. **Configure Email Settings**:
   - Go to "User Management" → "Configuration"
   - Set up your custom email templates (optional)
   - Configure your domain for email sending

## How It Works

### 1. Sending Invitations

When an admin invites a user:

```typescript
// POST /api/users/invite
{
  "email": "newuser@example.com",
  "role": "CONCIERGE",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Process:**

1. Checks if user already exists in database
2. Sends invitation via WorkOS API
3. Creates pending user record in database
4. WorkOS sends email to the invited user
5. Email contains a link to accept the invitation

### 2. Accepting Invitations

When user clicks the invitation link:

```typescript
// POST /api/users/accept-invitation/{invitationId}
{
  "firstName": "John",
  "lastName": "Doe",
  "password": "securepassword123"
}
```

**Process:**

1. Validates invitation ID with WorkOS
2. Creates actual WorkOS user account
3. Updates database with real WorkOS user ID
4. User can now log in normally

## API Endpoints

### Send Invitation

- **Endpoint**: `POST /api/users/invite`
- **Auth**: JWT required (admin only)
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "role": "CONCIERGE|OPS_FINANCE|ADMIN",
    "firstName": "Optional",
    "lastName": "Optional"
  }
  ```

### Accept Invitation

- **Endpoint**: `POST /api/users/accept-invitation/{invitationId}`
- **Auth**: No JWT required (public endpoint)
- **Body**:
  ```json
  {
    "firstName": "Required",
    "lastName": "Required",
    "password": "Required"
  }
  ```

## Email Template Customization

WorkOS allows you to customize the invitation email template:

1. Go to WorkOS Dashboard → User Management → Configuration
2. Customize the "Invitation Email" template
3. Include your app branding and custom messaging
4. The email will contain a link that directs to your frontend

## Frontend Integration

### 1. Invitation Accept Page

Create a frontend page at `/accept-invite` that:

- Extracts invitation ID from URL parameters
- Shows a form for user details (name, password)
- Calls the accept invitation API
- Redirects to login on success

### 2. Example Frontend Code

```typescript
// pages/accept-invite.tsx
const AcceptInvitePage = () => {
  const router = useRouter();
  const { invitationId } = router.query;

  const handleAccept = async (userData) => {
    const response = await fetch(`/api/users/accept-invitation/${invitationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    if (response.ok) {
      router.push('/signin?message=invitation-accepted');
    }
  };

  return <InvitationAcceptForm onSubmit={handleAccept} />;
};
```

## Benefits

1. **Professional Email Delivery**: WorkOS handles email deliverability
2. **Branded Experience**: Customize email templates with your branding
3. **Security**: Secure invitation tokens with expiration
4. **User Experience**: Smooth onboarding flow
5. **Analytics**: Track invitation metrics in WorkOS dashboard

## Testing

### 1. Development Testing

- Use test email addresses
- Check WorkOS dashboard for invitation status
- Monitor server logs for debugging

### 2. Production Checklist

- [ ] Organization ID configured
- [ ] Email domain verified in WorkOS
- [ ] Custom email templates set up
- [ ] Frontend accept invitation page created
- [ ] Error handling implemented

## Error Handling

The system handles common errors:

- Duplicate email addresses
- Invalid invitation IDs
- Expired invitations
- WorkOS API failures
- Email delivery issues

## Monitoring

Monitor invitation success in:

1. WorkOS Dashboard → User Management → Invitations
2. Application logs for detailed debugging
3. Database for pending user records
