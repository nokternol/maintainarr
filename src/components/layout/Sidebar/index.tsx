import type { SidebarItem as SidebarItemType } from '@app/types/navigation';
import type { HTMLAttributes } from 'react';
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
    <div
      className={`flex flex-col h-full bg-slate-900 border-r border-slate-700 ${className}`}
      {...props}
    >
      {/* Logo/Header */}
      {logo && <div className="p-4 border-b border-slate-700">{logo}</div>}

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} onClick={onItemClick} />
        ))}
      </nav>

      {/* Bottom Section */}
      {bottomItems && bottomItems.length > 0 && (
        <>
          <div className="border-t border-slate-700" />
          <nav className="p-3 space-y-1">
            {bottomItems.map((item) => (
              <SidebarItem key={item.id} item={item} onClick={onItemClick} />
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
