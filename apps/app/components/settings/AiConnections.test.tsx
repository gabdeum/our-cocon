// Spec 025: Settings › AI assistants (OC-Connect). US1: Connect shows the steps, the address with
// Copy and a check, then the row reads "Connected · used just now". US2: Manage shows the last use
// and permissions, and Disconnect asks first. FR-003: "What AI can do" changes a permission (L67).
// Edge: an assistant that can't connect yet reads "Not available yet".
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AssistantConnections } from '@cocon/data';
import { DEFAULT_AI_PERMISSIONS } from '@cocon/schemas';
import { fakeTracker, flush, last } from '../../test/fakes';
import { ASSISTANTS } from '../../lib/assistants';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));

const { AiConnections } = await import('./AiConnections');
type Props = Parameters<typeof AiConnections>[0];

afterEach(cleanup);

const now = new Date('2026-10-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const connections: AssistantConnections = {
  known: { claude: { clientIds: ['c1', 'c2'], lastUsed: hoursAgo(2) }, chatgpt: { clientIds: ['c3'], lastUsed: hoursAgo(1) } },
  others: [],
};
const address = 'https://mcp.ourcocon.com/mcp';

function setup(over: Partial<Props> = {}) {
  const tracker = fakeTracker();
  const props = {
    onCheck: vi.fn(async () => connections),
    onDisconnect: vi.fn(async () => undefined),
    onSetPermission: vi.fn(async () => undefined),
    onCopy: vi.fn(async () => undefined),
  };
  render(
    <AiConnections
      assistants={connections}
      permissions={{ ...DEFAULT_AI_PERMISSIONS, recipes_delete: false }}
      address={address}
      tracker={tracker}
      onRetry={vi.fn()}
      onBack={vi.fn()}
      now={now}
      {...props}
      {...over}
    />,
  );
  return { tracker, ...props, ...over };
}

