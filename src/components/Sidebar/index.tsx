import { cn } from '@app/lib/utils/cn';
import type { SidebarItem as SidebarItemType } from '@app/types/navigation';
import type { HTMLAttributes } from 'react';
import styles from './Sidebar.module.css';
import SidebarItem from './SidebarItem';

interface SidebarProps extends HTMLAttributes<HTMLDivElement> {
  items: SidebarItemType[];
  bottomItems?: SidebarItemType[];
  logo?: React.ReactNode;
  collapsed?: boolean;
  onItemClick?: (item: SidebarItemType) => void;
}

export default function Sidebar({
  items,
  bottomItems,
  logo,
  collapsed = false,
  onItemClick,
  className = '',
  ...props
}: SidebarProps) {
  if (collapsed) {
    return null;
  }

  return (
    <div className={cn(styles.sidebar, className)} {...props}>
      {/* Logo/Header */}
      {logo && <div className={styles.logoWrapper}>{logo}</div>}

      {/* Main Navigation */}
      <nav className={styles.navMain}>
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} onClick={onItemClick} />
        ))}
      </nav>

      {/* Bottom Section */}
      {bottomItems && bottomItems.length > 0 && (
        <>
          <div className={styles.divider} />
          <nav className={styles.navBottom}>
            {bottomItems.map((item) => (
              <SidebarItem key={item.id} item={item} onClick={onItemClick} />
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
