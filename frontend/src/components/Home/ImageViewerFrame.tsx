import type { ReactNode } from "react";
import { IconButton } from "../IconButton";
import styles from "../../styles/ImageViewerFrame.module.css";

interface ImageViewerFrameProps {
  /** Содержимое рамки (например, canvas с DICOM). Если не передано — показывается плейсхолдер */
  children?: ReactNode;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
}

export function ImageViewerFrame({
  children,
  onZoomIn,
  onZoomOut,
  onReset,
}: ImageViewerFrameProps) {
  return (
    <div className={styles.frame}>
      <div className={styles.toolbar}>
        <IconButton size="sm" ariaLabel="Увеличить" onClick={onZoomIn}>
          +
        </IconButton>
        <IconButton size="sm" ariaLabel="Уменьшить" onClick={onZoomOut}>
          −
        </IconButton>
        <IconButton size="sm" ariaLabel="Сбросить масштаб" onClick={onReset}>
          ⟲
        </IconButton>
      </div>

      {children ?? (
        <div className={styles.placeholder}>
          <span>DICOM-ИЗОБРАЖЕНИЕ</span>
        </div>
      )}
    </div>
  );
}
