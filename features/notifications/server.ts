import type { ServerActor } from "../auth/types";
import { preparePortalData, resolveActorUserId } from "../workspace/server-repository";
import { isSafeNotificationId } from "./id";

type NotificationRow = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  link_path: string | null;
  status: "unread" | "read" | "dismissed";
  created_at: string;
  case_number: string | null;
};

export class NotificationError extends Error {
  constructor(
    readonly status: 400 | 404 | 422,
    message: string,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

export async function listNotifications(actor: ServerActor) {
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const [rows, unread] = await Promise.all([
    DB.prepare(`
      SELECT n.id, n.event_type, n.title, n.body, n.link_path, n.status,
             n.created_at, a.case_number
      FROM portal_notifications n
      LEFT JOIN portal_applications a
        ON a.id = n.application_id AND a.tenant_id = n.tenant_id
      WHERE n.tenant_id = ? AND n.recipient_user_id = ?
        AND n.status <> 'dismissed'
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 30
    `).bind(actor.tenantId, userId).all<NotificationRow>(),
    DB.prepare(`
      SELECT COUNT(*) AS count
      FROM portal_notifications
      WHERE tenant_id = ? AND recipient_user_id = ? AND status = 'unread'
    `).bind(actor.tenantId, userId).first<{ count: number }>(),
  ]);

  return {
    unreadCount: Number(unread?.count ?? 0),
    notifications: rows.results.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      title: row.title,
      body: row.body,
      linkPath: row.link_path,
      caseNumber: row.case_number,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}

export async function markNotificationsRead(
  actor: ServerActor,
  input: unknown,
) {
  const DB = await preparePortalData();
  const userId = await resolveActorUserId(DB, actor);
  const now = new Date().toISOString();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new NotificationError(400, "Anmodningen er ugyldig.");
  }
  const request = input as { id?: unknown; all?: unknown };
  if (request.all === true) {
    await DB.prepare(`
      UPDATE portal_notifications
      SET status = 'read', read_at = ?
      WHERE tenant_id = ? AND recipient_user_id = ? AND status = 'unread'
    `).bind(now, actor.tenantId, userId).run();
    return listNotifications(actor);
  }
  if (!isSafeNotificationId(request.id)) {
    throw new NotificationError(422, "Vælg en gyldig notifikation.");
  }
  const notificationId = request.id;
  const result = await DB.prepare(`
    UPDATE portal_notifications
    SET status = 'read', read_at = ?
    WHERE id = ? AND tenant_id = ? AND recipient_user_id = ? AND status = 'unread'
  `).bind(now, notificationId, actor.tenantId, userId).run();
  if (Number(result.meta.changes ?? 0) === 0) {
    const existing = await DB.prepare(`
      SELECT id FROM portal_notifications
      WHERE id = ? AND tenant_id = ? AND recipient_user_id = ? LIMIT 1
    `).bind(notificationId, actor.tenantId, userId).first<{ id: string }>();
    if (!existing) throw new NotificationError(404, "Notifikationen findes ikke.");
  }
  return listNotifications(actor);
}
