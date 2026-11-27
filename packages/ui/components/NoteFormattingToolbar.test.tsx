// NoteFormattingToolbar (spec 074 SC-002): every button has a spoken name and its on/off state.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NoteFormattingToolbar } from './NoteFormattingToolbar';

afterEach(cleanup);

const labels = { toolbar: 'Formatting', bold: 'Bold', link: 'Link', bullet: 'Bulleted list', number: 'Numbered list', check: 'Checklist', hideKeyboard: 'Hide keyboard' };

describe('NoteFormattingToolbar', () => {
  it('names the toolbar and each button, with the active one pressed', () => {
    render(<NoteFormattingToolbar active={{ number: true }} onPress={vi.fn()} onHideKeyboard={vi.fn()} labels={labels} />);
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
    const pressed = ['Bold', 'Link', 'Bulleted list', 'Numbered list', 'Checklist'].map((name) => screen.getByRole('button', { name }).getAttribute('aria-pressed'));
    expect(pressed).toEqual(['false', 'false', 'false', 'true', 'false']);
    expect(screen.getByRole('button', { name: 'Hide keyboard' })).toBeTruthy();
  });

  it('says which format was tapped', () => {
    const onPress = vi.fn();
    render(<NoteFormattingToolbar active={{}} onPress={onPress} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onPress.mock.calls).toEqual([['check'], ['bold']]);
  });

  it('hides the keyboard on the iPhone', () => {
    const onHideKeyboard = vi.fn();
    render(<NoteFormattingToolbar active={{}} onPress={vi.fn()} onHideKeyboard={onHideKeyboard} labels={labels} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide keyboard' }));
    expect(onHideKeyboard).toHaveBeenCalledOnce();
  });

  it('has no Hide keyboard on the web', () => {
    render(<NoteFormattingToolbar active={{}} onPress={vi.fn()} labels={labels} />);
    expect(screen.queryByRole('button', { name: 'Hide keyboard' })).toBeNull();
  });
});
