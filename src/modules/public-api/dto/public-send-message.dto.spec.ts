import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PublicSendMessageDto } from './public-send-message.dto';

/**
 * Pins the mutual-exclusion + at-least-one contract:
 *   - toPhone only          → valid
 *   - conversationId only   → valid
 *   - both absent           → validation error
 *   - both present (handled by controller, not DTO) → DTO itself passes
 */
describe('PublicSendMessageDto', () => {
  function make(overrides: Partial<PublicSendMessageDto>) {
    return plainToInstance(PublicSendMessageDto, {
      channelId: 'ch-1',
      type: 'TEXT',
      content: { text: 'hello' },
      ...overrides,
    });
  }

  it('accepts toPhone without conversationId', async () => {
    const dto = make({ toPhone: '+5511999998888' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts conversationId without toPhone', async () => {
    const dto = make({ conversationId: 'conv-123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when both toPhone and conversationId are absent', async () => {
    const dto = make({});
    const errors = await validate(dto);
    const fields = errors.map((e) => e.property);
    // At least one of the two fields must report a constraint
    expect(fields.some((f) => f === 'toPhone' || f === 'conversationId')).toBe(true);
  });

  it('passes when both toPhone and conversationId are present (controller handles the conflict)', async () => {
    const dto = make({ toPhone: '+5511999998888', conversationId: 'conv-123' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
