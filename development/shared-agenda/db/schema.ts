import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const sharedProfiles=sqliteTable('shared_profiles',{
 ownerId:text('owner_id').primaryKey(),revision:integer('revision').notNull(),
 payload:text('payload').notNull(),previousPayload:text('previous_payload'),updatedAt:text('updated_at').notNull()
});
