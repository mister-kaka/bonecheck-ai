import { Checkbox } from "../Checkbox";
import styles from "../../styles/LayerSwitcher.module.css";

export interface Layers {
  original: boolean;
  heatmap: boolean;
  contour: boolean;
  keypoints: boolean;
}

interface LayerSwitcherProps {
  layers: Layers;
  onChange: (layers: Layers) => void;
}

const items: Array<{ key: keyof Layers; label: string }> = [
  { key: "original", label: "Оригинал" },
  { key: "heatmap", label: "Heatmap" },
  { key: "contour", label: "Контур" },
  { key: "keypoints", label: "Ключ. точки" },
];

const EMPTY: Layers = {
  original: false,
  heatmap: false,
  contour: false,
  keypoints: false,
};

export function LayerSwitcher({ layers, onChange }: LayerSwitcherProps) {
  const handleChange = (key: keyof Layers, checked: boolean) => {
    if (!checked) {
      // Снятие любой галочки возвращает слой «Оригинал».
      onChange({ ...EMPTY, original: true });
      return;
    }
    // Включённым остаётся только выбранный слой.
    onChange({ ...EMPTY, [key]: true });
  };

  return (
    <div className={styles.wrap}>
      {items.map((item) => (
        <Checkbox
          key={item.key}
          checked={layers[item.key]}
          onChange={(e) => handleChange(item.key, e.target.checked)}
          label={item.label}
        />
      ))}
    </div>
  );
}