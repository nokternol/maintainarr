import { cn } from '@app/lib/utils/cn';
import { createContext, useRef, type HTMLAttributes } from 'react';
import styles from './AppLayout.module.css';

export const ScrollContainerContext = createContext<React.RefObject<HTMLElement | null>>({
  current: null,
});

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
  const mainRef = useRef<HTMLElement>(null);

  return (
    <ScrollContainerContext.Provider value={mainRef}>
      <div className={cn(styles.container, className)} {...props}>
        {/* Sidebar */}
        {sidebar && <aside className={styles.sidebarWrapper}>{sidebar}</aside>}

        {/* Main Content */}
        <main ref={mainRef} className={styles.mainContent}>
          {topBar}
          <div className={styles.contentWrapper}>{children}</div>
        </main>
      </div>
    </ScrollContainerContext.Provider>
  );
}
