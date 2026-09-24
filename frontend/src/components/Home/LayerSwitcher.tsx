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

export function LayerSwitcher({ layers, onChange }: LayerSwitcherProps) {
  return (
    <div className={styles.wrap}>
      {items.map((item) => (
        <Checkbox
          key={item.key}
          checked={layers[item.key]}
          onChange={(checked) => onChange({ ...layers, [item.key]: checked })}
          label={item.label}
        />
      ))}
    </div>
  );
}