import type { StudyListItem, StudyResultPayload } from "../types/study";
import { ANALYSIS_ERROR_MESSAGE } from "../api/fileRules";
import {
  MOCK_RESULT_HIP_OK,
  MOCK_RESULT_HIP_OK_PROB,
  MOCK_RESULT_HIP_VIOLATION,
  MOCK_RESULT_OK,
  MOCK_RESULT_SPINE_POSITION,
  MOCK_RESULT_SPINE_VIOLATION,
} from "./result";

/** Локальная история. owner не поле API: от него зависит только sessionId строки. */

export type DemoStudy = {
  study: StudyListItem;
  result: StudyResultPayload | null;
};

type SeedOwner = "session" | "other" | "none";

type Seed = {
  owner: SeedOwner;
  study: Omit<StudyListItem, "sessionId">;
  result: StudyResultPayload | null;
};

const OTHER_SESSION_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

function completed(
  owner: SeedOwner,
  result: StudyResultPayload,
  originalFileName: string,
  createdAt: string,
): Seed {
  return {
    owner,
    result,
    study: {
      id: result.studyId,
      status: "completed",
      originalFileName,
      createdAt,
      updatedAt: createdAt,
      error: null,
      hasResult: true,
    },
  };
}

function unfinished(
  owner: SeedOwner,
  id: string,
  status: "processing" | "error",
  originalFileName: string,
  createdAt: string,
): Seed {
  return {
    owner,
    result: null,
    study: {
      id,
      status,
      originalFileName,
      createdAt,
      updatedAt: createdAt,
      error: status === "error" ? ANALYSIS_ERROR_MESSAGE : null,
      hasResult: false,
    },
  };
}

const SEEDS: Seed[] = [
  completed("session", MOCK_RESULT_OK, "spine-01.dcm", "2026-09-26T16:40:00.000Z"),
  unfinished("session", "6512bd43-d9ca-46e0-8b1f-3a2b4c5d6e74", "processing", "spine-03.dcm", "2026-09-26T11:15:00.000Z"),
  completed("session", MOCK_RESULT_SPINE_POSITION, "spine-07.dcm", "2026-09-25T18:02:00.000Z"),
  unfinished("session", "d3d94468-02a4-4a5b-9c6d-7e8f9a0b1c23", "error", "hip-03.dcm", "2026-09-25T09:30:00.000Z"),
  completed("session", MOCK_RESULT_HIP_OK, "hip-02.dcm", "2026-09-24T14:11:00.000Z"),
  completed("session", MOCK_RESULT_HIP_VIOLATION, "hip-01.dcm", "2026-09-23T08:45:00.000Z"),
  completed("session", MOCK_RESULT_SPINE_VIOLATION, "spine-02.dcm", "2026-09-22T12:05:00.000Z"),
  completed("session", MOCK_RESULT_HIP_OK_PROB, "hip-04.dcm", "2026-09-21T07:20:00.000Z"),
  completed(
    "other",
    {
      studyId: "6ba7b811-9dad-41d1-80b4-00c04fd430c8",
      quality_class: 0,
      violation_type: "",
      quality_prob: 0.11,
      anatomical_region: "Поясничный отдел позвоночника",
    },
    "shared-spine-01.dcm",
    "2026-09-20T15:00:00.000Z",
  ),
  completed(
    "other",
    {
      studyId: "6ba7b812-9dad-41d1-80b4-00c04fd430c8",
      quality_class: 1,
      violation_type: "Некорректная укладка",
      quality_prob: 0.81,
      anatomical_region: "Проксимальный отдел бедра",
    },
    "shared-hip-01.dcm",
    "2026-09-19T10:12:00.000Z",
  ),
  unfinished("other", "6ba7b813-9dad-41d1-80b4-00c04fd430c8", "error", "shared-hip-02.dcm", "2026-09-18T16:40:00.000Z"),
  unfinished("other", "6ba7b814-9dad-41d1-80b4-00c04fd430c8", "processing", "shared-spine-02.dcm", "2026-09-17T09:05:00.000Z"),
  completed(
    "other",
    {
      studyId: "6ba7b816-9dad-41d1-80b4-00c04fd430c8",
      quality_class: 1,
      violation_type: "Присутствуют посторонние предметы",
      quality_prob: 0.58,
      anatomical_region: "Поясничный отдел позвоночника",
    },
    "shared-spine-03.dcm",
    "2026-09-16T13:22:00.000Z",
  ),
  completed(
    "none",
    {
      studyId: "6ba7b815-9dad-41d1-80b4-00c04fd430c8",
      quality_class: 0,
      violation_type: "",
      quality_prob: 0.06,
      anatomical_region: "Проксимальный отдел бедра",
    },
    "anonymous-hip.dcm",
    "2026-09-15T08:00:00.000Z",
  ),
];

export function buildDemoStudies(sessionId: string): DemoStudy[] {
  return SEEDS.map((seed) => ({
    study: {
      ...seed.study,
      sessionId:
        seed.owner === "session"
          ? sessionId
          : seed.owner === "other"
            ? OTHER_SESSION_ID
            : null,
    },
    result: seed.result,
  }));
}

export function findDemoStudy(sessionId: string, id: string): DemoStudy | undefined {
  return buildDemoStudies(sessionId).find((item) => item.study.id === id);
}
