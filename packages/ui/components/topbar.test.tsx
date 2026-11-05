// TopBar, its layouts and ActionMenu (spec 050). Visuals are checked in /dev/gallery; these check
// behaviour and what screen readers get.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { theme } from '../theme';
import { ActionMenu } from './ActionMenu';
import { IconButton } from './IconButton';
import { PhotoScreen, PushedScreen, TabScreen } from './Layout';
import { Text } from './Text';
import { TopBar, TopBarHeading } from './TopBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const back = { label: 'Back to Menu', onPress: () => {} };

/** The page's ScrollView: the element after the bar's wrapper. */
const scroller = () => screen.getByTestId('top-bar').parentElement?.nextElementSibling as HTMLElement;
/** The nearest scrolling element above `el`. */
const scrollerOf = (el: HTMLElement): HTMLElement => {
  let node = el.parentElement;
  while (node && getComputedStyle(node).overflowY !== 'auto' && getComputedStyle(node).overflowY !== 'scroll') node = node.parentElement;
  return node ?? el;
};
const scrollTo = (el: HTMLElement, y: number) => {
  el.scrollTop = y;
  fireEvent.scroll(el, { target: { scrollTop: y } });
};

describe('TopBar', () => {
  it('names its back button and makes an always-shown title the page heading', () => {
    const onBack = vi.fn();
    render(<TopBar back={{ label: 'Back to Menu', onPress: onBack }} title="Groceries" />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Menu' }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1, name: 'Groceries' })).toBeTruthy();
  });

  it('hides an on-scroll title from screen readers: the content heading is the h1', () => {
    render(<TopBar back={back} title="Baby music class" titleMode="onScroll" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('draws the hairline and shadow only once content is under it', () => {
    const { rerender } = render(<TopBar back={back} title="Family" />);
    const bar = screen.getByTestId('top-bar');
    expect(bar.style.boxShadow).toBe('');
    rerender(<TopBar back={back} title="Family" scrolled />);
    expect(bar.style.boxShadow).toBe(theme.shadow.bar);
  });

  it('holds its actions on the right, and cooking mode gets ✕', () => {
    render(
      <TopBar
        back={{ label: 'Exit cooking mode', onPress: () => {}, icon: 'close' }}
        actions={[<IconButton key="s" variant="round" icon="share" label="Share recipe" />, <IconButton key="t" variant="round" icon="settings" label="Recipe settings" />]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Exit cooking mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share recipe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recipe settings' })).toBeTruthy();
  });
});

describe('IconButton round', () => {
  it('floats with shadow-button', () => {
    render(<IconButton variant="round" icon="back" label="Back to Menu" />);
    expect(screen.getByRole('button', { name: 'Back to Menu' }).style.boxShadow).toBe(theme.shadow.button);
  });
});

describe('PushedScreen with a top bar', () => {
  // SC-002: the bar sits outside the scrolling content, so it is still there at the bottom of the page.
  it('keeps the bar pinned outside the scroll and marks it once the page scrolls', () => {
    render(
      <PushedScreen topBar={{ back, title: 'Family' }}>
        <Text>Content</Text>
      </PushedScreen>,
    );
    const bar = screen.getByTestId('top-bar');
    const page = scroller();
    expect(page.contains(bar)).toBe(false);
    expect(page.textContent).toContain('Content');
    scrollTo(page, 2000);
    expect(bar.style.boxShadow).toBe(theme.shadow.bar);
    expect(screen.getByRole('button', { name: 'Back to Menu' })).toBeTruthy();
  });

  it('fades the name in once the heading is under the bar', async () => {
    render(
      <PushedScreen topBar={{ back, title: 'Baby music class', titleMode: 'onScroll' }}>
        <TopBarHeading>
          <Text role="heading" aria-level={1}>
            Baby music class
          </Text>
        </TopBarHeading>
      </PushedScreen>,
    );
    const bar = screen.getByTestId('top-bar');
    const title = () => screen.getAllByText('Baby music class').find((el) => bar.contains(el)) as HTMLElement;
    const heading = screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement;
    let headingTop = 200;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this === heading) return { x: 0, y: headingTop, top: headingTop, left: 0, width: 350, height: 40, right: 350, bottom: headingTop + 40, toJSON: () => ({}) };
      if (this === bar.parentElement) return { x: 0, y: 0, top: 0, left: 0, width: 390, height: 108, right: 390, bottom: 108, toJSON: () => ({}) };
      return { x: 0, y: 0, top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, toJSON: () => ({}) };
    });
    const opacity = () => Number(getComputedStyle(title().parentElement as HTMLElement).opacity);
    expect(opacity()).toBe(0);
    headingTop = 40;
    await act(async () => scrollTo(scroller(), 160));
    await waitFor(() => expect(opacity()).toBe(1));
  });
});

describe('PhotoScreen with a top bar', () => {
  it('lets the photo show through the bar until it has scrolled away', () => {
    render(
      <PhotoScreen photo={<Text>Photo</Text>} topBar={{ back: { label: 'Back to recipes', onPress: () => {} }, titleMode: 'onScroll', title: 'Quiche' }}>
        <Text>Content</Text>
      </PhotoScreen>,
    );
    const bar = screen.getByTestId('top-bar');
    expect(bar.style.boxShadow).toBe('');
    scrollTo(scrollerOf(screen.getByText('Photo')), 400);
    expect(bar.style.boxShadow).toBe(theme.shadow.bar);
  });
});

describe('TabScreen with a pinned part (FR-007)', () => {
  it('puts the header above it, sticks it, and marks it once content scrolls under it', () => {
    render(
      <TabScreen header={<Text role="heading">Recipes</Text>} pinned={<Text>Search</Text>}>
        <Text>Quiche</Text>
      </TabScreen>,
    );
    const pinned = screen.getByTestId('tab-pinned');
    const text = document.body.textContent ?? '';
    expect(text.indexOf('Recipes')).toBeLessThan(text.indexOf('Search'));
    expect(text.indexOf('Search')).toBeLessThan(text.indexOf('Quiche'));
    expect(getComputedStyle(pinned.parentElement as HTMLElement).position).toBe('sticky');
    expect(pinned.style.boxShadow).toBe('');
    act(() => scrollTo(scrollerOf(pinned), 40));
    expect(pinned.style.boxShadow).toBe(theme.shadow.bar);
  });
});

describe('ActionMenu', () => {
  it('opens a menu under its button; a pick closes it and runs the action', () => {
    const duplicate = vi.fn();
    render(<ActionMenu label="More actions" items={[{ label: 'Duplicate', onPress: duplicate }, { label: 'Delete event', onPress: () => {}, tone: 'danger' }]} />);
    const button = screen.getByRole('button', { name: 'More actions' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-haspopup')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'More actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(duplicate).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape without doing anything', () => {
    const del = vi.fn();
    render(<ActionMenu label="More actions" items={[{ label: 'Delete event', onPress: del, tone: 'danger' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.keyUp(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(del).not.toHaveBeenCalled();
  });

  it("can't open while off (offline)", () => {
    render(<ActionMenu label="More actions" disabled items={[{ label: 'Duplicate', onPress: () => {} }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
