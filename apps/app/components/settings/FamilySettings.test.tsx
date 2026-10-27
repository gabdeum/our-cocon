// Spec 003 User Stories 2 and 3, FR-006, and spec 033: the Family and Account sections of Settings.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FamilySettings, type FamilySettingsProps } from './FamilySettings';
import { alex, fakeApi, fakeTracker, family, flush, gabriel, james, mia, last } from '../../test/fakes';

vi.mock('expo-linking', () => ({ createURL: (p: string) => p }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
afterEach(cleanup);

function setup(props: Partial<FamilySettingsProps> = {}, api = fakeApi()) {
  const tracker = fakeTracker();
  const onChanged = vi.fn();
  const onSignOut = vi.fn();
  const shareDeps = { share: vi.fn().mockResolvedValue(undefined), copy: vi.fn() };
  render(
    <FamilySettings me={gabriel} family={family} members={[gabriel, alex, mia]} api={api} tracker={tracker} onChanged={onChanged} onSignOut={onSignOut} shareDeps={shareDeps} {...props} />,
  );
  return { api, tracker, onChanged, onSignOut, shareDeps };
}

it('lists members in join order with their role', () => {
  setup();
  expect(screen.getByRole('heading', { name: 'Family' })).toBeTruthy();
  expect(screen.getByText('Owner')).toBeTruthy();
  expect(screen.getAllByText('Can edit')).toHaveLength(2);
  // Gabriel also shows in Account › Your name, after the list.
  const [first, , third] = ['Gabriel', 'Alex', 'Mia'].map((n) => screen.getAllByText(n)[0]);
  expect(first && third && first.compareDocumentPosition(third) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getAllByText('G').length).toBeGreaterThan(0);
});

describe('Invite someone (US2)', () => {
  it('shares a new link and tracks it', async () => {
    const { api, tracker, shareDeps } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await flush();
    expect(api.createInvite).toHaveBeenCalled();
    expect(shareDeps.share).toHaveBeenCalledWith({ message: expect.stringContaining(`Join The Demanges on Our Cocon: `) });
    expect(tracker.track).toHaveBeenCalledWith('invite_sent', {});
  });

  it('is there for every member, not just the owner', () => {
    setup({ me: alex });
    expect(screen.getByRole('button', { name: 'Invite someone' })).toBeTruthy();
  });

  it('copies the link where sharing is not available', async () => {
    const copy = vi.fn();
    setup({ shareDeps: { share: vi.fn().mockRejectedValue(new Error('unsupported')), copy } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await flush();
    expect(copy).toHaveBeenCalled();
    expect(screen.getByText('Invite link copied. Send it to them by message.')).toBeTruthy();
  });
});

describe('managing members (US3)', () => {
  it('lets the owner remove a member after confirming', async () => {
    const { api, tracker, onChanged } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Alex, Has the app, Can edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from family' }));
    expect(screen.getByText('Remove Alex from the family?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await flush();
    expect(api.removeMember).toHaveBeenCalledWith('u-alex');
    expect(tracker.track).toHaveBeenCalledWith('member_removed', {});
    expect(onChanged).toHaveBeenCalled();
  });

  it('lets the owner hand over ownership', async () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mia, Has the app, Can edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make owner' }));
    expect(screen.getByText('Make Mia the owner?')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Make owner' });
    fireEvent.click(last(buttons));
    await flush();
    expect(api.makeOwner).toHaveBeenCalledWith('u-mia');
  });

  it("doesn't let the owner open their own row (hand over first)", () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Gabriel, Has the app, Owner' })).toBeNull();
  });

  it('shows members without letting other members manage them', () => {
    setup({ me: alex });
    expect(screen.queryByRole('button', { name: 'Mia, Has the app, Can edit' })).toBeNull();
    expect(screen.getByText('Mia')).toBeTruthy();
  });
});

describe('Account (FR-006)', () => {
  it('lets the owner delete the family after confirming', async () => {
    const { api, tracker, onChanged } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete family' }));
    expect(screen.getByText('Delete “The Demanges”?')).toBeTruthy();
    expect(screen.getByText("This removes the family and everything in it for all 3 members. This can't be undone.")).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Delete family' });
    fireEvent.click(last(buttons));
    await flush();
    expect(api.deleteFamily).toHaveBeenCalled();
    expect(tracker.track).toHaveBeenCalledWith('family_deleted', { member_count: 3 });
    expect(onChanged).toHaveBeenCalled();
  });

  it('lets a member delete their account, then signs them out', async () => {
    const { api, onSignOut } = setup({ me: alex });
    expect(screen.queryByRole('button', { name: 'Delete family' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Delete your account?')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Delete my account' });
    fireEvent.click(last(buttons));
    await flush();
    expect(api.deleteMyAccount).toHaveBeenCalled();
    expect(onSignOut).toHaveBeenCalled();
  });

  it('keeps everything when the dialog is cancelled', () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete family' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(api.deleteFamily).not.toHaveBeenCalled();
  });

  it('signs out', () => {
    const { onSignOut } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('changes my name', async () => {
    const { api, onChanged } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Your name/ }));
    fireEvent.change(last(screen.getAllByLabelText('Your name')), { target: { value: 'Gabe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(api.setDisplayName).toHaveBeenCalledWith('Gabe');
    expect(onChanged).toHaveBeenCalled();
  });
});

describe('when something fails', () => {
  it('says an invite could not be created, or that there were too many', async () => {
    setup({}, fakeApi({ createInvite: vi.fn().mockResolvedValue({ ok: false, error: 'failed' }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await flush();
    expect(screen.getByText("Couldn't create an invite. Try again.")).toBeTruthy();
    cleanup();
    setup({}, fakeApi({ createInvite: vi.fn().mockResolvedValue({ ok: false, error: 'rate_limited' }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone' }));
    await flush();
    expect(screen.getByText('Too many tries. Wait a minute, then try again.')).toBeTruthy();
  });

  it('says a removal could not be saved, and reloads nothing', async () => {
    const { onChanged, tracker } = setup({}, fakeApi({ removeMember: vi.fn().mockResolvedValue({ ok: false, error: 'failed' }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Alex, Has the app, Can edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from family' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await flush();
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('asks for a name before saving it', async () => {
    const { api } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Your name/ }));
    fireEvent.change(last(screen.getAllByLabelText('Your name')), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(screen.getByText('Add your name so your family knows who you are.')).toBeTruthy();
    expect(api.setDisplayName).not.toHaveBeenCalled();
  });
});

describe('Offline (spec 004)', () => {
  it('stays readable but disables every change; sign out still works', () => {
    const { api, onSignOut } = setup({ readOnly: true });
    expect(screen.getByText('Alex')).toBeTruthy();
    const invite = screen.getByRole('button', { name: 'Invite someone' });
    expect(invite.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(invite);
    expect(api.createInvite).not.toHaveBeenCalled();
    // Member rows and "Your name" can't be opened.
    expect(screen.queryByRole('button', { name: 'Alex, Has the app, Can edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Your name/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete family' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe('members without the app (spec 033)', () => {
  const everyone = [gabriel, alex, mia, james];

  it('reads "James · Added by Gabriel · No account" (US1.1)', () => {
    setup({ members: everyone });
    expect(screen.getByRole('button', { name: 'James, Added by Gabriel, No account' })).toBeTruthy();
    expect(screen.getAllByText('Has the app')).toHaveLength(3);
    expect(screen.getByText("Add kids or anyone who won't use the app. They get a color in the calendar, and you choose who takes them to things.")).toBeTruthy();
  });

  it('adds someone with the first free color, and tracks it', async () => {
    const { api, tracker, onChanged } = setup({ members: everyone });
    fireEvent.click(screen.getByRole('button', { name: 'Add without app' }));
    expect(screen.getByText('Add a family member')).toBeTruthy();
    // Honey, rose, sky and mint are taken: lilac is picked, free ones come first.
    expect(screen.getByRole('radio', { name: 'Lilac, picked' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rosie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await flush();
    expect(api.addManagedMember).toHaveBeenCalledWith('Rosie', 'lilac');
    expect(tracker.track).toHaveBeenCalledWith('member_added_without_app', {});
    expect(onChanged).toHaveBeenCalled();
  });

  it('asks for a name', async () => {
    const { api } = setup({ members: everyone });
    fireEvent.click(screen.getByRole('button', { name: 'Add without app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await flush();
    expect(screen.getByText('Give them a name.')).toBeTruthy();
    expect(api.addManagedMember).not.toHaveBeenCalled();
  });

  it('lets any member manage James, and invite him as himself', async () => {
    const { api, shareDeps } = setup({ me: alex, members: everyone });
    fireEvent.click(screen.getByRole('button', { name: 'James, Added by Gabriel, No account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Invite James' }));
    await flush();
    expect(api.createInvite).toHaveBeenCalledWith('m-james');
    expect(shareDeps.share).toHaveBeenCalledWith({ message: expect.stringContaining('Join The Demanges on Our Cocon as James: ') });
  });

  it('removes James after confirming', async () => {
    const { api } = setup({ me: alex, members: everyone });
    fireEvent.click(screen.getByRole('button', { name: 'James, Added by Gabriel, No account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove James?')).toBeTruthy();
    fireEvent.click(last(screen.getAllByRole('button', { name: 'Remove' })));
    await flush();
    expect(api.removeManagedMember).toHaveBeenCalledWith('m-james');
  });
});

describe('My color (spec 033 US3)', () => {
  it('picks a free color; taken ones show who has them and can’t be picked', async () => {
    const { api, tracker, onChanged } = setup({ me: alex, members: [gabriel, alex, mia, james] });
    const group = screen.getByRole('radiogroup', { name: 'My color' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Rose, your color' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Honey, taken' }));
    expect(api.setMemberColor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Lilac, free' }));
    await flush();
    expect(api.setMemberColor).toHaveBeenCalledWith(alex.id, 'lilac');
    expect(tracker.track).toHaveBeenCalledWith('member_color_changed', { color: 'lilac' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('says when someone else just took it', async () => {
    const api = fakeApi({ setMemberColor: vi.fn().mockResolvedValue({ ok: false, error: 'color_taken' }) });
    setup({}, api);
    fireEvent.click(screen.getByRole('radio', { name: 'Lilac, free' }));
    await flush();
    expect(screen.getByText('Someone else just took that color. Pick another.')).toBeTruthy();
  });
});
