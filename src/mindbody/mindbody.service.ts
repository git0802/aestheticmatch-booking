import { Injectable, Logger } from '@nestjs/common';
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
    const { apiKey, username, password, siteId } = credentials;
    const siteHeader = String(siteId ?? '-99');

    try {
      // First get user token for authentication
      const tokenResponse = await fetch(
        `${this.MINDBODY_API_BASE_URL}usertoken/issue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
            SiteId: siteHeader,
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
            SiteId: siteHeader,
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

  /**
   * Attempt to book an appointment in Mindbody.
   * Note: Real booking requires mapped staffId, locationId, sessionTypeId, and a Mindbody clientId.
   * This implementation validates credentials and returns a descriptive error until mapping is provided.
   */
  async bookAppointment(
    credentials: {
      apiKey: string;
      username: string;
      password: string;
      siteId?: string;
    },
    payload: {
      startDateTime: string;
      notes?: string;
      staffId?: string | number;
      locationId?: string | number;
      sessionTypeId?: string | number;
      clientId?: string;
    },
  ): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    const { apiKey, username, password, siteId } = credentials;
    const siteHeader = String(siteId ?? '-99');

    try {
      // Issue user token
      const tokenResponse = await fetch(
        `${this.MINDBODY_API_BASE_URL}usertoken/issue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
            SiteId: siteHeader,
          },
          body: JSON.stringify({ Username: username, Password: password }),
        },
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        const errorMessage =
          errorData.Error?.Message ||
          `Authentication failed: HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`;
        return { success: false, error: errorMessage };
      }

      const tokenData = await tokenResponse.json();
      if (!tokenData.AccessToken) {
        return {
          success: false,
          error: 'Authentication failed: No access token received',
        };
      }

      // Validate required booking fields
      if (
        !payload.clientId ||
        !payload.staffId ||
        !payload.locationId ||
        !payload.sessionTypeId
      ) {
        return {
          success: false,
          error:
            'Mindbody booking requires clientId, staffId, locationId, and sessionTypeId mapping. Configure connectorConfig to include these values.',
        };
      }

      // Placeholder: Integrate actual Mindbody booking API here.
      // For now, return a clear error to avoid partial/incorrect bookings.
      return {
        success: false,
        error:
          'Mindbody booking endpoint not fully implemented in this environment. Credentials validated successfully; provide mapping to enable booking.',
      };
    } catch (error) {
      this.logger.error('MindBody book appointment error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }
}
