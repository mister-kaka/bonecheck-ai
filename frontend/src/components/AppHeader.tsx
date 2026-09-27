import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";
import styles from "../styles/AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Icon name="mark" size={18} />
        </span>
        <div>
          <span className={styles.title}>BoneCheck AI</span>
          <span className={styles.product}>Качество укладки DXA</span>
        </div>
      </div>

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
        Поддержка оценки укладки. Не диагноз и не измерение минеральной плотности.
      </p>
    </header>
  );
}
