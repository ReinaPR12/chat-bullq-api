import { Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ChannelsService } from '../../channel-hub/channels/channels.service';
import type { ChannelAccess } from '../../iam/channel-access/channel-access.service';
import { PublicCreateChannelDto } from '../dto/public-create-channel.dto';
import { PublicUpdateChannelDto } from '../dto/public-update-channel.dto';

export interface PublicChannelCaller {
  organizationId: string;
  userOrganizationId: string;
  role: OrgRole;
  access: ChannelAccess;
}

/**
 * Thin Public-API wrapper over the internal ChannelsService. Every method is
 * scoped to the organization inferred from the API key — ChannelsService
 * already enforces org ownership on each operation (NotFound/Forbidden when
 * the channel belongs to another org), so this layer just adapts the
 * server-to-server ergonomics:
 *   - defaults `config` to {} (Prisma's Channel.config is non-nullable),
 *   - resolves the channel name so DELETE doesn't require a confirmName,
 *   - reuses ChannelsService for create/update/test/sync untouched.
 */
@Injectable()
export class PublicChannelsService {
  constructor(private readonly channels: ChannelsService) {}

  create(dto: PublicCreateChannelDto, caller: PublicChannelCaller) {
    return this.channels.create(
      caller.organizationId,
      {
        type: dto.type,
        name: dto.name,
        config: dto.config ?? {},
        ...(dto.visibility ? { visibility: dto.visibility } : {}),
      } as any,
      { userOrganizationId: caller.userOrganizationId, role: caller.role },
    );
  }

  findAll(caller: PublicChannelCaller) {
    return this.channels.findAll(caller.organizationId, caller.access);
  }

  findOne(id: string, caller: PublicChannelCaller) {
    return this.channels.findOne(id, caller.organizationId, caller.access);
  }

  update(id: string, dto: PublicUpdateChannelDto, caller: PublicChannelCaller) {
    return this.channels.update(
      id,
      caller.organizationId,
      dto as any,
      caller.userOrganizationId,
    );
  }

  async remove(id: string, caller: PublicChannelCaller) {
    // findOne enforces org ownership + access; we then reuse the same
    // soft-delete path the internal API uses, supplying the exact name so the
    // confirmation guard passes (the CRM confirmed intent via the API call).
    const channel = await this.channels.findOne(
      id,
      caller.organizationId,
      caller.access,
    );
    await this.channels.remove(id, caller.organizationId, channel.name);
    return { ok: true, id };
  }

  async testConnection(id: string, caller: PublicChannelCaller) {
    await this.channels.findOne(id, caller.organizationId, caller.access);
    const result = await this.channels.testConnection(id, caller.organizationId);
    return {
      ok: result.success === true,
      status: result.status ?? (result.success ? 'connected' : 'error'),
      detail: result.success ? result.data : result.error,
    };
  }

  async syncChannel(id: string, caller: PublicChannelCaller) {
    await this.channels.findOne(id, caller.organizationId, caller.access);
    const result = await this.channels.syncChannel(id, caller.organizationId);
    return {
      jobId: (result as any).jobId ?? null,
      status: (result as any).status ?? (result.success ? 'STARTED' : 'FAILED'),
      ...(result.success ? {} : { error: (result as any).error }),
    };
  }

  async getSyncStatus(id: string, caller: PublicChannelCaller) {
    await this.channels.findOne(id, caller.organizationId, caller.access);
    const { job } = await this.channels.getSyncStatus(id, caller.organizationId);
    return {
      status: job?.status ?? 'NONE',
      progress: this.computeProgress(job),
      job: job ?? null,
    };
  }

  async cancelSync(id: string, caller: PublicChannelCaller) {
    await this.channels.findOne(id, caller.organizationId, caller.access);
    const { job } = await this.channels.cancelSync(id, caller.organizationId);
    return { ok: true, status: job?.status ?? 'NONE', job: job ?? null };
  }

  private computeProgress(job: any): number | null {
    if (!job) return null;
    if (job.status === 'COMPLETED') return 100;
    const done = Number(job.conversationsImported ?? 0);
    const total = Number(job.conversationsTotal ?? 0);
    if (!total || Number.isNaN(total) || Number.isNaN(done)) return null;
    return Math.min(100, Math.round((done / total) * 100));
  }
}
