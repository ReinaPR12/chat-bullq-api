import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MediaResolverService } from '../../messaging/messages/media-resolver.service';
import { TranscriptionService } from '../../messaging/messages/transcription.service';

export interface PublicMediaResponse {
  url: string;
  mime?: string;
  filename?: string;
  caption?: string;
  durationSec?: number;
  expiresAt?: string;
}

/**
 * Public-API media facade. Reuses the internal MediaResolverService (lazy
 * provider resolution + caching) and TranscriptionService (Whisper), then
 * shapes the response to the contract the CRM consumes. Org ownership is
 * enforced inside the internal services (they throw NotFound when the message
 * belongs to another org), so cross-org access is denied by construction.
 */
@Injectable()
export class PublicMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaResolver: MediaResolverService,
    private readonly transcription: TranscriptionService,
  ) {}

  async resolveMedia(
    messageId: string,
    organizationId: string,
  ): Promise<PublicMediaResponse> {
    // 'ALL' here means "no per-channel restriction" — org scoping is enforced
    // by the resolver (NotFound on org mismatch). The API key already proved
    // org membership; per-channel ACLs don't apply to server-to-server keys.
    const resolved = await this.mediaResolver.resolve(
      messageId,
      organizationId,
      'ALL',
    );

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { content: true },
    });
    const content = (message?.content ?? {}) as Record<string, any>;

    const durationRaw = content.duration ?? content.durationSec ?? content.seconds;
    const durationSec =
      durationRaw != null && !Number.isNaN(Number(durationRaw))
        ? Number(durationRaw)
        : undefined;

    return {
      url: resolved.url,
      mime: resolved.mimeType ?? content.mimeType ?? content.mimetype,
      filename: content.fileName ?? content.filename ?? undefined,
      caption: content.caption || undefined,
      durationSec,
      expiresAt:
        typeof content.mediaUrlExpiresAt === 'string'
          ? content.mediaUrlExpiresAt
          : undefined,
    };
  }

  async transcribe(
    messageId: string,
    organizationId: string,
    force = false,
  ): Promise<{ text: string }> {
    const result = await this.transcription.transcribe(messageId, organizationId, {
      force,
      access: 'ALL',
    });
    return { text: result.text };
  }
}
