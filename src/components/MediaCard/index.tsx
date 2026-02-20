import { cn } from '@app/lib/utils/cn';
import type React from 'react';
import { createContext, useContext } from 'react';
import Badge from '../Badge';
import { MediaPoster } from '../MediaPoster';
import styles from './MediaCard.module.css';

interface MediaCardContextType {
  id: string;
}

const MediaCardContext = createContext<MediaCardContextType | null>(null);

export function useMediaCard() {
  const context = useContext(MediaCardContext);
  if (!context) throw new Error('useMediaCard must be used within MediaCard');
  return context;
}

export interface MediaCardRootProps {
  id: string;
  onClick?: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}

const Root = ({ id, children, onClick, className }: MediaCardRootProps) => {
  return (
    <MediaCardContext.Provider value={{ id }}>
      <div
        className={cn(styles.card, onClick && styles.interactive, className)}
        onClick={() => onClick?.(id)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick(id);
          }
        }}
        data-testid="media-card"
      >
        {children}
      </div>
    </MediaCardContext.Provider>
  );
};

const Poster = ({ src, alt, className }: { src?: string; alt: string; className?: string }) => {
  return (
    <div className={styles.posterWrapper}>
      <MediaPoster src={src} alt={alt} className={cn(styles.poster, className)} />
    </div>
  );
};

const Title = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <h3
      className={cn(styles.title, className)}
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </h3>
  );
};

const Year = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  if (!children) return null;
  return <span className={cn(styles.year, className)}>{children}</span>;
};

const StatusBadge = ({
  status,
  className,
}: { status?: 'monitored' | 'missing' | 'downloaded'; className?: string }) => {
  if (!status) return null;
  const variantMap = {
    monitored: 'primary',
    missing: 'error',
    downloaded: 'success',
  } as const;

  return (
    <div className={cn(styles.badgeWrapper, className)}>
      <Badge variant={variantMap[status]} size="sm">
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    </div>
  );
};

const Content = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn(styles.contentWrapper, className)}>{children}</div>;
};

export const MediaCard = Object.assign(Root, {
  Poster,
  Title,
  Year,
  StatusBadge,
  Content,
});

export default MediaCard;
