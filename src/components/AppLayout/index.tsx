import type { HTMLAttributes } from 'react';

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
    <div className={`min-h-screen bg-slate-950 flex ${className}`} {...props}>
      {/* Sidebar */}
      {sidebar && <aside className="hidden md:block w-64 flex-shrink-0">{sidebar}</aside>}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-x-hidden">
        {topBar}
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
