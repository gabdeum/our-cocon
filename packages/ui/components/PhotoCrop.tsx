import { useMemo, useState } from 'react';
import { Image, PanResponder, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';

/** The recipe header's shape (390 × 240, spec 014 FR-004). */
export const PHOTO_ASPECT = 13 / 8;
const MAX_ZOOM = 3;
/** Until the frame is measured: the header's size. Centred at 1× the crop is the same at any size. */
const DEFAULT_FRAME: Size = { width: 390, height: 240 };
const ZOOM_STEP = 0.5;

export interface Size {
  width: number;
  height: number;
}
/** Where the image's top-left corner sits in the frame (≤ 0), in frame points. */
export interface Offset {
  x: number;
  y: number;
}
/** The part of the image to keep, in image pixels (what expo-image-manipulator's crop takes). */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Image points per pixel: at zoom 1 the image just covers the frame. */
export const cropScale = (image: Size, frame: Size, zoom: number) => Math.max(frame.width / image.width, frame.height / image.height) * zoom;

/** Keeps the frame covered: the image can't be dragged past its edges. */
export function clampOffset(offset: Offset, image: Size, frame: Size, zoom: number): Offset {
  const s = cropScale(image, frame, zoom);
  const clamp = (v: number, shown: number, room: number) => Math.min(0, Math.max(room - shown, v));
  return {
    x: clamp(offset.x, image.width * s, frame.width),
    y: clamp(offset.y, image.height * s, frame.height),
  };
}

/** The image centred in the frame. */
export function centredOffset(image: Size, frame: Size, zoom: number): Offset {
  const s = cropScale(image, frame, zoom);
  return {
    x: (frame.width - image.width * s) / 2,
    y: (frame.height - image.height * s) / 2,
  };
}

/** Zooms around the frame's centre, so what's in the middle stays there. */
export function zoomOffset(offset: Offset, image: Size, frame: Size, from: number, to: number): Offset {
  const ratio = cropScale(image, frame, to) / cropScale(image, frame, from);
  const cx = frame.width / 2;
  const cy = frame.height / 2;
  return clampOffset({ x: cx - (cx - offset.x) * ratio, y: cy - (cy - offset.y) * ratio }, image, frame, to);
}

/** What the frame shows, in whole image pixels inside the image. */
export function cropRect(offset: Offset, image: Size, frame: Size, zoom: number): CropRect {
  const s = cropScale(image, frame, zoom);
  const width = Math.min(image.width, Math.round(frame.width / s));
  const height = Math.min(image.height, Math.round(frame.height / s));
  return {
    originX: Math.max(0, Math.min(image.width - width, Math.round(-offset.x / s))),
    originY: Math.max(0, Math.min(image.height - height, Math.round(-offset.y / s))),
    width,
    height,
  };
}

interface CropView {
  frame: Size;
  zoom: number;
  offset: Offset;
  /** The offset when the current drag began. */
  start: Offset;
}

export interface PhotoCropProps {
  source: ImageSourcePropType;
  /** The picked image's size in pixels. */
  image: Size;
  /** "Fit your photo" */
  title: string;
  /** "Drag to choose what shows in the header." */
  hint: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  confirmLabel: string;
  onConfirm: (rect: CropRect) => void;
  cancelLabel: string;
  onCancel: () => void;
}

/**
 * The crop step after picking a photo (PhotoCrop README; spec 014 FR-004): the photo under a fixed
 * 13:8 frame, dragged to place and zoomed with two buttons. Screen-reader users get it centred.
 */
export function PhotoCrop({ source, image, title, hint, zoomInLabel, zoomOutLabel, confirmLabel, onConfirm, cancelLabel, onCancel }: PhotoCropProps) {
  // One state, so the drag handlers (made once) always update from the latest values.
  const [view, setView] = useState<CropView | null>(null);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => setView((v) => v && { ...v, start: v.offset }),
        onPanResponderMove: (_e, g) =>
          setView(
            (v) =>
              v && {
                ...v,
                offset: clampOffset({ x: v.start.x + g.dx, y: v.start.y + g.dy }, image, v.frame, v.zoom),
              },
          ),
      }),
    [image],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (view?.frame.width === width) return;
    const frame = { width, height: width / PHOTO_ASPECT };
    const offset = centredOffset(image, frame, 1);
    setView({ frame, zoom: 1, offset, start: offset });
  };

  const zoomTo = (to: number) =>
    setView(
      (v) =>
        v && {
          ...v,
          zoom: to,
          offset: zoomOffset(v.offset, image, v.frame, v.zoom, to),
        },
    );

  const zoom = view?.zoom ?? 1;
  const s = view ? cropScale(image, view.frame, zoom) : 0;
  return (
    <View className="flex-1 gap-18 bg-surface-page px-20 pb-24 pt-[50px]">
      <View className="gap-6">
        <Text variant="titleLg" role="heading" aria-level={1}>
          {title}
        </Text>
        <Text variant="caption" color="ink-muted">
          {hint}
        </Text>
      </View>
      <View onLayout={onLayout} className="w-full overflow-hidden rounded-[22px] bg-ink" style={{ aspectRatio: PHOTO_ASPECT }} {...pan.panHandlers}>
        {view ? (
          <Image
            source={source}
            aria-hidden
            style={{
              position: 'absolute',
              left: view.offset.x,
              top: view.offset.y,
              width: image.width * s,
              height: image.height * s,
            }}
          />
        ) : null}
      </View>
      <View className="flex-row gap-10">
        <Button label={zoomOutLabel} variant="soft" size="sm" onPress={() => zoomTo(Math.max(1, zoom - ZOOM_STEP))} disabled={zoom <= 1} className="flex-1" />
        <Button
          label={zoomInLabel}
          variant="soft"
          size="sm"
          onPress={() => zoomTo(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
          className="flex-1"
        />
      </View>
      <View className="mt-auto flex-row gap-10">
        <Button label={cancelLabel} variant="soft" onPress={onCancel} className="w-[110px]" />
        <Button
          label={confirmLabel}
          variant="olive"
          onPress={() =>
            onConfirm(view ? cropRect(view.offset, image, view.frame, view.zoom) : cropRect(centredOffset(image, DEFAULT_FRAME, 1), image, DEFAULT_FRAME, 1))
          }
          className="flex-1"
        />
      </View>
    </View>
  );
}