describe('AI assistants', () => {
  it('lists Claude, ChatGPT and Gemini with their status, then permissions and phrases to try', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'AI assistants' })).toBeTruthy();
    expect(screen.getByText('Let your AI save recipes and fill the grocery list for you. Each person connects their own.')).toBeTruthy();
    expect(screen.getByText('Connected · used 2 h ago')).toBeTruthy();
    expect(screen.getByText('Connected · used 1 h ago')).toBeTruthy();
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage Claude' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect Gemini' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What AI can do' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create & edit recipes/ }).textContent).toContain('Allowed');
    expect(screen.getByRole('button', { name: /Delete recipes/ }).textContent).toContain('Not allowed');
    expect(screen.getByText('Try saying')).toBeTruthy();
    expect(screen.getByText('“Save my mum\'s ratatouille to Our Cocon. It serves 4.”')).toBeTruthy();
    expect(screen.getByText('“Add what I need for the quiche to our groceries.”')).toBeTruthy();
  });

  it('US1: Connect guides through the steps, copies the address, and checks the connection', async () => {
    const onCheck = vi.fn(async () => ({ ...connections, known: { ...connections.known, gemini: { clientIds: ['c9'], lastUsed: now } } }));
    const { tracker, onCopy } = setup({ assistants: { known: {}, others: [] }, onCheck });
    fireEvent.click(screen.getByRole('button', { name: 'Connect Gemini' }));
    expect(tracker.track).toHaveBeenCalledWith('ai_connect_started', { assistant: 'gemini' });
    expect(screen.getByText('Connect Gemini')).toBeTruthy();
    expect(screen.getByText(/open Settings › Connected Apps/)).toBeTruthy();
    expect(screen.getByText('For now, Gemini only offers this in the US, with a personal Google account.')).toBeTruthy();
    expect(screen.getByLabelText('Our Cocon address').textContent).toBe(address);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await flush();
    expect(onCopy).toHaveBeenCalledWith(address);
    expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: "I've done this — check connection" }));
    await flush();
    expect(screen.getByText('Connected!')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('ai_connected', { assistant: 'gemini' });
  });

  it('US1: once connected, the row reads "Connected · used just now"', () => {
    setup({ assistants: { known: { claude: { clientIds: ['c1'], lastUsed: now } }, others: [] } });
    expect(screen.getByText('Connected · used just now')).toBeTruthy();
  });

  it('says which step to check when the assistant isn’t connected yet', async () => {
    const { tracker } = setup({ assistants: { known: {}, others: [] }, onCheck: vi.fn(async () => ({ known: {}, others: [] })) });
    fireEvent.click(screen.getByRole('button', { name: 'Connect Claude' }));
    expect(screen.getByText(/Customize › Connectors/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "I've done this — check connection" }));
    await flush();
    expect(screen.getByText('Not connected yet. Check step 2 and try again.')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('ai_connect_failed', { assistant: 'claude', step: 2 });
  });

  it('US2: Manage shows the last use and permissions; Disconnect asks, then revokes every grant', async () => {
    const { tracker, onDisconnect } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Manage Claude' }));
    expect(screen.getByText('Last used 2 h ago')).toBeTruthy();
    expect(screen.getAllByText('Change the grocery list')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.getByRole('alertdialog', { name: 'Disconnect Claude?' }).textContent).toContain("It won't be able to see or change your recipes and groceries.");
    expect(onDisconnect).not.toHaveBeenCalled();
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Disconnect' })));
    await flush();
    expect(onDisconnect).toHaveBeenCalledWith(['c1', 'c2']);
    expect(tracker.track).toHaveBeenCalledWith('ai_disconnected', { assistant: 'claude' });
  });

  it('says what to do when Disconnect fails', async () => {
    const { tracker } = setup({ onDisconnect: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Manage ChatGPT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Disconnect' })));
    await flush();
    expect(screen.getByText("Couldn't disconnect. Check your connection and try again.")).toBeTruthy();
    expect(tracker.track).not.toHaveBeenCalledWith('ai_disconnected', expect.anything());
  });

  it('an app it can’t name is listed under its own name, so it can be disconnected too', async () => {
    const { tracker, onDisconnect } = setup({ assistants: { known: {}, others: [{ name: 'Claude Code', clientIds: ['c7'], lastUsed: hoursAgo(3) }] } });
    fireEvent.click(screen.getByRole('button', { name: 'Manage “Claude Code”' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Disconnect' })));
    await flush();
    expect(onDisconnect).toHaveBeenCalledWith(['c7']);
    expect(tracker.track).toHaveBeenCalledWith('ai_disconnected', { assistant: 'other' });
  });

  it('FR-003: a permission changes from its row (Allowed · Not allowed)', async () => {
    const { tracker, onSetPermission } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Delete recipes/ }));
    expect(screen.getByText('For the AI assistants you connect. Everyone in your family chooses for their own.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Allowed' }));
    await flush();
    expect(onSetPermission).toHaveBeenCalledWith('recipes_delete', true);
    expect(tracker.track).toHaveBeenCalledWith('ai_permission_changed', { permission: 'recipes_delete', allowed: true });
  });

  it('an assistant that can’t connect yet reads "Not available yet", with why', () => {
    setup({ assistants: { known: {}, others: [] }, list: ASSISTANTS.map((a) => (a.key === 'gemini' ? { ...a, available: false } : a)) });
    expect(screen.getByText('Not available yet')).toBeTruthy();
    expect(screen.getByText("Gemini can't connect to apps like Our Cocon yet. We'll add it here as soon as it can.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect Gemini' })).toBeNull();
  });

  it('offline, nothing can change', () => {
    setup({ readOnly: true, assistants: { known: {}, others: [] } });
    expect(screen.getByRole('button', { name: 'Connect Claude' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: /Delete recipes/ }).getAttribute('aria-disabled')).toBe('true');
  });

  it('a failed Disconnect isn’t shown again on the next Manage', async () => {
    setup({ onDisconnect: vi.fn(async () => Promise.reject(new Error('offline'))) });
    fireEvent.click(screen.getByRole('button', { name: 'Manage Claude' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Disconnect' })));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Manage ChatGPT' }));
    expect(screen.queryByText("Couldn't disconnect. Check your connection and try again.")).toBeNull();
  });
});
