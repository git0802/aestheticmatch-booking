import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CheckCredentialsDto } from './dto/check-credentials.dto';
import {
  MindBodyCredentialResponse,
  MindBodySiteInfo,
} from './dto/mindbody-response.dto';

@Injectable()
export class MindbodyService {
  private readonly logger = new Logger(MindbodyService.name);
  private readonly MINDBODY_API_BASE_URL =
    'https://api.mindbodyonline.com/public/v6/';

  async checkCredentials(
    credentials: CheckCredentialsDto,
  ): Promise<MindBodyCredentialResponse> {
    const { apiKey, username, password } = credentials;

    try {
      // First get user token for authentication
      const tokenResponse = await fetch(
        `${this.MINDBODY_API_BASE_URL}usertoken/issue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
            SiteId: '-99',
          },
          body: JSON.stringify({
            Username: username,
            Password: password,
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        const errorMessage =
          errorData.Error?.Message ||
          `Authentication failed: HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`;

        this.logger.error(`MindBody authentication failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const tokenData = await tokenResponse.json();

      if (!tokenData.AccessToken) {
        const errorMessage = 'Authentication failed: No access token received';
        this.logger.error(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Now get site information with the access token
      const siteResponse = await fetch(
        `${this.MINDBODY_API_BASE_URL}site/sites`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
            SiteId: '-99',
            Authorization: `Bearer ${tokenData.AccessToken}`,
          },
        },
      );

      if (!siteResponse.ok) {
        const errorData = await siteResponse.json().catch(() => ({}));
        const errorMessage =
          errorData.Error?.Message ||
          `HTTP ${siteResponse.status}: ${siteResponse.statusText}`;

        this.logger.error(`MindBody site info request failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const siteData: MindBodySiteInfo = await siteResponse.json();

      this.logger.log('MindBody credentials validated successfully');
      return {
        success: true,
        sites: siteData,
      };
    } catch (error) {
      this.logger.error('MindBody credential check error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
