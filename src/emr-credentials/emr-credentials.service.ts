import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmrCredentialDto,
  EmrProviderDto,
} from './dto/create-emr-credential.dto';
import { UpdateEmrCredentialDto } from './dto/update-emr-credential.dto';
import { encryptJson, decryptJson } from '../common/crypto.util';
import { makeFingerprint } from '../common/fingerprint.util';
import { MindbodyService } from '../mindbody/mindbody.service';
// Use local type to avoid dependency on generated Prisma types before migration
type EmrProvider = 'MINDBODY' | 'NEXTECH' | 'MODMED' | 'PATIENTNOW';

@Injectable()
export class EmrCredentialsService {
  constructor(
    private prisma: PrismaService,
    private mindbody: MindbodyService,
  ) {}

  private normalizeProvider(p: EmrProviderDto | EmrProvider): EmrProvider {
    // Map DTO enum to Prisma enum (same values)
    return p as EmrProvider;
  }

  private requiredFieldsByProvider(provider: EmrProvider): string[] {
    switch (provider) {
      case 'MINDBODY':
        return ['apiKey', 'username', 'password'];
      case 'NEXTECH':
        return ['baseUrl', 'username', 'password'];
      case 'MODMED':
        return ['baseUrl', 'clientId', 'clientSecret'];
      case 'PATIENTNOW':
        return ['baseUrl', 'apiKey'];
      default:
        return [];
    }
  }

  private makeFingerprint(
    provider: EmrProvider,
    credentials: Record<string, any>,
  ): string {
    // Use identifying fields per provider
    switch (provider) {
      case 'MINDBODY':
        return makeFingerprint(provider, {
          apiKey: credentials.apiKey,
          username: credentials.username,
          siteId: credentials.siteId,
        });
      case 'NEXTECH':
        return makeFingerprint(provider, {
          baseUrl: credentials.baseUrl,
          username: credentials.username,
        });
      case 'MODMED':
        return makeFingerprint(provider, {
          baseUrl: credentials.baseUrl,
          clientId: credentials.clientId,
        });
      case 'PATIENTNOW':
        return makeFingerprint(provider, {
          baseUrl: credentials.baseUrl,
          apiKey: credentials.apiKey,
        });
      default:
        return makeFingerprint(provider, {});
    }
  }

