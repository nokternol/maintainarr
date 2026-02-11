import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity()
export class Session {
  @PrimaryColumn('varchar', { length: 255 })
  id!: string;

  @Index()
  @Column('bigint')
  expiresAt!: number;

  @Column('text')
  data!: string;
}
