import { NavLink } from "react-router-dom";
import { Icon } from "../ui/Icon";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <NavLink to="/" className={styles.brand} aria-label="BoneCheck AI, на главную">
        <img className={styles.mark} src="/favicon.svg" alt="" width={32} height={32} />
        <span className={styles.brandText}>
          <span className={styles.title}>BoneCheck AI</span>
          <span className={styles.product}>Качество укладки DXA</span>
        </span>
      </NavLink>

      <nav className={styles.nav} aria-label="Разделы">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
          }
        >
          <span className={styles.tabIcon} aria-hidden="true">
            <Icon name="study" size={16} />
          </span>
          Анализ
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
          }
        >
          <span className={styles.tabIcon} aria-hidden="true">
            <Icon name="history" size={16} />
          </span>
          История
        </NavLink>
      </nav>

      <p className={styles.note}>
        Проверка качества укладки. Не диагноз и не измерение минеральной плотности.
      </p>
    </header>
  );
}
