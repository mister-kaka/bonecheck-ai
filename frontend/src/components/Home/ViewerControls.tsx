import styles from "../../styles/ViewerControls.module.css";

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
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.btn}
        onClick={onZoomIn}
        aria-label="Увеличить"
      >
        +
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onZoomOut}
        aria-label="Уменьшить"
      >
        −
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onReset}
        aria-label="Сбросить масштаб"
      >
        ⟲
      </button>
    </div>
  );
}