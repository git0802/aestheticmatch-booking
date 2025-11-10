import { Injectable, Logger } from '@nestjs/common';
import { NextechCheckCredentialsDto } from './dto/check-credentials.dto';
import {
  NextechCredentialResponse,
  NextechPatientInfo,
} from './dto/nextech-response.dto';
import {
  NextechClientData,
  NextechClientResponse,
  NextechAuthCredentials,
} from './interfaces/client.interface';

class NextechApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: any,
  ) {
    super(message);
  }
}

@Injectable()
export class NextechService {
  private readonly logger = new Logger(NextechService.name);

  private buildHeaders(
    username: string,
    password: string,
    token?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
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

  private normalizePhone(phone?: string | null): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  private formatBirthDate(date?: Date): string | undefined {
    if (!date) return undefined;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async authenticate(
    credentials: NextechAuthCredentials,
  ): Promise<{ token: string; expiresAt: string }> {
    const authUrl = `${credentials.baseUrl}/oauth/token`;

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          username: credentials.username,
          password: credentials.password,
          ...(credentials.practiceId && { practice_id: credentials.practiceId }),
        }).toString(),
      });

      if (!response.ok) {
        const payload = await this.safeJson(response);
        const message =
          payload?.error_description ||
          payload?.error ||
          `Authentication failed: HTTP ${response.status}`;
        throw new NextechApiError(message, response.status, payload);
      }

      const data = await this.safeJson(response);
      if (!data?.access_token) {
        throw new NextechApiError('No access token received from Nextech');
      }

      return {
        token: data.access_token,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : new Date(Date.now() + 3600000).toISOString(),
      };
    } catch (error) {
      if (error instanceof NextechApiError) {
        throw error;
      }
      throw new NextechApiError(
        `Failed to authenticate with Nextech: ${error.message}`,
      );
    }
  }

  async checkCredentials(
    dto: NextechCheckCredentialsDto,
  ): Promise<NextechCredentialResponse> {
    try {
      const { token, expiresAt } = await this.authenticate({
        baseUrl: dto.baseUrl,
        username: dto.username,
        password: dto.password,
        practiceId: dto.practiceId,
      });

      this.logger.log('Nextech credentials validated successfully');
      return {
        success: true,
        token,
        expiresAt,
      };
    } catch (error) {
      this.logger.error('Nextech credential validation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during validation',
      };
    }
  }

  private async findPatientByEmail(
    credentials: NextechAuthCredentials,
    email: string,
  ): Promise<any | null> {
    try {
      const { token } = await this.authenticate(credentials);
      const searchUrl = `${credentials.baseUrl}/api/v1/patients?email=${encodeURIComponent(email)}`;

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: this.buildHeaders(credentials.username, credentials.password, token),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to search patient by email: HTTP ${response.status}`);
        return null;
      }

      const data = await this.safeJson(response);
      const patients = Array.isArray(data?.patients) ? data.patients : [];
      
      return patients.find(
        (p: any) => p?.email?.toLowerCase() === email.toLowerCase(),
      ) || null;
    } catch (error) {
      this.logger.error('Error searching patient by email:', error);
      return null;
    }
  }

  async addClient(params: {
    credentials: NextechAuthCredentials;
    client: NextechClientData;
  }): Promise<NextechClientResponse | null> {
    try {
      const existing = await this.findPatientByEmail(
        params.credentials,
        params.client.email,
      );

      if (existing) {
        this.logger.log(`Patient already exists in Nextech: ${existing.patient_id}`);
        return {
          id: existing.patient_id,
          nextechId: existing.patient_id,
          firstName: existing.first_name || params.client.firstName,
          lastName: existing.last_name || params.client.lastName,
          email: existing.email || params.client.email,
          phone: existing.phone || params.client.phone,
        };
      }

      const { token } = await this.authenticate(params.credentials);
      const createUrl = `${params.credentials.baseUrl}/api/v1/patients`;

      const patientData = {
        first_name: params.client.firstName,
        last_name: params.client.lastName,
        email: params.client.email,
        phone: this.normalizePhone(params.client.phone),
        ...(params.client.dateOfBirth && {
          date_of_birth: this.formatBirthDate(params.client.dateOfBirth),
        }),
      };

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: this.buildHeaders(params.credentials.username, params.credentials.password, token),
        body: JSON.stringify(patientData),
      });

      if (!response.ok) {
        const payload = await this.safeJson(response);
        throw new NextechApiError(
          `Failed to create patient: ${payload?.error || response.statusText}`,
          response.status,
          payload,
        );
      }

      const data = await this.safeJson(response);
      const patientId = data?.patient_id || data?.id;

      if (!patientId) {
        throw new NextechApiError('No patient ID returned from Nextech');
      }

      this.logger.log(`Created new patient in Nextech: ${patientId}`);
      return {
        id: patientId,
        nextechId: patientId,
        firstName: params.client.firstName,
        lastName: params.client.lastName,
        email: params.client.email,
        phone: params.client.phone,
      };
    } catch (error) {
      this.logger.error('Failed to add client to Nextech:', error);
      throw error;
    }
  }

  async bookAppointment(
    credentials: NextechAuthCredentials,
    payload: {
      startDateTime: string;
      notes?: string;
      providerId?: string | number;
      locationId?: string | number;
      appointmentTypeId?: string | number;
      patientId?: string;
      patient?: {
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        phone?: string | null;
        dateOfBirth?: Date | null;
      };
    },
  ): Promise<{
    success: boolean;
    appointmentId?: string;
    error?: string;
    patientId?: string;
  }> {
    try {
      const { token } = await this.authenticate(credentials);

      let patientId = payload.patientId;

      if (!patientId && payload.patient) {
        const patientResponse = await this.addClient({
          credentials,
          client: {
            firstName: payload.patient.firstName || 'Patient',
            lastName: payload.patient.lastName || 'Unknown',
            email: payload.patient.email || '',
            phone: payload.patient.phone || '',
            dateOfBirth: payload.patient.dateOfBirth || undefined,
          },
        });

        if (patientResponse) {
          patientId = patientResponse.id;
        }
      }

      if (!patientId) {
        return {
          success: false,
          error: 'Patient ID is required for booking',
        };
      }

      if (!payload.providerId || !payload.locationId || !payload.appointmentTypeId) {
        const missing: string[] = [];
        if (!payload.providerId) missing.push('providerId');
        if (!payload.locationId) missing.push('locationId');
        if (!payload.appointmentTypeId) missing.push('appointmentTypeId');

        return {
          success: false,
          error: `Nextech booking requires all parameters. Missing: ${missing.join(', ')}`,
          patientId,
        };
      }

      const appointmentUrl = `${credentials.baseUrl}/api/v1/appointments`;
      const appointmentData = {
        patient_id: patientId,
        provider_id: payload.providerId,
        location_id: payload.locationId,
        appointment_type_id: payload.appointmentTypeId,
        start_date_time: payload.startDateTime,
        notes: payload.notes || '',
      };

      const response = await fetch(appointmentUrl, {
        method: 'POST',
        headers: this.buildHeaders(credentials.username, credentials.password, token),
        body: JSON.stringify(appointmentData),
      });

      if (!response.ok) {
        const errorPayload = await this.safeJson(response);
        const errorMsg = errorPayload?.error || errorPayload?.message || `HTTP ${response.status}`;
        this.logger.error(`Nextech booking failed: ${errorMsg}`);

        return {
          success: false,
          error: `Nextech booking failed: ${errorMsg}`,
          patientId,
        };
      }

      const data = await this.safeJson(response);
      const appointmentId = data?.appointment_id || data?.id;

      if (!appointmentId) {
        return {
          success: false,
          error: 'No appointment ID returned from Nextech',
          patientId,
        };
      }

      this.logger.log(`Successfully booked appointment in Nextech: ${appointmentId}`);
      return {
        success: true,
        appointmentId: String(appointmentId),
        patientId,
      };
    } catch (error) {
      this.logger.error('Nextech booking error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        patientId: payload.patientId,
      };
    }
  }

  async getProviders(credentials: NextechAuthCredentials): Promise<any[]> {
    try {
      const { token } = await this.authenticate(credentials);
      const url = `${credentials.baseUrl}/api/v1/providers`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(credentials.username, credentials.password, token),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch providers: HTTP ${response.status}`);
        return [];
      }

      const data = await this.safeJson(response);
      return Array.isArray(data?.providers) ? data.providers : [];
    } catch (error) {
      this.logger.error('Error fetching providers:', error);
      return [];
    }
  }

  async getLocations(credentials: NextechAuthCredentials): Promise<any[]> {
    try {
      const { token } = await this.authenticate(credentials);
      const url = `${credentials.baseUrl}/api/v1/locations`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(credentials.username, credentials.password, token),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch locations: HTTP ${response.status}`);
        return [];
      }

      const data = await this.safeJson(response);
      return Array.isArray(data?.locations) ? data.locations : [];
    } catch (error) {
      this.logger.error('Error fetching locations:', error);
      return [];
    }
  }

  async getAppointmentTypes(credentials: NextechAuthCredentials): Promise<any[]> {
    try {
      const { token } = await this.authenticate(credentials);
      const url = `${credentials.baseUrl}/api/v1/appointment-types`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(credentials.username, credentials.password, token),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch appointment types: HTTP ${response.status}`);
        return [];
      }

      const data = await this.safeJson(response);
      return Array.isArray(data?.appointment_types) ? data.appointment_types : [];
    } catch (error) {
      this.logger.error('Error fetching appointment types:', error);
      return [];
    }
  }

  async resolveBookingParams(params: {
    credentials: NextechAuthCredentials;
    desiredStartDateTime?: string;
  }): Promise<{
    providerId?: string | number;
    locationId?: string | number;
    appointmentTypeId?: string | number;
  }> {
    try {
      const [providers, locations, appointmentTypes] = await Promise.all([
        this.getProviders(params.credentials),
        this.getLocations(params.credentials),
        this.getAppointmentTypes(params.credentials),
      ]);

      const result: any = {};

      if (providers.length > 0) {
        result.providerId = providers[0].provider_id || providers[0].id;
      }

      if (locations.length > 0) {
        result.locationId = locations[0].location_id || locations[0].id;
      }

      if (appointmentTypes.length > 0) {
        const consultType = appointmentTypes.find((type: any) =>
          (type.name || type.description || '').toLowerCase().includes('consult'),
        );
        result.appointmentTypeId = consultType
          ? (consultType.appointment_type_id || consultType.id)
          : (appointmentTypes[0].appointment_type_id || appointmentTypes[0].id);
      }

      this.logger.log(`Resolved Nextech params: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('Error resolving Nextech booking params:', error);
      return {};
    }
  }
}
