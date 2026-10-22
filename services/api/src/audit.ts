import type { Db } from './db/pool';

export async function audit(
  db: Db, actorUserId: string | null, action: string, entityType: string, entityId: string | null,
  before: unknown, after: unknown,
) {
  await db.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, before_json, after_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorUserId, action, entityType, entityId, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after)],
  );
}
