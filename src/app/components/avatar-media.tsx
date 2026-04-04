import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AvatarCropSettings } from "@/domain/types";

function clampAvatarPan(value: number) {
  return Math.max(-100, Math.min(100, value));
}

function getAvatarCoverPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  zoom: number,
  panX: number,
  panY: number,
) {
  const safeSourceWidth = Math.max(sourceWidth, 1);
  const safeSourceHeight = Math.max(sourceHeight, 1);
  const safeZoom = Math.max(1, zoom);
  const baseScale = Math.max(targetWidth / safeSourceWidth, targetHeight / safeSourceHeight);
  const drawWidth = safeSourceWidth * baseScale * safeZoom;
  const drawHeight = safeSourceHeight * baseScale * safeZoom;
  const overflowX = Math.max(drawWidth - targetWidth, 0);
  const overflowY = Math.max(drawHeight - targetHeight, 0);
  const left = (targetWidth - drawWidth) / 2 + (clampAvatarPan(panX) / 100) * (overflowX / 2);
  const top = (targetHeight - drawHeight) / 2 + (clampAvatarPan(panY) / 100) * (overflowY / 2);

  return {
    drawWidth,
    drawHeight,
    left,
    top,
  };
}

function getAvatarCropStyle(
  crop: AvatarCropSettings | undefined,
  frameWidth: number,
  frameHeight: number,
): CSSProperties | undefined {
  if (!crop || !crop.sourceWidth || !crop.sourceHeight || !frameWidth || !frameHeight) {
    return undefined;
  }

  const placement = getAvatarCoverPlacement(
    crop.sourceWidth,
    crop.sourceHeight,
    frameWidth,
    frameHeight,
    crop.zoom,
    crop.panX,
    crop.panY,
  );

  return {
    position: "absolute",
    left: `${placement.left}px`,
    top: `${placement.top}px`,
    width: `${placement.drawWidth}px`,
    height: `${placement.drawHeight}px`,
    maxWidth: "none",
  };
}

type AvatarMediaProps = {
  src: string;
  alt: string;
  crop?: AvatarCropSettings;
  className?: string;
  imageClassName?: string;
};

export function AvatarMedia({ src, alt, crop, className = "", imageClassName = "" }: AvatarMediaProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      setFrameSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const croppedStyle = useMemo(
    () => getAvatarCropStyle(crop, frameSize.width, frameSize.height),
    [crop, frameSize.height, frameSize.width],
  );

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        style={croppedStyle}
        className={
          croppedStyle
            ? `absolute select-none ${imageClassName}`.trim()
            : `h-full w-full object-cover object-center ${imageClassName}`.trim()
        }
        draggable={false}
      />
    </div>
  );
}
