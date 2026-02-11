import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './BaseEntity';

export enum UserType {
  PLEX = 'plex',
}

@Entity()
export class User extends BaseEntity {
  @Column({ unique: true })
  @Index()
  email!: string;

  @Column({ nullable: true })
  plexUsername?: string;

  @Column({ nullable: true })
  @Index()
  plexId?: number;

  @Column({ nullable: true, select: false })
  plexToken?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ type: 'text', default: UserType.PLEX })
  userType!: UserType;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
