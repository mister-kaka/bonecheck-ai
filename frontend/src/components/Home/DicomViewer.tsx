import { useEffect, useRef, useState, useCallback } from "react";
import dicomParser from "dicom-parser";
import { ViewerTabs } from "./ViewerTabs";
import { ViewerControls } from "./ViewerControls";
import type { Layers } from "./LayerSwitcher";
import styles from "../../styles/DicomViewer.module.css";

interface Keypoint {
  x: number;
  y: number;
  label?: string;
}

interface DicomViewerProps {
  file?: File | null;
  layers: Layers;
  onLayersChange: (layers: Layers) => void;
  heatmapUrl?: string;
  contourPoints?: Array<[number, number]>;
  keypoints?: Keypoint[];
}

export function DicomViewer({
  file,
  layers,
  onLayersChange,
  heatmapUrl,
  contourPoints,
  keypoints,
}: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
    null
  );

  // ---- Парсинг DICOM и отрисовка в canvas ----
  useEffect(() => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const byteArray = new Uint8Array(buffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        const rows = dataSet.uint16("x00280010");
        const columns = dataSet.uint16("x00280011");
        const pixelElement = dataSet.elements.x7fe00010;

        if (!rows || !columns || !pixelElement) {
          setError("Не удалось прочитать пиксельные данные DICOM");
          return;
        }

        const pixelData = new Uint8Array(
          byteArray.buffer,
          pixelElement.dataOffset,
          pixelElement.length
        );

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = columns;
        canvas.height = rows;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.createImageData(columns, rows);
        for (let i = 0; i < pixelData.length; i++) {
          const v = pixelData[i];
          imageData.data[i * 4] = v;
          imageData.data[i * 4 + 1] = v;
          imageData.data[i * 4 + 2] = v;
          imageData.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        setImageSize({ w: columns, h: rows });
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Ошибка чтения DICOM");
      }
    };

    reader.readAsArrayBuffer(file);
  }, [file]);

  // ---- Зум ----
  const zoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.2, 5)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.2, 0.5)), []);
  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // ---- Пан ----
  const onMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const onMouseUp = () => setIsPanning(false);

  // ---- Колесо мыши ----
  const onWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  return (
    <div className={styles.viewer}>
      {/* Табы режимов — сверху */}
      <div className={styles.topBar}>
        <ViewerTabs layers={layers} onChange={onLayersChange} />
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {!file ? (
        <div className={styles.placeholder}>
          <span>DICOM-ИЗОБРАЖЕНИЕ</span>
        </div>
      ) : (
        <div className={styles.body}>
          {/* Вертикальные контролы — слева */}
          <ViewerControls
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
          />

          {/* Сцена с изображением */}
          <div
            className={styles.stage}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            style={{ cursor: isPanning ? "grabbing" : "grab" }}
          >
            <div
              className={styles.imageWrapper}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              <canvas
                ref={canvasRef}
                className={styles.canvas}
                style={{ opacity: layers.original ? 1 : 0 }}
              />

              {layers.heatmap && heatmapUrl && (
                <img
                  src={heatmapUrl}
                  alt="heatmap"
                  className={styles.overlay}
                  draggable={false}
                />
              )}

              {layers.contour && contourPoints && imageSize && (
                <svg
                  className={styles.overlay}
                  viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={contourPoints
                      .map(([x, y]) => `${x},${y}`)
                      .join(" ")}
                    fill="none"
                    stroke="#FFD25A"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                </svg>
              )}

              {layers.keypoints && keypoints && imageSize && (
                <svg
                  className={styles.overlay}
                  viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
                  preserveAspectRatio="none"
                >
                  {keypoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#FFD25A"
                      stroke="#1A2028"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Подпись файла — снизу */}
      {file && (
        <div className={styles.footer}>
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.fileFormat}>DICOM CR</span>
        </div>
      )}
    </div>
  );
}