import type { Layers } from "./LayerSwitcher";
import styles from "../../styles/ViewerTabs.module.css";

interface ViewerTabsProps {
  layers: Layers;
  onChange: (layers: Layers) => void;
}

const items: Array<{ key: keyof Layers; label: string }> = [
  { key: "original", label: "Оригинал" },
  { key: "contour", label: "Контур" },
  { key: "heatmap", label: "Heatmap" },
  { key: "keypoints", label: "Ключевые точки" },
];

const EMPTY: Layers = {
  original: false,
  heatmap: false,
  contour: false,
  keypoints: false,
};

export function ViewerTabs({ layers, onChange }: ViewerTabsProps) {
  const activeKey = (Object.keys(layers) as Array<keyof Layers>).find(
    (k) => layers[k]
  );

  const handleClick = (key: keyof Layers) => {
    // Клик по уже активному табу → возврат к Оригинал
    if (activeKey === key && key !== "original") {
      onChange({ ...EMPTY, original: true });
      return;
    }
    // Клик по неактивному → активируем только его
    onChange({ ...EMPTY, [key]: true });
  };

  return (
    <div className={styles.tabs} role="tablist">
      {items.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            onClick={() => handleClick(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}