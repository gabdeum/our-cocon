// PhotoField and PhotoCrop (spec 014 FR-004): the field's states, and the crop maths that turn
// what the 13:8 frame shows into image pixels.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhotoField } from './PhotoField';
import { centredOffset, clampOffset, cropRect, zoomOffset } from './PhotoCrop';

afterEach(cleanup);

const labels = { addLabel: 'Add a photo (optional)', changeLabel: 'Change photo', removeLabel: 'Remove', photoLabel: 'Recipe photo' };

describe('PhotoField', () => {
  it('is one dashed button until there is a photo', () => {
    const onAdd = vi.fn();
    render(<PhotoField {...labels} onAdd={onAdd} onChange={vi.fn()} onRemove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo (optional)' }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('shows the photo with Change photo and Remove', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    render(<PhotoField {...labels} source={{ uri: 'file:///quiche.jpg' }} onAdd={vi.fn()} onChange={onChange} onRemove={onRemove} />);
    expect(screen.getAllByRole('img', { name: 'Recipe photo' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it('says it is uploading, and cannot be changed or removed meanwhile', () => {
    render(<PhotoField {...labels} source={{ uri: 'file:///quiche.jpg' }} busyLabel="Uploading photo…" onAdd={vi.fn()} onChange={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('Uploading photo…');
    expect(screen.getByRole('button', { name: 'Change photo' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Remove' }).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('PhotoCrop maths', () => {
  // A 4000 × 3000 photo (4:3) in a 390 × 240 frame (13:8, wider): at zoom 1 its full width shows.
  const image = { width: 4000, height: 3000 };
  const frame = { width: 390, height: 240 };

  it('starts centred and covers the frame', () => {
    const offset = centredOffset(image, frame, 1);
    const rect = cropRect(offset, image, frame, 1);
    expect(rect.width / rect.height).toBeCloseTo(13 / 8, 2);
    expect(rect.originX).toBe(0);
    expect(rect.width).toBe(4000);
    expect(rect.originY + rect.height / 2).toBeCloseTo(1500, -1);
  });

  it('never drags past the photo edges', () => {
    expect(clampOffset({ x: 50, y: 50 }, image, frame, 1)).toEqual({ x: 0, y: 0 });
    const far = clampOffset({ x: -100000, y: -100000 }, image, frame, 1);
    const rect = cropRect(far, image, frame, 1);
    expect(rect.originX + rect.width).toBe(4000);
    expect(rect.originY + rect.height).toBe(3000);
  });

  it('zooms around the centre', () => {
    const at1 = centredOffset(image, frame, 1);
    const at2 = zoomOffset(at1, image, frame, 1, 2);
    const before = cropRect(at1, image, frame, 1);
    const after = cropRect(at2, image, frame, 2);
    expect(after.width).toBeCloseTo(before.width / 2, -1);
    expect(after.originX + after.width / 2).toBeCloseTo(before.originX + before.width / 2, -1);
  });

  it('works for a panorama', () => {
    const wide = { width: 6000, height: 1000 };
    const rect = cropRect(centredOffset(wide, frame, 1), wide, frame, 1);
    expect(rect.height).toBe(1000);
    expect(rect.originY).toBe(0);
    expect(rect.originX + rect.width / 2).toBeCloseTo(3000, -1);
  });
});
