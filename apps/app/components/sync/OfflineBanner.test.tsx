// Spec 004 edge case: offline, the banner shows and is tracked once per offline spell.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { OfflineBanner } from './OfflineBanner';
import { RecipeChangedBanner } from './RecipeChangedBanner';
import { alex, fakeTracker } from '../../test/fakes';

beforeEach(() => onlineManager.setOnline(true));
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('OfflineBanner', () => {
  it('shows nothing while online', () => {
    const tracker = fakeTracker();
    render(<OfflineBanner screen="groceries" tracker={tracker} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('shows the offline copy and tracks it once per spell', () => {
    const tracker = fakeTracker();
    render(<OfflineBanner screen="groceries" tracker={tracker} />);
    act(() => onlineManager.setOnline(false));
    expect(screen.getByRole('status').textContent).toBe("You're offline. You can read, but changes need a connection.");
    expect(tracker.track).toHaveBeenCalledExactlyOnceWith('offline_banner_shown', { screen: 'groceries' });

    act(() => onlineManager.setOnline(true));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => onlineManager.setOnline(false));
    expect(tracker.track).toHaveBeenCalledTimes(2);
  });
});

describe('OfflineBanner remounts', () => {
  it('counts a screen once per spell even when it remounts', () => {
    const tracker = fakeTracker();
    act(() => onlineManager.setOnline(false));
    const first = render(<OfflineBanner screen="recipes" tracker={tracker} />);
    first.unmount();
    render(<OfflineBanner screen="recipes" tracker={tracker} />);
    render(<OfflineBanner screen="settings" tracker={tracker} />);
    expect(tracker.track).toHaveBeenCalledTimes(2);
    expect(tracker.track).toHaveBeenCalledWith('offline_banner_shown', { screen: 'settings' });
  });
});

describe('RecipeChangedBanner', () => {
  it('names who changed the recipe, with Reload', () => {
    let reloaded = false;
    render(<RecipeChangedBanner by={alex} onReload={() => (reloaded = true)} />);
    expect(screen.getByRole('status').textContent).toContain('Alex just changed this recipe');
    act(() => screen.getByRole('button', { name: 'Reload' }).click());
    expect(reloaded).toBe(true);
  });

  it('is hidden when nobody else changed it', () => {
    render(<RecipeChangedBanner by={null} onReload={() => undefined} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
