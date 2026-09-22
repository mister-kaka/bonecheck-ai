import { NavLink } from 'react-router-dom';
import styles from './Tabs.module.css';

export interface TabItem {
  to: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
}

export function Tabs({ items }: TabsProps) {
  return (
    <nav className={styles.tabs}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            [styles.tab, isActive ? styles.active : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}