import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './Icon.module.css';

interface IconProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export default function Icon({ children, size = 'md', className = '', ...props }: IconProps) {
  return (
    <div className={cn(styles.container, styles[size], className)} {...props}>
      {children}
    </div>
  );
}
