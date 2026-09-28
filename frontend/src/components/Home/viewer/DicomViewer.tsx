import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import dicomParser from "dicom-parser";
import { ViewerTabs, type Layers } from "./ViewerTabs";
import { ViewerControls } from "./ViewerControls";
import styles from "./DicomViewer.module.css";

type DecodedFrame =
  | { ok: true; rgba: Uint8ClampedArray; width: number; height: number; modality: string }
  | { ok: false; message: string };

function firstNumber(dataSet: dicomParser.DataSet, tag: string): number | undefined {
  const raw = dataSet.string(tag);
  if (!raw) return undefined;
  const value = Number(raw.split("\\")[0]?.trim());
  return Number.isFinite(value) ? value : undefined;
}

function decodeFrame(dataSet: dicomParser.DataSet, byteArray: Uint8Array): DecodedFrame {
  const rows = dataSet.uint16("x00280010");
  const columns = dataSet.uint16("x00280011");
  const pixelElement = dataSet.elements.x7fe00010;

  if (!rows || !columns || !pixelElement) {
    return { ok: false, message: "Не удалось прочитать снимок. Файл может быть повреждён." };
  }

  if (pixelElement.length === 0xffffffff) {
    return { ok: false, message: "Сжатый DICOM в просмотре не поддерживается." };
  }

  const samplesPerPixel = dataSet.uint16("x00280002") ?? 1;
  if (samplesPerPixel !== 1) {
    return { ok: false, message: "В просмотре поддерживаются только одноканальные снимки." };
  }

  const bitsAllocated = dataSet.uint16("x00280100") ?? 8;
  if (bitsAllocated !== 8 && bitsAllocated !== 16) {
    return { ok: false, message: "Эта глубина изображения в просмотре не поддерживается." };
  }

  const pixelCount = rows * columns;
  const bytesNeeded = pixelCount * (bitsAllocated / 8);
  if (pixelElement.length < bytesNeeded) {
    return { ok: false, message: "Не удалось прочитать снимок. Файл может быть повреждён." };
  }

  const signed = (dataSet.uint16("x00280103") ?? 0) === 1;
  const transferSyntax = dataSet.string("x00020010") ?? "";
  const littleEndian = !transferSyntax.includes("1.2.840.10008.1.2.2");
  const photometric = (dataSet.string("x00280004") ?? "MONOCHROME2").trim().toUpperCase();
  const invert = photometric === "MONOCHROME1";
  const modality = (dataSet.string("x00080060") ?? "").trim() || "DICOM";
  const samples = new Int32Array(pixelCount);
  const base = pixelElement.dataOffset;

  if (bitsAllocated === 8) {
    for (let i = 0; i < pixelCount; i++) {
      const value = byteArray[base + i] ?? 0;
      samples[i] = signed && value > 127 ? value - 256 : value;
    }
  } else {
    const view = new DataView(
      byteArray.buffer,
      byteArray.byteOffset + base,
      pixelElement.length,
    );
    for (let i = 0; i < pixelCount; i++) {
      samples[i] = signed
        ? view.getInt16(i * 2, littleEndian)
        : view.getUint16(i * 2, littleEndian);
    }
  }

  let windowCenter = firstNumber(dataSet, "x00281050");
  let windowWidth = firstNumber(dataSet, "x00281051");
  if (windowCenter === undefined || windowWidth === undefined || windowWidth <= 0) {
    let min = samples[0] ?? 0;
    let max = min;
    for (let i = 1; i < samples.length; i++) {
      const sample = samples[i] ?? min;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    windowCenter = (min + max) / 2;
    windowWidth = Math.max(1, max - min);
  }

  const low = windowCenter - windowWidth / 2;
  const high = windowCenter + windowWidth / 2;
  const span = Math.max(1, high - low);
  const rgba = new Uint8ClampedArray(pixelCount * 4);

  for (let i = 0; i < pixelCount; i++) {
    const sample = samples[i] ?? low;
    let gray = 0;
    if (sample <= low) gray = 0;
    else if (sample >= high) gray = 255;
    else gray = Math.round(((sample - low) / span) * 255);
    if (invert) gray = 255 - gray;
    const offset = i * 4;
    rgba[offset] = gray;
    rgba[offset + 1] = gray;
    rgba[offset + 2] = gray;
    rgba[offset + 3] = 255;
  }

  return { ok: true, rgba, width: columns, height: rows, modality };
}

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
  emptyLabel?: string;
}

export function DicomViewer({
  file,
  layers,
  onLayersChange,
  heatmapUrl,
  contourPoints,
  keypoints,
  emptyLabel = "Нет изображения",
}: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [modality, setModality] = useState("DICOM");

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setError(null);
    setImageSize(null);
    setModality("DICOM");

    if (!file) return;

    let cancelled = false;
    const reader = new FileReader();

    reader.onload = () => {
      if (cancelled) return;
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) {
        setError("Не удалось открыть снимок.");
        return;
      }

      try {
        const byteArray = new Uint8Array(buffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        const frame = decodeFrame(dataSet, byteArray);
        if (!frame.ok) {
          setError(frame.message);
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = frame.width;
        canvas.height = frame.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.createImageData(frame.width, frame.height);
        imageData.data.set(frame.rgba);
        ctx.putImageData(imageData, 0, 0);

        setImageSize({ w: frame.width, h: frame.height });
        setModality(frame.modality);
        setError(null);
      } catch {
        setError("Не удалось открыть снимок.");
      }
    };

    reader.onerror = () => {
      if (!cancelled) setError("Не удалось открыть снимок.");
    };

    reader.readAsArrayBuffer(file);

    return () => {
      cancelled = true;
      reader.abort();
    };
  }, [file]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.2, 5)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.2, 0.5)), []);
  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };
  const onMouseUp = () => setIsPanning(false);

  const onWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    image.style.setProperty("--pan-x", `${pan.x}px`);
    image.style.setProperty("--pan-y", `${pan.y}px`);
    image.style.setProperty("--zoom", String(zoom));
  }, [pan.x, pan.y, zoom]);

  const availableLayers: Array<keyof Layers> = ["original"];
  if (contourPoints && contourPoints.length > 0) availableLayers.push("contour");
  if (heatmapUrl) availableLayers.push("heatmap");
  if (keypoints && keypoints.length > 0) availableLayers.push("keypoints");

  return (
    <div className={styles.viewer}>
      {availableLayers.length > 1 && (
        <div className={styles.topBar}>
          <ViewerTabs
            layers={layers}
            onChange={onLayersChange}
            available={availableLayers}
          />
        </div>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}

      {!file ? (
        <div className={styles.placeholder}>
          <span>{emptyLabel}</span>
        </div>
      ) : (
        <div className={styles.body}>
          <ViewerControls
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={reset}
          />

          <div
            className={isPanning ? `${styles.stage} ${styles.stagePanning}` : styles.stage}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            <div
              ref={imageRef}
              className={`${styles.imageWrapper} ${imageSize ? styles.framed : ""}`}
            >
              <canvas
                ref={canvasRef}
                className={layers.original ? styles.canvas : `${styles.canvas} ${styles.canvasHidden}`}
              />

              {layers.heatmap && heatmapUrl && (
                <img
                  src={heatmapUrl}
                  alt="Тепловая карта"
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
                    stroke="#e2c16a"
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
                      fill="#e2c16a"
                      stroke="#0b1220"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>
      )}

      {file && (
        <div className={styles.footer}>
          <span className={styles.fileName}>{file.name}</span>
          <span className={styles.meta}>
            <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
            <span className={styles.fileFormat}>{modality}</span>
          </span>
        </div>
      )}
    </div>
  );
}