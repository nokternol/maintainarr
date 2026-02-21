import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum MetadataProviderType {
  RADARR = 'RADARR',
  SONARR = 'SONARR',
  TAUTULLI = 'TAUTULLI',
  PLEX = 'PLEX',
  JELLYFIN = 'JELLYFIN',
  OVERSEERR = 'OVERSEERR',
  SEERR = 'SEERR',
  TMDB = 'TMDB',
  OMDB = 'OMDB',
  TVMAZE = 'TVMAZE',
}

@Entity()
export class MetadataProvider extends BaseEntity {
  @Column({ type: 'varchar' })
  @Index()
  type!: MetadataProviderType;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  apiKey: string | null;

  @Column({ type: 'json', nullable: true })
  settings: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
