import { customType } from 'drizzle-orm/sqlite-core';

/** SQLite INTEGER (0/1) ↔ boolean */
export const bit = customType<{ data: boolean; driverData: number }>({
  dataType: () => 'integer',
  fromDriver: (value: number) => value === 1,
  toDriver: (value: boolean) => (value ? 1 : 0),
});
