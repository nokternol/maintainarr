import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './AppLayout.module.css';

interface AppLayoutProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  topBar?: React.ReactNode;
}

export default function AppLayout({
  children,
  sidebar,
  topBar,
  className = '',
  ...props
}: AppLayoutProps) {
  return (
    <div className={cn(styles.container, className)} {...props}>
      {/* Sidebar */}
      {sidebar && <aside className={styles.sidebarWrapper}>{sidebar}</aside>}

      {/* Main Content */}
      <main className={styles.mainContent}>
        {topBar}
        <div className={styles.contentWrapper}>{children}</div>
      </main>
    </div>
  );
}
