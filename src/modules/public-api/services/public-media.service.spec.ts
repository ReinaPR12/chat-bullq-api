import { NotFoundException } from '@nestjs/common';
import { PublicMediaService } from './public-media.service';

/**
 * Pins the Public Media API contract: it reuses the internal resolver +
 * transcription services (org ownership enforced there) and reshapes the
 * payload to { url, mime, filename?, caption?, durationSec?, expiresAt? } and
 * { text }. All IO (Prisma, providers, Whisper) is mocked.
 */
describe('PublicMediaService', () => {
  let prisma: any;
  let mediaResolver: any;
  let transcription: any;
  let service: PublicMediaService;

  beforeEach(() => {
    prisma = { message: { findUnique: jest.fn() } };
    mediaResolver = { resolve: jest.fn() };
    transcription = { transcribe: jest.fn() };
    service = new PublicMediaService(prisma, mediaResolver, transcription);
  });

  it('resolveMedia: scopes to org and shapes the contract', async () => {
    mediaResolver.resolve.mockResolvedValue({
      url: 'https://cdn/x.ogg',
      mimeType: 'audio/ogg',
    });
    prisma.message.findUnique.mockResolvedValue({
      content: {
        fileName: 'nota.ogg',
        caption: 'ouça isso',
        duration: 12,
        mediaUrlExpiresAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const res = await service.resolveMedia('msg-1', 'org-A');

    expect(mediaResolver.resolve).toHaveBeenCalledWith('msg-1', 'org-A', 'ALL');
    expect(res).toEqual({
      url: 'https://cdn/x.ogg',
      mime: 'audio/ogg',
      filename: 'nota.ogg',
      caption: 'ouça isso',
      durationSec: 12,
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('resolveMedia: propagates cross-org NotFound from the resolver', async () => {
    mediaResolver.resolve.mockRejectedValue(new NotFoundException());
    await expect(service.resolveMedia('msg-x', 'org-A')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('transcribe: returns { text } and forwards org + force flag', async () => {
    transcription.transcribe.mockResolvedValue({
      text: 'olá mundo',
      provider: 'openai-whisper',
    });
    const res = await service.transcribe('msg-1', 'org-A', true);
    expect(transcription.transcribe).toHaveBeenCalledWith('msg-1', 'org-A', {
      force: true,
      access: 'ALL',
    });
    expect(res).toEqual({ text: 'olá mundo' });
  });
});
