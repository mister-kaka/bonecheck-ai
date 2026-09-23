import type { HistoryItem } from "../types/study";

export const mockHistory: HistoryItem[] = [
  {
    id: "3b2a1c90-7d4e-4f1a-9c2b-8e6d5f4a3b21",
    date: "2026-09-18T11:21:00.000Z",
    uid: "1.2.840.113619.2.110.4012.1",
    region: "Поясничный отдел позвоночника",
    status: "Success",
    quality_class: 0,
  },
  {
    id: "8f14e45f-ceea-4e7a-9b1d-2c3a4d5e6f70",
    date: "2026-09-18T12:05:00.000Z",
    uid: "1.2.840.113619.2.110.4012.2",
    region: "Проксимальный отдел бедра",
    status: "Success",
    quality_class: 1,
  },
  {
    id: "c9f0f895-fb98-4b91-8e3a-7d6c5b4a3921",
    date: "2026-09-18T13:40:00.000Z",
    uid: "1.2.840.113619.2.110.4012.3",
    region: "Поясничный отдел позвоночника",
    status: "Success",
    quality_class: 1,
  },
  {
    id: "45c48cce-2e2d-4fbd-aa1a-4c5b6d7e8f92",
    date: "2026-09-19T09:12:00.000Z",
    uid: "1.2.840.113619.2.110.4013.1",
    region: "Проксимальный отдел бедра",
    status: "Success",
    quality_class: 0,
  },
  {
    id: "d3d94468-02a4-4a5b-9c6d-7e8f9a0b1c23",
    date: "2026-09-19T10:30:00.000Z",
    uid: "1.2.840.113619.2.110.4013.2",
    region: "Поясничный отдел позвоночника",
    status: "Failure",
    quality_class: null,
  },
  {
    id: "6512bd43-d9ca-46e0-8b1f-3a2b4c5d6e74",
    date: "2026-09-20T08:55:00.000Z",
    uid: "1.2.840.113619.2.110.4014.1",
    region: "Проксимальный отдел бедра",
    status: "Success",
    quality_class: 0,
  },
];
