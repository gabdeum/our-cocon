// Spec 051 (design/ui/OC-CookDone.md, Warnings and errors): the Done sheet's Undo and "Mark as
// done", and the "already cooking" sheet's Resume and Start over.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CookDoneSheet } from './CookDoneSheet';
import { AlreadyCookingSheet } from './AlreadyCookingSheet';
import { expectAccessible } from '../../test/axe';

afterEach(cleanup);

const done = { recipeName: 'Leek & bacon quiche', member: 'Gabriel', times: 5, step: 6 };
const tap = (name: string) => act(async () => void fireEvent.click(screen.getByRole('button', { name })));

describe('the Done sheet (FR-005)', () => {
  it('US2: says it is logged, Undo puts it back in progress, "Mark as done" logs it again', async () => {
    const onUndo = vi.fn(async () => true);
    const onMarkDone = vi.fn(async () => true);
    const onClose = vi.fn();
    render(<CookDoneSheet done={done} onUndo={onUndo} onMarkDone={onMarkDone} onClose={onClose} />);
    expect(screen.getByText('Leek & bacon quiche is done!')).toBeTruthy();
    expect(screen.getByText('Logged as cooked today by Gabriel. That’s 5 times now.')).toBeTruthy();
    await expectAccessible();
    await tap('Undo');
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByText('Still in progress')).toBeTruthy();
    expect(screen.getByText('It’s back at the top of Recipes, at step 6.')).toBeTruthy();
    await tap('Mark as done');
    expect(onMarkDone).toHaveBeenCalledOnce();
    expect(screen.getByText('Leek & bacon quiche is done!')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the recipe' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('the first time says so; a failed Undo says what to do and stays', async () => {
    render(<CookDoneSheet done={{ ...done, times: 1 }} onUndo={async () => false} onMarkDone={async () => true} onClose={vi.fn()} />);
    expect(screen.getByText('Logged as cooked today by Gabriel. That’s the first time.')).toBeTruthy();
    await tap('Undo');
    expect(screen.getByText("Couldn't save. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByText('Leek & bacon quiche is done!')).toBeTruthy();
  });
});

describe('already cooking (Warnings and errors)', () => {
  it('names who is cooking it and at which step; Resume or Start over', () => {
    const onResume = vi.fn();
    const onStartOver = vi.fn();
    render(<AlreadyCookingSheet cook={{ member: 'Eva', step: 3, mine: false }} onResume={onResume} onStartOver={onStartOver} onClose={vi.fn()} />);
    expect(screen.getByText('Eva is cooking this (step 3)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "Resume Eva's" }));
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(onResume).toHaveBeenCalled();
    expect(onStartOver).toHaveBeenCalled();
    cleanup();
    render(<AlreadyCookingSheet cook={{ member: 'Gabriel', step: 2, mine: true }} onResume={vi.fn()} onStartOver={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("You're cooking this (step 2)")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  });
});
