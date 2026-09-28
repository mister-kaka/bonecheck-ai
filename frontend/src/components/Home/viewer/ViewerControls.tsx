import { Icon } from "../../ui/Icon";
import styles from "./ViewerControls.module.css";

interface ViewerControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ViewerControls({
  onZoomIn,
  onZoomOut,
  onReset,
}: ViewerControlsProps) {
  return (
    <div className={styles.controls} role="toolbar" aria-label="Масштаб изображения">
      <button type="button" className={styles.btn} onClick={onZoomIn} aria-label="Увеличить">
        <Icon name="zoom-in" size={16} />
      </button>
      <button type="button" className={styles.btn} onClick={onZoomOut} aria-label="Уменьшить">
        <Icon name="zoom-out" size={16} />
      </button>
      <button type="button" className={styles.btn} onClick={onReset} aria-label="Сбросить масштаб">
        <Icon name="reset" size={16} />
      </button>
    </div>
  );
}
