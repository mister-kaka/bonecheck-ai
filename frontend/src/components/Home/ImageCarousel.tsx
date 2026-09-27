import { Icon } from "../Icon";
import styles from "../../styles/ImageCarousel.module.css";

interface ImageCarouselProps {
  total: number;
  activeIndex: number;
  onChange: (index: number) => void;
}

export function ImageCarousel({
  total,
  activeIndex,
  onChange,
}: ImageCarouselProps) {
  if (total <= 1) return null;

  const prev = () => {
    if (activeIndex > 0) onChange(activeIndex - 1);
  };

  const next = () => {
    if (activeIndex < total - 1) onChange(activeIndex + 1);
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.arrow}
        onClick={prev}
        disabled={activeIndex === 0}
        aria-label="Предыдущий снимок"
      >
        <Icon name="chevron-left" size={16} />
      </button>

      <div className={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.dot} ${i === activeIndex ? styles.dotActive : ""}`}
            onClick={() => onChange(i)}
            aria-label={`Снимок ${i + 1}`}
            aria-current={i === activeIndex ? "true" : undefined}
          />
        ))}
      </div>

      <span className={styles.counter}>
        Снимок {activeIndex + 1} из {total}
      </span>

      <button
        type="button"
        className={styles.arrow}
        onClick={next}
        disabled={activeIndex === total - 1}
        aria-label="Следующий снимок"
      >
        <Icon name="chevron-right" size={16} />
      </button>
    </div>
  );
}
