import { useState } from "react";
import type { CriterionRow } from "../../../api/layoutCriteria";
import { DicomViewer } from "../viewer/DicomViewer";
import type { Layers } from "../viewer/ViewerTabs";
import { ResultCard } from "./ResultCard";
import { ImageCarousel } from "../viewer/ImageCarousel";
import styles from "./ResultBlock.module.css";

interface Keypoint {
  x: number;
  y: number;
  label?: string;
}

interface ResultBlockProps {
  files?: File[];
  isOk: boolean;
  region: string;
  qualityProb?: number;
  violations?: string[];
  criteria?: CriterionRow[];
  fileName?: string;
  description?: string;
  heatmapUrls?: string[];
  contourPoints?: Array<[number, number]>;
  keypoints?: Keypoint[];
  emptyLabel?: string;
  onExport?: () => void;
  onOpenHistory?: () => void;
  onNewStudy?: () => void;
  exporting?: boolean;
  exportError?: string;
}

export function ResultBlock({
  files = [],
  isOk,
  region,
  qualityProb,
  violations,
  criteria,
  fileName,
  description,
  heatmapUrls,
  contourPoints,
  keypoints,
  emptyLabel,
  onExport,
  onOpenHistory,
  onNewStudy,
  exporting,
  exportError,
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
        <DicomViewer
          file={activeFile}
          layers={layers}
          onLayersChange={setLayers}
          heatmapUrl={activeHeatmap}
          contourPoints={contourPoints}
          keypoints={keypoints}
          emptyLabel={emptyLabel}
        />

        {files.length > 1 && (
          <ImageCarousel
            total={files.length}
            activeIndex={activeIndex}
            onChange={setActiveIndex}
          />
        )}
      </div>

      <div className={styles.reportColumn}>
        <ResultCard
          isOk={isOk}
          region={region}
          qualityProb={qualityProb}
          violations={violations}
          criteria={criteria}
          fileName={fileName}
          description={description}
          onExport={onExport}
          onOpenHistory={onOpenHistory}
          onNewStudy={onNewStudy}
          exporting={exporting}
          exportError={exportError}
        />
      </div>
    </div>
  );
}