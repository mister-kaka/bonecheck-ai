import { Badge } from "../Badge";
import type { HistoryItem } from "../../types/study";

interface StatusBadgeProps {
  status: HistoryItem["status"];
  qualityClass: HistoryItem["quality_class"];
}

export function StatusBadge({ status, qualityClass }: StatusBadgeProps) {
  if (status === "Failure") {
    return <Badge tone="danger">✕ Ошибка</Badge>;
  }

  if (qualityClass === 1) {
    return <Badge tone="warning">⚠ Нарушение</Badge>;
  }

  if (qualityClass === 0) {
    return <Badge tone="success">✓ Качественно</Badge>;
  }

  return <Badge>-</Badge>;
}