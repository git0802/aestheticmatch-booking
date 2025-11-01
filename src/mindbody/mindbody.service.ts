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
      // Required mapping from practice connectorConfig
      staffId?: string | number;
      locationId?: string | number;
      sessionTypeId?: string | number;
      clientId?: string;
      patient?: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
      };
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
        // Try to resolve clientId if patient info is provided
        if (!payload.clientId && payload.patient?.email) {
          const resolvedClientId = await this.resolveOrCreateClient(
            apiKey,
            siteHeader,
            tokenData.AccessToken,
            payload.patient,
          );
          if (resolvedClientId) {
            payload.clientId = resolvedClientId;
          }
        }
        // After attempt, still validate the rest
        if (
          !payload.clientId ||
          !payload.staffId ||
          !payload.locationId ||
          !payload.sessionTypeId
        ) {
          return {
            success: false,
            error:
              'Mindbody booking requires clientId, staffId, locationId, and sessionTypeId. Provide these via practice.connectorConfig (and ensure patient has an email to auto-create client).',
          };
        }
      }

      // Perform booking
      const bookingRes = await fetch(
        `${this.MINDBODY_API_BASE_URL}appointments/appointments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
            SiteId: siteHeader,
            Authorization: `Bearer ${tokenData.AccessToken}`,
          },
          body: JSON.stringify({
            Appointments: [
              {
                StartDateTime: payload.startDateTime,
                LocationId: Number(payload.locationId),
                StaffId: Number(payload.staffId),
                ClientId: String(payload.clientId),
                SessionTypeId: Number(payload.sessionTypeId),
                Notes: payload.notes ?? undefined,
              },
            ],
          }),
        },
      );

      if (!bookingRes.ok) {
        const errorData = await bookingRes.json().catch(() => ({}));
        const msg =
          errorData?.Error?.Message ||
          errorData?.Message ||
          `HTTP ${bookingRes.status}: ${bookingRes.statusText}`;
        return { success: false, error: `Mindbody booking failed: ${msg}` };
      }

      const body = await bookingRes.json().catch(() => ({}));
      // Response typically includes Appointments array
      const appt = body?.Appointments?.[0] || body?.Appointment;
      const appointmentId = appt?.Id || appt?.AppointmentId || appt?.ID;
      if (!appointmentId) {
        return {
          success: false,
          error: 'Mindbody booking succeeded but no appointment ID returned',
        };
      }
      return { success: true, appointmentId: String(appointmentId) };
    } catch (error) {
      this.logger.error('MindBody book appointment error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }

  private async resolveOrCreateClient(
    apiKey: string,
    siteHeader: string,
    accessToken: string,
    patient: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    },
  ): Promise<string | null> {
    try {
      // Try search by email
      if (patient.email) {
        const searchRes = await fetch(
          `${this.MINDBODY_API_BASE_URL}client/clients?SearchText=${encodeURIComponent(patient.email)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'API-Key': apiKey,
              SiteId: siteHeader,
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
        if (searchRes.ok) {
          const data = await searchRes.json();
          const found = data?.Clients?.find(
            (c: any) => c?.Email === patient.email,
          );
          if (found?.Id || found?.ID) return String(found.Id || found.ID);
        }
      }

      // Create client if we have minimum info
      const { firstName, lastName } = this.nameToParts(patient.name || '');
      const addRes = await fetch(
        `${this.MINDBODY_API_BASE_URL}client/addclient`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'API-Key': apiKey,
            SiteId: siteHeader,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            Client: {
              FirstName: firstName || 'Client',
              LastName: lastName || 'Unknown',
              Email: patient.email || undefined,
              MobilePhone: patient.phone
                ? this.normalizePhone(patient.phone)
                : undefined,
              SendAccountEmails: false,
              SendScheduleEmails: false,
            },
          }),
        },
      );
      if (!addRes.ok) return null;
      const body = await addRes.json().catch(() => ({}));
      const client = body?.Client || body?.Clients?.[0];
      const clientId = client?.Id || client?.ID;
      return clientId ? String(clientId) : null;
    } catch (e) {
      this.logger.warn('Mindbody client resolve/create failed', e as any);
    }
    return null;
  }

  private nameToParts(full: string): { firstName: string; lastName: string } {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  private normalizePhone(phone?: string | null): string | undefined {
    if (!phone) return undefined;
    // Keep digits and leading plus
    const cleaned = phone.replace(/[^+\d]/g, '');
    return cleaned || undefined;
  }

  async addClient(clientData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth?: Date;
  }) {
    // TODO: Implement MindBody client creation API call
    // This is a placeholder implementation
    console.log('Adding client to MindBody:', clientData);

    // Mock response for now - replace with actual MindBody API call
    return {
      id: `mb_${Date.now()}`,
      mindbodyId: `mb_${Date.now()}`,
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      email: clientData.email,
      phone: clientData.phone,
    };
  }
}
