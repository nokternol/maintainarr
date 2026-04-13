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
  mobileNav?: React.ReactNode;
}

export default function AppLayout({
  children,
  sidebar,
  topBar,
  mobileNav,
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
        <main
          ref={mainRef}
          className={cn(styles.mainContent, mobileNav && 'pb-16 md:pb-0')}
        >
          {topBar}
          <div className={styles.contentWrapper}>{children}</div>
        </main>

        {/* Mobile bottom navigation bar — fixed, hidden on md+ */}
        {mobileNav && (
          <div className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-surface-panel border-t border-border">
            {mobileNav}
          </div>
        )}
      </div>
    </ScrollContainerContext.Provider>
  );
}
