import { Injectable, Logger } from '@nestjs/common';
import {
  ModmedAuthCredentials,
  ModmedClientData,
  ModmedClientResponse,
  ModmedAppointmentData,
  ModmedBookingResponse,
} from './interfaces/client.interface';
import {
  ModmedCredentialResponse,
  ModmedPatientInfo,
  ModmedAppointmentInfo,
  ModmedProviderInfo,
  ModmedLocationInfo,
  ModmedAppointmentTypeInfo,
} from './dto/modmed-response.dto';
import { ModmedCheckCredentialsDto } from './dto/check-credentials.dto';

@Injectable()
export class ModmedService {
  private readonly logger = new Logger(ModmedService.name);
  private tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();

  /**
   * Authenticate with ModMed API using OAuth 2.0 client credentials flow
   */
  async authenticate(credentials: ModmedAuthCredentials): Promise<string> {
    try {
      const cacheKey = `${credentials.baseUrl}:${credentials.clientId}`;
      const cached = this.tokenCache.get(cacheKey);

      // Return cached token if still valid (with 5 minute buffer)
      if (cached && cached.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
        this.logger.debug('Using cached ModMed token');
        return cached.token;
      }

      this.logger.log('Authenticating with ModMed API');
      
      const response = await fetch(
        `${credentials.baseUrl}/oauth/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const { access_token, expires_in } = data;
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      // Cache the token
      this.tokenCache.set(cacheKey, {
        token: access_token,
        expiresAt,
      });

      this.logger.log('ModMed authentication successful');
      return access_token;
    } catch (error) {
      this.logger.error('ModMed authentication failed', error.message);
      throw new Error(`ModMed authentication failed: ${error.message}`);
    }
  }

  /**
   * Make an authenticated API request to ModMed
   */
  private async makeRequest(
    credentials: ModmedAuthCredentials,
    endpoint: string,
    options: RequestInit = {},
  ): Promise<any> {
    const token = await this.authenticate(credentials);
    
    const url = `${credentials.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Check if credentials are valid
   */
  async checkCredentials(
    dto: ModmedCheckCredentialsDto,
  ): Promise<ModmedCredentialResponse> {
    try {
      this.logger.log('Checking ModMed credentials');
      
      const credentials: ModmedAuthCredentials = {
        baseUrl: dto.baseUrl,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret,
        practiceId: dto.practiceId,
      };

      const token = await this.authenticate(credentials);

      // Try to fetch providers to verify the token works
      await this.makeRequest(credentials, '/providers?limit=1');

      return {
        success: true,
        token,
        practiceId: dto.practiceId,
      };
    } catch (error) {
      this.logger.error('ModMed credential check failed', error.message);
      return {
        success: false,
        error: error.message || 'Failed to validate ModMed credentials',
      };
    }
  }

  /**
   * Find patient by email
   */
  async findPatientByEmail(
    credentials: ModmedAuthCredentials,
    email: string,
  ): Promise<ModmedPatientInfo | null> {
    try {
      this.logger.log(`Searching for ModMed patient with email: ${email}`);
      
      const data = await this.makeRequest(
        credentials,
        `/patients?email=${encodeURIComponent(email)}&limit=1`,
      );

      const patients = data.data || data.patients || [];
      
      if (patients.length > 0) {
        const patient = patients[0];
        this.logger.log(`Found ModMed patient: ${patient.id}`);
        return {
          id: patient.id,
          firstName: patient.first_name || patient.firstName,
          lastName: patient.last_name || patient.lastName,
          email: patient.email,
          phone: patient.phone || patient.mobile_phone,
          dateOfBirth: patient.date_of_birth || patient.dateOfBirth,
        };
      }

      this.logger.log('No ModMed patient found with that email');
      return null;
    } catch (error) {
      this.logger.error('Error searching for ModMed patient', error.message);
      throw error;
    }
  }

  /**
   * Create a new patient in ModMed
   */
  async createPatient(
    credentials: ModmedAuthCredentials,
    clientData: ModmedClientData,
  ): Promise<ModmedClientResponse> {
    try {
      this.logger.log(`Creating ModMed patient: ${clientData.email}`);
      
      const payload = {
        first_name: clientData.firstName,
        last_name: clientData.lastName,
        email: clientData.email,
        phone: clientData.phone,
        date_of_birth: clientData.dateOfBirth?.toISOString().split('T')[0],
        address: clientData.address ? {
          street: clientData.address.street,
          city: clientData.address.city,
          state: clientData.address.state,
          zip_code: clientData.address.zipCode,
        } : undefined,
      };

      const data = await this.makeRequest(credentials, '/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const patient = data.data || data;

      this.logger.log(`Created ModMed patient: ${patient.id}`);
      
      return {
        id: patient.id,
        modmedId: patient.id,
        firstName: patient.first_name || patient.firstName,
        lastName: patient.last_name || patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.date_of_birth || patient.dateOfBirth,
      };
    } catch (error) {
      this.logger.error('Error creating ModMed patient', error.message);
      throw error;
    }
  }

  /**
   * Get or create a patient (find existing or create new)
   */
  async addClient(
    credentials: ModmedAuthCredentials,
    clientData: ModmedClientData,
  ): Promise<ModmedClientResponse> {
    try {
      // First, try to find existing patient
      const existingPatient = await this.findPatientByEmail(
        credentials,
        clientData.email,
      );

      if (existingPatient) {
        this.logger.log(`Using existing ModMed patient: ${existingPatient.id}`);
        return {
          id: existingPatient.id,
          modmedId: existingPatient.id,
          firstName: existingPatient.firstName,
          lastName: existingPatient.lastName,
          email: existingPatient.email || '',
          phone: existingPatient.phone,
          dateOfBirth: existingPatient.dateOfBirth,
        };
      }

      // Create new patient if not found
      return await this.createPatient(credentials, clientData);
    } catch (error) {
      this.logger.error('Error in addClient', error.message);
      throw error;
    }
  }

  /**
   * Book an appointment in ModMed
   */
  async bookAppointment(
    credentials: ModmedAuthCredentials,
    appointmentData: ModmedAppointmentData,
  ): Promise<ModmedBookingResponse> {
    try {
      this.logger.log('Creating ModMed appointment');
      
      const payload = {
        patient_id: appointmentData.patientId,
        provider_id: appointmentData.providerId,
        location_id: appointmentData.locationId,
        appointment_type_id: appointmentData.appointmentTypeId,
        start_date_time: appointmentData.startDateTime,
        duration: appointmentData.duration,
        notes: appointmentData.notes,
        status: appointmentData.status || 'scheduled',
      };

      const data = await this.makeRequest(credentials, '/appointments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const appointment = data.data || data;

      this.logger.log(`Created ModMed appointment: ${appointment.id}`);
      
      return {
        success: true,
        appointmentId: appointment.id,
        externalAppointmentId: appointment.id,
        message: 'Appointment booked successfully',
      };
    } catch (error) {
      this.logger.error('Error booking ModMed appointment', error.message);
      return {
        success: false,
        error: error.message || 'Failed to book appointment',
      };
    }
  }

  /**
   * Get providers from ModMed
   */
  async getProviders(
    credentials: ModmedAuthCredentials,
  ): Promise<ModmedProviderInfo[]> {
    try {
      this.logger.log('Fetching ModMed providers');
      
      const data = await this.makeRequest(credentials, '/providers');

      const providers = data.data || data.providers || [];
      
      return providers.map((provider) => ({
        id: provider.id,
        firstName: provider.first_name || provider.firstName,
        lastName: provider.last_name || provider.lastName,
        specialty: provider.specialty,
      }));
    } catch (error) {
      this.logger.error('Error fetching ModMed providers', error.message);
      throw error;
    }
  }

  /**
   * Get locations from ModMed
   */
  async getLocations(
    credentials: ModmedAuthCredentials,
  ): Promise<ModmedLocationInfo[]> {
    try {
      this.logger.log('Fetching ModMed locations');
      
      const data = await this.makeRequest(credentials, '/locations');

      const locations = data.data || data.locations || [];
      
      return locations.map((location) => ({
        id: location.id,
        name: location.name,
        address: location.address,
      }));
    } catch (error) {
      this.logger.error('Error fetching ModMed locations', error.message);
      throw error;
    }
  }

  /**
   * Get appointment types from ModMed
   */
  async getAppointmentTypes(
    credentials: ModmedAuthCredentials,
  ): Promise<ModmedAppointmentTypeInfo[]> {
    try {
      this.logger.log('Fetching ModMed appointment types');
      
      const data = await this.makeRequest(credentials, '/appointment-types');

      const types = data.data || data.appointmentTypes || [];
      
      return types.map((type) => ({
        id: type.id,
        name: type.name,
        duration: type.duration || type.default_duration || 30,
      }));
    } catch (error) {
      this.logger.error('Error fetching ModMed appointment types', error.message);
      throw error;
    }
  }

  /**
   * Resolve booking parameters by fetching from ModMed if not provided
   */
  async resolveBookingParams(
    credentials: ModmedAuthCredentials,
    params: Partial<{
      providerId: string;
      locationId: string;
      appointmentTypeId: string;
    }>,
  ): Promise<{
    providerId: string;
    locationId: string;
    appointmentTypeId: string;
  }> {
    try {
      let { providerId, locationId, appointmentTypeId } = params;

      // Fetch providers if providerId is not provided
      if (!providerId) {
        const providers = await this.getProviders(credentials);
        if (providers.length > 0) {
          providerId = providers[0].id;
          this.logger.log(`Auto-selected provider: ${providerId}`);
        }
      }

      // Fetch locations if locationId is not provided
      if (!locationId) {
        const locations = await this.getLocations(credentials);
        if (locations.length > 0) {
          locationId = locations[0].id;
          this.logger.log(`Auto-selected location: ${locationId}`);
        }
      }

      // Fetch appointment types if appointmentTypeId is not provided
      if (!appointmentTypeId) {
        const types = await this.getAppointmentTypes(credentials);
        if (types.length > 0) {
          appointmentTypeId = types[0].id;
          this.logger.log(`Auto-selected appointment type: ${appointmentTypeId}`);
        }
      }

      if (!providerId || !locationId || !appointmentTypeId) {
        throw new Error('Unable to resolve required booking parameters');
      }

      return { providerId, locationId, appointmentTypeId };
    } catch (error) {
      this.logger.error('Error resolving booking parameters', error.message);
      throw error;
    }
  }
}
