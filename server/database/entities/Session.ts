import type { ISession } from 'connect-typeorm';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sessions' })
export class Session implements ISession {
  @PrimaryColumn('varchar', { length: 255 })
  id!: string;

  @Index()
  @Column('bigint')
  expiredAt!: number;

  @Column('text')
  json!: string;
}
