import { describe, expect, it, vi } from 'vitest';
import { disconnectAssistant, groupAssistants } from './ai-connections';

const row = (client_id: string, assistant: string | null, granted_at: string, last_used_at: string | null = null, client_name: string | null = 'Claude') =>
  ({ client_id, assistant, client_name, granted_at, last_used_at });

describe('connected assistants (spec 025)', () => {
  it('groups an assistant’s connections and keeps its latest use', () => {
    const { known, others } = groupAssistants([
      row('c1', 'claude', '2026-10-20T10:00:00Z', '2026-10-25T09:00:00Z'),
      row('c2', 'claude', '2026-10-26T08:00:00Z'),
      row('c3', 'chatgpt', '2026-10-21T10:00:00Z', '2026-10-21T11:00:00Z'),
    ]);
    expect(known.claude).toEqual({ clientIds: ['c1', 'c2'], lastUsed: new Date('2026-10-26T08:00:00Z') });
    expect(known.chatgpt?.lastUsed).toEqual(new Date('2026-10-21T11:00:00Z'));
    expect(known.gemini).toBeUndefined();
    expect(others).toEqual([]);
  });

  it('keeps apps it can’t name apart, by the name they gave themselves', () => {
    const { known, others } = groupAssistants([row('c1', null, '2026-10-20T10:00:00Z', null, 'Claude Code'), row('c2', 'mcp', '2026-10-21T10:00:00Z', null, 'Claude Code')]);
    expect(known).toEqual({});
    expect(others).toEqual([{ name: 'Claude Code', clientIds: ['c1', 'c2'], lastUsed: new Date('2026-10-21T10:00:00Z') }]);
  });

  it('disconnect revokes every grant and reports a failure', async () => {
    const revokeGrant = vi.fn(async ({ clientId }: { clientId: string }) => ({ data: {}, error: clientId === 'c2' ? new Error('nope') : null }));
    const { error } = await disconnectAssistant({ revokeGrant } as never, ['c1', 'c2']);
    expect(revokeGrant.mock.calls.map(([a]) => a.clientId)).toEqual(['c1', 'c2']);
    expect(error).toBeInstanceOf(Error);
  });
});
