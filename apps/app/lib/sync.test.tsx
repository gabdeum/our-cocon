// Spec 004 US1: a change on the family's channel refetches what's on screen; the conflict notice.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SyncProvider, useRecipeChangedBy, type SyncClient } from './sync';
import { alex, family, flush, gabriel, mia } from '../test/fakes';

afterEach(cleanup);

const recipe = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const alexId = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';
const gabrielId = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const people = [
  { ...gabriel, user_id: gabrielId },
  { ...alex, user_id: alexId },
  mia,
];

function fakeRealtime() {
  let onChange: (message: { payload: unknown }) => void = () => undefined;
  let onStatus: (status: string) => void = () => undefined;
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: typeof onChange) => {
      onChange = handler;
      return channel;
    }),
    subscribe: vi.fn((callback: typeof onStatus) => {
      onStatus = callback;
      return channel;
    }),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(() => Promise.resolve('ok')),
    realtime: { setAuth: vi.fn(() => Promise.resolve()) },
  };
  return {
    client: client as unknown as SyncClient & typeof client,
    emit: (payload: unknown) => act(() => onChange({ payload })),
    status: (s: string) => act(() => onStatus(s)),
  };
}

function setup(children: ReactNode = null, familyId: string | null = family.id) {
  const realtime = fakeRealtime();
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SyncProvider client={realtime.client} familyId={familyId}>
        {children}
      </SyncProvider>
    </QueryClientProvider>,
  );
  return { ...realtime, invalidate, view };
}

describe('SyncProvider', () => {
  it("listens on the family's private channel once it has a token", async () => {
    const { client } = setup();
    await flush();
    expect(client.channel).toHaveBeenCalledWith(`family:${family.id}`, { config: { private: true } });
    expect(client.realtime.setAuth).toHaveBeenCalled();
  });

  it('does nothing without a family, and leaves the channel on unmount', async () => {
    const none = setup(null, null);
    expect(none.client.channel).not.toHaveBeenCalled();
    cleanup();
    const { client, view } = setup();
    await flush();
    view.unmount();
    expect(client.removeChannel).toHaveBeenCalled();
  });

  it("refetches the changed table's queries", async () => {
    const { emit, invalidate } = setup();
    await flush();
    emit({ table: 'grocery_items', op: 'update', id: recipe, by: alexId, source: 'app' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['grocery_items'] });
  });

  it("refetches the calendar's events when who they're for, an exception or a checklist changes", async () => {
    const { emit, invalidate } = setup();
    await flush();
    emit({ table: 'event_checklist_items', op: 'update', id: recipe, by: alexId, source: 'app' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['event_checklist_items'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['events'] });
    invalidate.mockClear();
    emit({ table: 'events', op: 'insert', id: recipe, by: alexId, source: 'app' });
    expect(invalidate.mock.calls).toEqual([[{ queryKey: ['events'] }]]);
  });

  it('ignores messages that are not changes', async () => {
    const { emit, invalidate } = setup();
    await flush();
    emit({ table: 'members', op: 'update', id: recipe });
    emit({ hello: 'world' });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('refetches everything after reconnecting, not on the first join', async () => {
    const { status, invalidate } = setup();
    await flush();
    status('SUBSCRIBED');
    expect(invalidate).not.toHaveBeenCalled();
    status('CHANNEL_ERROR');
    status('SUBSCRIBED');
    expect(invalidate).toHaveBeenCalledWith();
  });
});

describe('useRecipeChangedBy', () => {
  function Probe() {
    const { by, dismiss } = useRecipeChangedBy(recipe, gabrielId, people);
    return (
      <button type="button" onClick={dismiss}>
        {by ? by.display_name : 'nobody'}
      </button>
    );
  }

  it('names the member who changed the open recipe, but not me', async () => {
    const { emit } = setup(<Probe />);
    await flush();
    emit({ table: 'recipes', op: 'update', id: recipe, by: gabrielId });
    expect(screen.getByRole('button').textContent).toBe('nobody');
    emit({ table: 'recipes', op: 'update', id: '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a', by: alexId });
    expect(screen.getByRole('button').textContent).toBe('nobody');
    emit({ table: 'recipes', op: 'update', id: recipe, by: alexId });
    expect(screen.getByRole('button').textContent).toBe('Alex');
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button').textContent).toBe('nobody');
  });
});
