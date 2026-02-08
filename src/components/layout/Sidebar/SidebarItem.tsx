import Badge from '@app/components/ui/Badge';
import type { SidebarItem as SidebarItemType } from '@app/types/navigation';

interface SidebarItemProps {
  item: SidebarItemType;
  onClick?: (item: SidebarItemType) => void;
}

export default function SidebarItem({ item, onClick }: SidebarItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(item);
    }
  };

  const baseStyles =
    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium';
  const activeStyles = item.active
    ? 'bg-teal-500 text-white'
    : 'text-slate-300 hover:bg-slate-800 hover:text-white';

  return (
    <a href={item.href} onClick={handleClick} className={`${baseStyles} ${activeStyles}`}>
      <div className="flex-shrink-0 w-5 h-5">{item.icon}</div>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <Badge size="sm" variant={item.active ? 'default' : 'teal'}>
          {item.badge}
        </Badge>
      )}
    </a>
  );
}
