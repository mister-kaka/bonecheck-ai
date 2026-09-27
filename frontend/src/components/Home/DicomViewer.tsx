import { useEffect, useRef, useState, useCallback } from "react";
import dicomParser from "dicom-parser";
import { ViewerTabs } from "./ViewerTabs";
import { ViewerControls } from "./ViewerControls";
import type { Layers } from "./LayerSwitcher";
import styles from "../../styles/DicomViewer.module.css";

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
    return { ok: false, message: "Не удалось прочитать пиксельные данные DICOM" };
  }

  if (pixelElement.length === 0xffffffff) {
    return { ok: false, message: "Сжатый DICOM в просмотре не поддерживается" };
  }

  const samplesPerPixel = dataSet.uint16("x00280002") ?? 1;
  if (samplesPerPixel !== 1) {
    return { ok: false, message: "Поддерживаются только одноканальные DICOM-изображения" };
  }

  const bitsAllocated = dataSet.uint16("x00280100") ?? 8;
  if (bitsAllocated !== 8 && bitsAllocated !== 16) {
    return { ok: false, message: "Неподдерживаемая глубина пикселей DICOM" };
  }

  const pixelCount = rows * columns;
  const bytesNeeded = pixelCount * (bitsAllocated / 8);
  if (pixelElement.length < bytesNeeded) {
    return { ok: false, message: "Не удалось прочитать пиксельные данные DICOM" };
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
        setError("Ошибка чтения DICOM");
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
        setError("Ошибка чтения DICOM");
      }
    };

    reader.onerror = () => {
      if (!cancelled) setError("Ошибка чтения DICOM");
    };

    reader.readAsArrayBuffer(file);

    return () => {
      cancelled = true;
      reader.abort();
    };
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
          <span className={styles.fileFormat}>{modality}</span>
        </div>
      )}
    </div>
  );
}