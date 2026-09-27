import type { HomeView } from "../pages/Home/useStudyFlow";
import {
  ANALYSIS_ERROR_MESSAGE,
  FILE_EMPTY_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
  FILE_TYPE_MESSAGE,
} from "../api/fileRules";
import {
  MOCK_RESULT_HIP_OK,
  MOCK_RESULT_HIP_VIOLATION,
  MOCK_RESULT_OK,
  MOCK_RESULT_SPINE_VIOLATION,
} from "../mocks/result";

export type DemoMode =
  | "live"
  | "idle"
  | "selected"
  | "uploading"
  | "validation-empty"
  | "validation-type"
  | "validation-size"
  | "processing"
  | "result-ok"
  | "result-violation"
  | "result-hip"
  | "result-no-prob"
  | "analysis-error";

const DEMO_NOTICE = "Демонстрационное состояние. Запрос к серверу не отправлялся.";

const SAMPLE = {
  fileName: "spine-01.dcm",
  sizeLabel: "1.2 МБ",
  format: "DICOM",
};

export function previewHome(mode: Exclude<DemoMode, "live">): HomeView {
  switch (mode) {
    case "idle":
      return { kind: "idle" };
    case "selected":
      return { kind: "selected", ...SAMPLE };
    case "uploading":
      return { kind: "uploading", ...SAMPLE, progress: 46 };
    case "validation-empty":
      return { kind: "file-error", message: FILE_EMPTY_MESSAGE };
    case "validation-type":
      return { kind: "file-error", message: FILE_TYPE_MESSAGE };
    case "validation-size":
      return { kind: "file-error", message: FILE_TOO_LARGE_MESSAGE };
    case "processing":
      return { kind: "processing", fileName: SAMPLE.fileName, progress: 62 };
    case "result-ok":
      return { kind: "result", file: null, result: MOCK_RESULT_OK, notice: DEMO_NOTICE };
    case "result-violation":
      return {
        kind: "result",
        file: null,
        result: MOCK_RESULT_SPINE_VIOLATION,
        notice: DEMO_NOTICE,
      };
    case "result-hip":
      return {
        kind: "result",
        file: null,
        result: MOCK_RESULT_HIP_VIOLATION,
        notice: DEMO_NOTICE,
      };
    case "result-no-prob":
      return { kind: "result", file: null, result: MOCK_RESULT_HIP_OK, notice: DEMO_NOTICE };
    case "analysis-error":
      return { kind: "analysis-error", message: ANALYSIS_ERROR_MESSAGE };
  }
}
