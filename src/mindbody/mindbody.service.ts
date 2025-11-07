import { Injectable, Logger } from '@nestjs/common';
import { CheckCredentialsDto } from './dto/check-credentials.dto';
import {
  MindBodyCredentialResponse,
  MindBodySiteInfo,
} from './dto/mindbody-response.dto';
import {
  MindBodyClientData,
  MindBodyClientResponse,
} from './interfaces/client.interface';

interface MindbodyAuthCredentials {
  apiKey: string;
  username: string;
  password: string;
  siteId?: string;
}

class MindbodyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: any,
  ) {
    super(message);
  }
}

@Injectable()
export class MindbodyService {
  private readonly logger = new Logger(MindbodyService.name);
  private readonly MINDBODY_API_BASE_URL =
    'https://api.mindbodyonline.com/public/v6/';

  private normalizeSiteId(siteId?: string | null): string {
    return String(siteId ?? '-99');
  }

  private buildHeaders(
    apiKey: string,
    siteHeader: string,
    accessToken?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'API-Key': apiKey,
      SiteId: siteHeader,
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  }

  private async safeJson(response: any): Promise<any> {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  private async issueUserToken(
    credentials: MindbodyAuthCredentials,
  ): Promise<{ accessToken: string; siteHeader: string; token: any }> {
    const siteHeader = this.normalizeSiteId(credentials.siteId);
    const tokenResponse = await fetch(
      `${this.MINDBODY_API_BASE_URL}usertoken/issue`,
      {
        method: 'POST',
        headers: this.buildHeaders(credentials.apiKey, siteHeader),
        body: JSON.stringify({
          Username: credentials.username,
          Password: credentials.password,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const payload = await this.safeJson(tokenResponse);
      const message =
        payload?.Error?.Message ||
        `Authentication failed: HTTP ${tokenResponse.status}: ${tokenResponse.statusText}`;
      throw new MindbodyApiError(message, tokenResponse.status, payload);
    }

    const tokenData = await this.safeJson(tokenResponse);
    if (!tokenData?.AccessToken) {
      throw new MindbodyApiError(
        'Authentication failed: No access token received',
      );
    }

    return {
      accessToken: tokenData.AccessToken,
      siteHeader,
      token: tokenData,
    };
  }

  private async fetchClientsBySearch(
    apiKey: string,
    siteHeader: string,
    accessToken: string,
    search: string,
  ): Promise<any[]> {
    const response = await fetch(
      `${this.MINDBODY_API_BASE_URL}client/clients?SearchText=${encodeURIComponent(search)}`,
      {
        method: 'GET',
        headers: this.buildHeaders(apiKey, siteHeader, accessToken),
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload = await this.safeJson(response);
    return Array.isArray(payload?.Clients) ? payload.Clients : [];
  }

  private async findClientByEmail(
    apiKey: string,
    siteHeader: string,
    accessToken: string,
    email: string,
  ): Promise<any | null> {
    const clients = await this.fetchClientsBySearch(
      apiKey,
      siteHeader,
      accessToken,
      email,
    );
    const lower = email.toLowerCase();
    return (
      clients.find(
        (client: any) =>
          typeof client?.Email === 'string' &&
          client.Email.toLowerCase() === lower,
      ) || null
    );
  }

  private async findClientByPhone(
    apiKey: string,
    siteHeader: string,
    accessToken: string,
    phone?: string | null,
  ): Promise<any | null> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) {
      return null;
    }
    const clients = await this.fetchClientsBySearch(
      apiKey,
      siteHeader,
      accessToken,
      normalized,
    );
    return (
      clients.find((client: any) => {
        const clientPhone = this.normalizePhone(
          client?.MobilePhone || client?.HomePhone || client?.WorkPhone,
        );
        return clientPhone === normalized;
      }) || null
    );
  }

  private formatBirthDate(date?: Date): string | undefined {
    if (!date) return undefined;
    const iso = new Date(date).toISOString();
    return `${iso.split('T')[0]}T00:00:00`;
  }

  private buildClientPayload(client: MindBodyClientData): { Client: any } {
    // Trim and validate firstName and lastName - also remove any non-printable characters
    const firstName = (client.firstName?.trim() || '').replace(
      /[\u0000-\u001F\u007F-\u009F]/g,
      '',
    );
    const lastName = (client.lastName?.trim() || '').replace(
      /[\u0000-\u001F\u007F-\u009F]/g,
      '',
    );

    // Log the raw values for debugging
    this.logger.log(
      `Building client payload with firstName: "${firstName}" (length: ${firstName.length}), lastName: "${lastName}" (length: ${lastName.length})`,
    );
    this.logger.log(
      `Raw input - firstName: "${client.firstName}" (length: ${client.firstName?.length}), lastName: "${client.lastName}" (length: ${client.lastName?.length})`,
    );

    // Validate that we have actual names (not empty strings after trim)
    if (!firstName || firstName.length === 0) {
      throw new MindbodyApiError(
        `Patient firstName is required but was empty. Raw value: "${client.firstName}"`,
      );
    }
    if (!lastName || lastName.length === 0) {
      throw new MindbodyApiError(
        `Patient lastName is required but was empty. Raw value: "${client.lastName}"`,
      );
    }

    // Build the client payload with required fields - ensure values are plain strings
    const payload: any = {
      FirstName: firstName,
      LastName: lastName,
      SendAccountEmails: false,
      SendAccountTexts: false,
      SendScheduleEmails: false,
      SendScheduleTexts: false,
      SendPromotionalEmails: false,
      SendPromotionalTexts: false,
    };

    // Add UniqueId if email is available (some Mindbody sandbox environments require this)
    if (client.email?.trim()) {
      const cleanEmail = client.email.trim();
      payload.UniqueId = cleanEmail;
      payload.Email = cleanEmail;
    }

    const normalizedPhone = this.normalizePhone(client.phone);
    if (normalizedPhone) {
      payload.MobilePhone = normalizedPhone;
    }

    const birthDate = this.formatBirthDate(client.dateOfBirth);
    if (birthDate) {
      payload.BirthDate = birthDate;
    }

    this.logger.log(`Final payload keys: ${Object.keys(payload).join(', ')}`);
    this.logger.log(
      `Final payload values - FirstName: "${payload.FirstName}", LastName: "${payload.LastName}"`,
    );

    return { Client: payload };
  }

  private extractClient(
    raw: any,
    fallback?: Partial<MindBodyClientData>,
  ): MindBodyClientResponse {
    const id = raw?.Id || raw?.ID || raw?.ClientId || raw?.ClientID;
    if (!id) {
      throw new MindbodyApiError(
        'Mindbody response did not include a client identifier',
      );
    }

    return {
      id: String(id),
      mindbodyId: String(id),
      firstName: raw?.FirstName || fallback?.firstName || '',
      lastName: raw?.LastName || fallback?.lastName || '',
      email: raw?.Email || fallback?.email || '',
      phone:
        raw?.MobilePhone ||
        raw?.HomePhone ||
        raw?.WorkPhone ||
        fallback?.phone ||
        '',
    };
  }

  private async createClientWithToken(
    apiKey: string,
    siteHeader: string,
    accessToken: string,
    client: MindBodyClientData,
  ): Promise<MindBodyClientResponse> {
    const payload = this.buildClientPayload(client);
    const requestBody = JSON.stringify(payload.Client);
    this.logger.log(`Creating Mindbody client with payload: ${requestBody}`);
    this.logger.log(
      `Request headers: ${JSON.stringify(this.buildHeaders(apiKey, siteHeader, accessToken))}`,
    );

    const response = await fetch(
      `${this.MINDBODY_API_BASE_URL}client/addclient`,
      {
        method: 'POST',
        headers: this.buildHeaders(apiKey, siteHeader, accessToken),
        body: requestBody,
      },
    );

    if (!response.ok) {
      const errorPayload = await this.safeJson(response);
      this.logger.error(
        'Mindbody API error response:',
        JSON.stringify(errorPayload, null, 2),
      );
      this.logger.error(
        'Request payload was:',
        JSON.stringify(payload, null, 2),
      );
      this.logger.error(
        'Response status:',
        response.status,
        response.statusText,
      );
      const message =
        errorPayload?.Error?.Message ||
        errorPayload?.Message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new MindbodyApiError(message, response.status, errorPayload);
    }

    const result = await this.safeJson(response);
    const rawClient = result?.Client || result?.Clients?.[0];
    if (!rawClient) {
      throw new MindbodyApiError(
        'Mindbody add client succeeded but returned no client data',
      );
    }

    return this.extractClient(rawClient, client);
  }

  async checkCredentials(
    credentials: CheckCredentialsDto,
  ): Promise<MindBodyCredentialResponse> {
    const { apiKey, username, password, siteId } = credentials;

    try {
      const { accessToken, siteHeader } = await this.issueUserToken({
        apiKey,
        username,
        password,
        siteId,
      });

      const siteResponse = await fetch(
        `${this.MINDBODY_API_BASE_URL}site/sites`,
        {
          method: 'GET',
          headers: this.buildHeaders(apiKey, siteHeader, accessToken),
        },
      );

      if (!siteResponse.ok) {
        const errorData = await this.safeJson(siteResponse);
        const errorMessage =
          errorData.Error?.Message ||
          `HTTP ${siteResponse.status}: ${siteResponse.statusText}`;

        this.logger.error(`Mindbody site info request failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const siteData: MindBodySiteInfo = await siteResponse.json();

      this.logger.log('Mindbody credentials validated successfully');
      return {
        success: true,
        sites: siteData,
      };
    } catch (error) {
      if (error instanceof MindbodyApiError) {
        let errorMessage = error.message;
        if (
          errorMessage.includes('Staff identity authentication failed') ||
          errorMessage.includes('staff identity')
        ) {
          errorMessage = `${errorMessage}. This typically means:\n1. You need to provide a valid Site ID (the numeric ID of your Mindbody business)\n2. The API key is business-specific (not an aggregator key)\n3. The staff username/password don't have API access permissions in Mindbody\n\nPlease check your Mindbody account settings and ensure the Site ID is correct.`;
        }
        this.logger.error(`Mindbody authentication failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }

      this.logger.error('Mindbody credential check error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch available locations for the business.
   */
  async getLocations(credentials: MindbodyAuthCredentials): Promise<any[]> {
    try {
      const { accessToken, siteHeader } =
        await this.issueUserToken(credentials);
      const res = await fetch(`${this.MINDBODY_API_BASE_URL}site/locations`, {
        method: 'GET',
        headers: this.buildHeaders(credentials.apiKey, siteHeader, accessToken),
      });
      if (!res.ok) return [];
      const data = await this.safeJson(res);
      return Array.isArray(data?.Locations) ? data.Locations : [];
    } catch (e) {
      this.logger.warn('Mindbody getLocations failed', e);
      return [];
    }
  }

  /**
   * Fetch available session types.
   */
  async getSessionTypes(credentials: MindbodyAuthCredentials): Promise<any[]> {
    try {
      const { accessToken, siteHeader } =
        await this.issueUserToken(credentials);
      const res = await fetch(
        `${this.MINDBODY_API_BASE_URL}site/sessiontypes`,
        {
          method: 'GET',
          headers: this.buildHeaders(
            credentials.apiKey,
            siteHeader,
            accessToken,
          ),
        },
      );
      if (!res.ok) return [];
      const data = await this.safeJson(res);
      return Array.isArray(data?.SessionTypes) ? data.SessionTypes : [];
    } catch (e) {
      this.logger.warn('Mindbody getSessionTypes failed', e);
      return [];
    }
  }

  /**
   * Fetch bookable items (availabilities) given location + sessionType.
   * Optionally restrict by locationId/sessionTypeId lists.
   */
  async getBookableItems(params: {
    credentials: MindbodyAuthCredentials;
    locationId: number | string;
    sessionTypeId: number | string;
  }): Promise<any[]> {
    try {
      const { credentials, locationId, sessionTypeId } = params;
      const { accessToken, siteHeader } =
        await this.issueUserToken(credentials);
      const url = `${this.MINDBODY_API_BASE_URL}appointment/bookableitems?sessionTypeIds=${encodeURIComponent(
        String(sessionTypeId),
      )}&locationIds=${encodeURIComponent(String(locationId))}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(credentials.apiKey, siteHeader, accessToken),
      });
      if (!res.ok) return [];
      const data = await this.safeJson(res);
      return Array.isArray(data?.BookableItems)
        ? data.BookableItems
        : Array.isArray(data?.Availabilities)
          ? data.Availabilities
          : [];
    } catch (e) {
      this.logger.warn('Mindbody getBookableItems failed', e);
      return [];
    }
  }

  /**
   * Best-effort resolution of booking parameters (staff/location/sessionType)
   * when they are not explicitly configured. We pick the first sensible
   * entries, preferring names that contain "consult" for session type.
   */
  async resolveBookingParams(params: {
    credentials: MindbodyAuthCredentials;
    desiredStartDateTime?: string; // ISO string used only for future enhancement
  }): Promise<{
    locationId?: number | string;
    sessionTypeId?: number | string;
    staffId?: number | string;
    debug?: any;
  }> {
    const debug: any = {};
    try {
      const { credentials } = params;
      // Re-use underlying token issuance once so we don't duplicate network calls unnecessarily.
      // (Issue token separately inside helper methods today; future optimization could share it.)
      const locations = await this.getLocations(credentials);
      debug.locationsCount = locations.length;
      const location =
        locations.find((l: any) => l?.Id || l?.ID) || locations[0];
      const locationId = location ? location.Id || location.ID : undefined;

      const sessionTypes = await this.getSessionTypes(credentials);
      debug.sessionTypesCount = sessionTypes.length;
      const preferred = sessionTypes.find((s: any) =>
        String(s?.Name || s?.NameDisplay || '')
          .toLowerCase()
          .includes('consult'),
      );
      const sessionType = preferred || sessionTypes[0];
      const sessionTypeId = sessionType
        ? sessionType.Id || sessionType.ID
        : undefined;

      let staffId: number | string | undefined = undefined;
      if (locationId && sessionTypeId) {
        const bookable = await this.getBookableItems({
          credentials,
          locationId,
          sessionTypeId,
        });
        debug.bookableItemsCount = bookable.length;
        // Bookable items may have Staff or Availability objects
        const first = bookable[0];
        const staff = first?.Staff || first?.staff || first?.AppointmentStaff;
        staffId = staff?.Id || staff?.ID;
      }

      return { locationId, sessionTypeId, staffId, debug };
    } catch (e) {
      this.logger.warn('resolveBookingParams failed', e);
      return { debug: { error: (e as Error).message, ...debug } } as any;
    }
  }

  /**
   * Attempt to book an appointment in Mindbody.
   * Note: Real booking requires mapped staffId, locationId, sessionTypeId, and a Mindbody clientId.
   * This implementation validates credentials and returns a descriptive error until mapping is provided.
   */
  async bookAppointment(
    credentials: MindbodyAuthCredentials,
    payload: {
      startDateTime: string;
      notes?: string;
      // Note: practice connectorConfig field has been removed
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
  ): Promise<{
    success: boolean;
    appointmentId?: string;
    error?: string;
    clientId?: string; // client id used for booking if resolved/created
  }> {
    try {
      const { accessToken, siteHeader } =
        await this.issueUserToken(credentials);

      if (
        !payload.clientId ||
        !payload.staffId ||
        !payload.locationId ||
        !payload.sessionTypeId
      ) {
        // Attempt to resolve a client on the fly if missing
        if (!payload.clientId && payload.patient) {
          const resolvedClientId = await this.resolveOrCreateClient(
            credentials.apiKey,
            siteHeader,
            accessToken,
            payload.patient,
          );
          if (resolvedClientId) {
            payload.clientId = resolvedClientId;
          }
        }

        // Check if all required parameters are present
        if (
          !payload.clientId ||
          !payload.staffId ||
          !payload.locationId ||
          !payload.sessionTypeId
        ) {
          // Still missing scheduling parameters
          const missingParams: string[] = [];
          if (!payload.clientId) missingParams.push('clientId');
          if (!payload.staffId) missingParams.push('staffId');
          if (!payload.locationId) missingParams.push('locationId');
          if (!payload.sessionTypeId) missingParams.push('sessionTypeId');

          return {
            success: false,
            error: `Mindbody booking requires all parameters. Missing: ${missingParams.join(', ')}. Provide these values in the request or configure defaults on the practice.`,
            clientId: payload.clientId,
          };
        }
      }

      const bookingRes = await fetch(
        `${this.MINDBODY_API_BASE_URL}appointment/addappointment`,
        {
          method: 'POST',
          headers: this.buildHeaders(
            credentials.apiKey,
            siteHeader,
            accessToken,
          ),
          body: JSON.stringify({
            StartDateTime: payload.startDateTime,
            LocationId: Number(payload.locationId),
            StaffId: Number(payload.staffId),
            ClientId: payload.clientId ? String(payload.clientId) : undefined,
            SessionTypeId: Number(payload.sessionTypeId),
            Notes: payload.notes ?? undefined,
            SendEmail: false,
            Test: false,
          }),
        },
      );

      if (!bookingRes.ok) {
        const errorData = await this.safeJson(bookingRes);
        const msg =
          errorData?.Error?.Message ||
          errorData?.Message ||
          `HTTP ${bookingRes.status}: ${bookingRes.statusText}`;
        return {
          success: false,
          error: `Mindbody booking failed: ${msg}`,
          clientId: payload.clientId,
        };
      }

      const responseBody = await this.safeJson(bookingRes);
      const appt = responseBody?.Appointment;
      const appointmentId = appt?.Id || appt?.AppointmentId || appt?.ID;
      if (!appointmentId) {
        return {
          success: false,
          error: 'Mindbody booking succeeded but no appointment ID returned',
          clientId: payload.clientId,
        };
      }
      return {
        success: true,
        appointmentId: String(appointmentId),
        clientId: payload.clientId,
      };
    } catch (error) {
      if (error instanceof MindbodyApiError) {
        return { success: false, error: error.message };
      }
      this.logger.error('Mindbody book appointment error:', error);
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
      if (patient.email) {
        const foundByEmail = await this.findClientByEmail(
          apiKey,
          siteHeader,
          accessToken,
          patient.email,
        );
        if (foundByEmail?.Id || foundByEmail?.ID) {
          const clientId = foundByEmail.Id || foundByEmail.ID;
          return clientId ? String(clientId) : null;
        }
      }

      if (patient.phone) {
        const foundByPhone = await this.findClientByPhone(
          apiKey,
          siteHeader,
          accessToken,
          patient.phone,
        );
        if (foundByPhone?.Id || foundByPhone?.ID) {
          const clientId = foundByPhone.Id || foundByPhone.ID;
          return clientId ? String(clientId) : null;
        }
      }

      const { firstName, lastName } = this.nameToParts(patient.name || '');
      const created = await this.createClientWithToken(
        apiKey,
        siteHeader,
        accessToken,
        {
          firstName: firstName || 'Client',
          lastName: lastName || 'Unknown',
          email: patient.email || '',
          phone: patient.phone || '',
        },
      );
      return created?.id ?? null;
    } catch (e) {
      this.logger.warn('Mindbody client resolve/create failed', e);
    }
    return null;
  }

  private nameToParts(full: string): { firstName: string; lastName: string } {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: 'Client', lastName: 'Unknown' };
    if (parts.length === 1) return { firstName: parts[0], lastName: 'Unknown' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  private normalizePhone(phone?: string | null): string | undefined {
    if (!phone) return undefined;
    // Keep digits and leading plus
    const cleaned = phone.replace(/[^+\d]/g, '');
    return cleaned || undefined;
  }

  async addClient(params: {
    credentials: MindbodyAuthCredentials;
    client: MindBodyClientData;
  }): Promise<MindBodyClientResponse> {
    const { credentials, client } = params;

    try {
      const { accessToken, siteHeader } =
        await this.issueUserToken(credentials);

      if (client.email) {
        const existing = await this.findClientByEmail(
          credentials.apiKey,
          siteHeader,
          accessToken,
          client.email,
        );
        if (existing) {
          return this.extractClient(existing, client);
        }
      }

      if (client.phone) {
        const existingByPhone = await this.findClientByPhone(
          credentials.apiKey,
          siteHeader,
          accessToken,
          client.phone,
        );
        if (existingByPhone) {
          return this.extractClient(existingByPhone, client);
        }
      }

      return await this.createClientWithToken(
        credentials.apiKey,
        siteHeader,
        accessToken,
        client,
      );
    } catch (error) {
      this.logger.error('Mindbody add client error:', error);
      if (error instanceof MindbodyApiError) {
        throw error;
      }
      throw error instanceof Error
        ? error
        : new Error('Unknown error occurred while creating Mindbody client');
    }
  }
}
