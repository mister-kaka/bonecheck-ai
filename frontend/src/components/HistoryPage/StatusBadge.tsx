import { Badge } from "../Badge";
import { Icon } from "../Icon";
import type { QualityClass, StudyStatus } from "../../types/study";

interface StatusBadgeProps {
  status: StudyStatus;
  qualityClass: QualityClass | null;
}

export function StatusBadge({ status, qualityClass }: StatusBadgeProps) {
  if (status === "error") {
    return (
      <Badge tone="muted">
        <Icon name="error" size={12} />
        Ошибка анализа
      </Badge>
    );
  }

  if (status === "processing") {
    return (
      <Badge tone="info">
        <Icon name="study" size={12} />
        Идёт анализ
      </Badge>
    );
  }

  if (status === "uploaded") {
    return <Badge tone="muted">Файл принят</Badge>;
  }

  if (qualityClass === 1) {
    return (
      <Badge tone="warning">
        <Icon name="alert" size={12} />
        Нарушение
      </Badge>
    );
  }

  if (qualityClass === 0) {
    return (
      <Badge tone="success">
        <Icon name="check" size={12} />
        Качественно
      </Badge>
    );
  }

  return <Badge tone="neutral">Готово</Badge>;
}
