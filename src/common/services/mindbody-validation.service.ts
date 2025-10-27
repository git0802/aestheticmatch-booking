import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class MindbodyValidationService {
  async validateCredentials(
    credentials: any,
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const { apiKey, siteId, username, password, baseUrl } = credentials;

      // Test connection with Mindbody API
      const authResponse = await fetch(
        `${baseUrl || 'https://api.mindbodyonline.com/public/v6'}/usertoken/issue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': apiKey,
          },
          body: JSON.stringify({
            Username: username,
            Password: password,
          }),
        },
      );

      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({}));
        return {
          isValid: false,
          error:
            errorData.Error?.Message ||
            `HTTP ${authResponse.status}: ${authResponse.statusText}`,
        };
      }

      const authData = await authResponse.json();

      if (!authData.AccessToken) {
        return {
          isValid: false,
          error: 'Failed to obtain access token',
        };
      }

      // Test a simple API call to verify the token works
      const testResponse = await fetch(
        `${baseUrl || 'https://api.mindbodyonline.com/public/v6'}/site/sites`,
        {
          headers: {
            Authorization: `Bearer ${authData.AccessToken}`,
            'Api-Key': apiKey,
            SiteId: siteId,
          },
        },
      );

      if (!testResponse.ok) {
        return {
          isValid: false,
          error: 'Invalid site ID or insufficient permissions',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error.message || 'Connection failed',
      };
    }
  }
}
