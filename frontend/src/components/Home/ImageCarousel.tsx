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
  if (total <= 1) return null; // карусель не нужна, если снимок один

  const prev = () => {
    if (activeIndex > 0) onChange(activeIndex - 1);
  };

  const next = () => {
    if (activeIndex < total - 1) onChange(activeIndex + 1);
  };

  return (
    <div className={styles.wrap}>
      <button
        className={styles.arrow}
        onClick={prev}
        disabled={activeIndex === 0}
        aria-label="Предыдущий снимок"
      >
        ‹
      </button>

      <div className={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${
              i === activeIndex ? styles.dotActive : ""
            }`}
            onClick={() => onChange(i)}
            aria-label={`Снимок ${i + 1}`}
          />
        ))}
      </div>

      <span className={styles.counter}>
        Снимок {activeIndex + 1} из {total}
      </span>

      <button
        className={styles.arrow}
        onClick={next}
        disabled={activeIndex === total - 1}
        aria-label="Следующий снимок"
      >
        ›
      </button>
    </div>
  );
}