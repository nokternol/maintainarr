import type { HTMLAttributes } from 'react';

interface IconProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export default function Icon({ children, size = 'md', className = '', ...props }: IconProps) {
  const sizeStyles = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  return (
    <div
      className={`inline-flex items-center justify-center ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
