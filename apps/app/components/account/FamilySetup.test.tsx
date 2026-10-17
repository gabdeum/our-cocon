// Spec 003 User Story 1: a new account names its family and lands on Home.
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FamilySetup } from './FamilySetup';
import { fakeApi, fakeTracker, flush } from '../../test/fakes';

afterEach(cleanup);

it('creates the family with me as owner, tracks it and goes on', async () => {
  const api = fakeApi();
  const tracker = fakeTracker();
  const onCreated = vi.fn();
  render(<FamilySetup api={api} tracker={tracker} suggestedName="Gabriel" onCreated={onCreated} />);
  expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Gabriel');
  fireEvent.change(screen.getByLabelText('Family name'), { target: { value: '  The Demanges ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create family' }));
  await flush();
  expect(api.createFamily).toHaveBeenCalledWith('The Demanges', 'Gabriel');
  expect(tracker.track).toHaveBeenCalledWith('family_created', {});
  expect(onCreated).toHaveBeenCalled();
});

it('asks for both names before creating', async () => {
  const api = fakeApi();
  render(<FamilySetup api={api} tracker={fakeTracker()} suggestedName="" onCreated={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create family' }));
  await flush();
  expect(screen.getByText('Add your name so your family knows who you are.')).toBeTruthy();
  expect(screen.getByText('Give your family a name.')).toBeTruthy();
  expect(api.createFamily).not.toHaveBeenCalled();
});

it('says so when saving fails', async () => {
  const api = fakeApi({ createFamily: vi.fn().mockResolvedValue({ ok: false, error: 'failed' }) });
  const onCreated = vi.fn();
  render(<FamilySetup api={api} tracker={fakeTracker()} suggestedName="Gabriel" onCreated={onCreated} />);
  fireEvent.change(screen.getByLabelText('Family name'), { target: { value: 'The Demanges' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create family' }));
  await flush();
  expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
  expect(onCreated).not.toHaveBeenCalled();
});
