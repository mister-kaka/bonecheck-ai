import { useState } from "react";
import { DicomViewer } from "./DicomViewer";
import type { Layers } from "./LayerSwitcher";
import { ResultCard } from "./ResultCard";
import { ImageCarousel } from "./ImageCarousel";
import styles from "../../styles/ResultBlock.module.css";

interface Keypoint {
  x: number;
  y: number;
  label?: string;
}

interface ResultBlockProps {
  files: File[];
  isOk: boolean;
  region: string;
  confidence: number;
  violations?: string[];
  description?: string;
  heatmapUrls?: string[];
  contourPoints?: Array<[number, number]>;
  keypoints?: Keypoint[];
  onExport?: () => void;
  onNewStudy?: () => void;
}

export function ResultBlock({
  files,
  isOk,
  region,
  confidence,
  violations,
  description,
  heatmapUrls,
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

  const [activeIndex, setActiveIndex] = useState(0);

  const activeFile = files[activeIndex] ?? null;
  const activeHeatmap = heatmapUrls?.[activeIndex];

  return (
    <div className={styles.grid}>
      <div className={styles.viewerColumn}>
        {/* DicomViewer внутри содержит табы сверху и контролы слева */}
        <DicomViewer
          file={activeFile}
          layers={layers}
          onLayersChange={setLayers}
          heatmapUrl={activeHeatmap}
          contourPoints={contourPoints}
          keypoints={keypoints}
        />

        {files.length > 1 && (
          <ImageCarousel
            total={files.length}
            activeIndex={activeIndex}
            onChange={setActiveIndex}
          />
        )}
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