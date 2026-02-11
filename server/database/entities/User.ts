import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum UserType {
  PLEX = 'plex',
}

@Entity()
export class User extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  @Index()
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  plexUsername: string | null;

  @Column({ type: 'integer', nullable: true })
  @Index()
  plexId: number | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  plexToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column({ type: 'text', default: UserType.PLEX })
  userType!: UserType;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
