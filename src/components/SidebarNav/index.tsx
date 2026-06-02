import { WardenLogo } from '@app/components/Logo';
import Sidebar from '@app/components/Sidebar';
import { resolveNavItems } from '@app/lib/navigation';
import { useRouter } from 'next/router';

interface SidebarNavProps {
  onLogout?: () => void;
}

const logo = (
  <div className="flex items-center gap-2.5">
    <WardenLogo className="w-7 h-7" />
    <span className="text-base font-semibold text-text-primary tracking-tight">Warden</span>
  </div>
);

export default function SidebarNav({ onLogout }: SidebarNavProps) {
  const { pathname } = useRouter();
  const { items, bottomItems } = resolveNavItems(pathname);

  return <Sidebar items={items} bottomItems={bottomItems} logo={logo} onLogout={onLogout} />;
}