  private async validateCredentials(
    provider: EmrProvider,
    credentials: Record<string, any>,
  ): Promise<{ ok: boolean; message?: string; data?: any }> {
    // Dispatch to provider-specific validation
    if (provider === 'MINDBODY') {
      const result = await this.mindbody.checkCredentials({
        apiKey: String(credentials.apiKey || ''),
        username: String(credentials.username || ''),
        password: String(credentials.password || ''),
        siteId: credentials.siteId ? String(credentials.siteId) : undefined,
      });
      return { ok: result.success, message: result.error, data: result.sites };
    }

    // For other providers, perform a minimal reachability check on baseUrl and required fields presence.
    const required = this.requiredFieldsByProvider(provider);
    for (const f of required) {
      if (!credentials[f]) {
        return { ok: false, message: `Missing required field: ${f}` };
      }
    }

    if (credentials.baseUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(String(credentials.baseUrl), {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        // Consider 2xx-4xx as reachable (auth endpoints may return 401)
        if (res.status >= 200 && res.status < 500) {
          return { ok: true };
        }
        return {
          ok: false,
          message: `Endpoint responded with status ${res.status}`,
        };
      } catch (e: any) {
        return {
          ok: false,
          message: `Failed to reach baseUrl: ${e?.message || e}`,
        };
      }
    }

    return { ok: true };
  }

  async create(ownerId: string, dto: CreateEmrCredentialDto) {
    const provider = this.normalizeProvider(dto.provider);

    // Required fields check
    const required = this.requiredFieldsByProvider(provider);
    for (const f of required) {
      if (!dto.credentials?.[f]) {
        throw new BadRequestException(`Missing required field: ${f}`);
      }
    }

    // Validate credentials before saving
    const validation = await this.validateCredentials(
      provider,
      dto.credentials,
    );
    if (!validation.ok) {
      throw new BadRequestException(
        `Credential validation failed: ${validation.message || 'Unknown error'}`,
      );
    }

    const fingerprint = this.makeFingerprint(provider, dto.credentials);

    // Prevent duplicates
    const existing = await (this.prisma as any).emrCredential.findUnique({
      where: { fingerprint },
    });
    if (existing) {
      throw new BadRequestException('These EMR credentials already exist.');
    }

    const encryptedData = encryptJson(dto.credentials);

    return (this.prisma as any).emrCredential.create({
      data: {
        provider,
        ownerId,
        label: dto.label,
        encryptedData,
        fingerprint,
        isValid: true,
        lastValidatedAt: new Date(),
        validationError: null,
      },
    });
  }

  async findAll(requestor: { id: string; role?: string }) {
    if (requestor.role !== 'ADMIN') {
      throw new ForbiddenException('Admins only');
    }
    try {
      return await (this.prisma as any).emrCredential.findMany({
        orderBy: { createdAt: 'desc' },
      });
    } catch (e: any) {
      if (this.isStorageMissingError(e)) {
        return [];
      }
      throw e;
    }
  }

  async findMine(ownerId: string) {
    try {
      return await (this.prisma as any).emrCredential.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e: any) {
      if (this.isStorageMissingError(e)) {
        return [];
      }
      throw e;
    }
  }

  async findOne(id: string, requestor: { id: string; role?: string }) {
    let cred: any;
    try {
      cred = await (this.prisma as any).emrCredential.findUnique({
        where: { id },
      });
    } catch (e: any) {
      if (this.isStorageMissingError(e)) {
        throw new NotFoundException('EMR credentials storage not initialized');
      }
      throw e;
    }
    if (!cred) throw new NotFoundException('Credential not found');
    if (cred.ownerId !== requestor.id && requestor.role !== 'ADMIN') {
      throw new ForbiddenException('Not allowed');
    }
    return cred;
  }

  async update(
    id: string,
    requestor: { id: string; role?: string },
    dto: UpdateEmrCredentialDto,
  ) {
    const existing = await (this.prisma as any).emrCredential.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Credential not found');
    if (existing.ownerId !== requestor.id && requestor.role !== 'ADMIN') {
      throw new ForbiddenException('Not allowed');
    }

    const updates: any = {};
    let provider = existing.provider;
    let credentials: Record<string, any> | null = null;

    if (dto.provider) provider = this.normalizeProvider(dto.provider);

    if (dto.credentials) {
      // Validate credentials again
      const validation = await this.validateCredentials(
        provider,
        dto.credentials,
      );
      if (!validation.ok) {
        throw new BadRequestException(
          `Credential validation failed: ${validation.message || 'Unknown error'}`,
        );
      }

      credentials = dto.credentials;
      updates.encryptedData = encryptJson(credentials);
      updates.isValid = true;
      updates.lastValidatedAt = new Date();
      updates.validationError = null;

      const fingerprint = this.makeFingerprint(provider, dto.credentials);
      if (fingerprint !== existing.fingerprint) {
        const dup = await (this.prisma as any).emrCredential.findUnique({
          where: { fingerprint },
        });
        if (dup) {
          throw new BadRequestException('These EMR credentials already exist.');
        }
        updates.fingerprint = fingerprint;
      }
    }

    if (dto.label !== undefined) updates.label = dto.label;
    if (dto.provider) updates.provider = provider;

    return (this.prisma as any).emrCredential.update({
      where: { id },
      data: updates,
    });
  }

  async remove(id: string, requestor: { id: string; role?: string }) {
    let existing: any;
    try {
      existing = await (this.prisma as any).emrCredential.findUnique({
        where: { id },
      });
    } catch (e: any) {
      if (this.isStorageMissingError(e)) {
        throw new NotFoundException('EMR credentials storage not initialized');
      }
      throw e;
    }
    if (!existing) throw new NotFoundException('Credential not found');
    if (existing.ownerId !== requestor.id && requestor.role !== 'ADMIN') {
      throw new ForbiddenException('Not allowed');
    }
    await (this.prisma as any).emrCredential.delete({ where: { id } });
    return { success: true };
  }

  private isStorageMissingError(e: any): boolean {
    return (
      e?.code === 'P2021' ||
      (typeof e?.message === 'string' &&
        /emr_credentials|does not exist|relation .* does not exist/i.test(
          e.message,
        ))
    );
  }
}
