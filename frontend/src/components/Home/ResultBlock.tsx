import { useState } from "react";
import { DicomViewer } from "./DicomViewer";
import { LayerSwitcher, type Layers } from "./LayerSwitcher";
import { ResultCard } from "./ResultCard";
import styles from "../../styles/ResultBlock.module.css";

interface Keypoint {
  x: number;
  y: number;
  label?: string;
}

interface ResultBlockProps {
  file?: File | null;
  isOk: boolean;
  region: string;
  confidence: number;
  violations?: string[];
  description?: string;
  heatmapUrl?: string;
  contourPoints?: Array<[number, number]>;
  keypoints?: Keypoint[];
  onExport?: () => void;
  onNewStudy?: () => void;
}

export function ResultBlock({
  file,
  isOk,
  region,
  confidence,
  violations,
  description,
  heatmapUrl,
  contourPoints,
  keypoints,
  onExport,
  onNewStudy,
}: ResultBlockProps) {
  const [layers, setLayers] = useState<Layers>({
    original: true,
    heatmap: false,
    contour: false,
    keypoints: false,
  });

  return (
    <div className={styles.grid}>
      <div className={styles.viewerColumn}>
        <DicomViewer
          file={file}
          layers={layers}
          heatmapUrl={heatmapUrl}
          contourPoints={contourPoints}
          keypoints={keypoints}
        />
        <LayerSwitcher layers={layers} onChange={setLayers} />
      </div>

      <ResultCard
        isOk={isOk}
        region={region}
        confidence={confidence}
        violations={violations}
        description={description}
        onExport={onExport}
        onNewStudy={onNewStudy}
      />
    </div>
  );
}