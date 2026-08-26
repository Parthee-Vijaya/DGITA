import { ensurePortalSchema, getPersistenceBindings } from "../../db/persistence";
import {
  initialApplicationState,
  type ApplicationFormState,
} from "../application/engine";
import type { ServerActor } from "../auth/types";
import { CaseDialogError, normalizeCaseNumber } from "./dialog-validation";
import {
  CaseDetailError,
  normalizeApplicationSnapshotJson,
  ownerScopeUserId,
  withSafeDraftAttachments,
  type CaseDetailResponse,
  type SafeDraftAttachment,
} from "./detail-helpers";

export {
  CaseDetailError,
  type CaseDetailResponse,
  type CaseDetailSummary,
} from "./detail-helpers";

type CaseDetailRow = {
  id: string;
  case_number: string;
  title: string;
  system_name: string | null;
  status: string;
  phase: string;
  current_version_id: string | null;
  current_version_number: number;
  draft_state_json: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  applicant_name: string;
  applicant_email: string;
  consultant_name: string | null;
  version_id: string | null;
  version_number: number | null;
  version_snapshot_json: string | null;
  version_submitted_at: string | null;
};

export async function getCaseDetail(
  actor: ServerActor,
  caseNumberValue: string,
): Promise<CaseDetailResponse> {
  const caseNumber = requestedCaseNumber(caseNumberValue);
  await ensurePortalSchema();
  const { DB } = await getPersistenceBindings();
  const ownerUserId = ownerScopeUserId(actor.role, actor.userId);
  const ownerClause = ownerUserId ? "AND application.owner_user_id = ?" : "";
  const statement = DB.prepare(`
    SELECT
      application.id,
      application.case_number,
      application.title,
      application.system_name,
      application.status,
      application.phase,
      application.current_version_id,
      application.current_version_number,
      application.draft_state_json,
      application.created_at,
      application.updated_at,
      application.submitted_at,
      owner.display_name AS applicant_name,
      owner.email AS applicant_email,
      consultant.display_name AS consultant_name,
      version.id AS version_id,
      version.version_number,
      version.snapshot_json AS version_snapshot_json,
      version.submitted_at AS version_submitted_at
    FROM portal_applications application
    INNER JOIN portal_users owner
      ON owner.id = application.owner_user_id
      AND owner.tenant_id = application.tenant_id
    LEFT JOIN portal_users consultant
      ON consultant.id = application.assigned_consultant_user_id
      AND consultant.tenant_id = application.tenant_id
    LEFT JOIN portal_application_versions version
      ON version.id = application.current_version_id
      AND version.application_id = application.id
      AND version.tenant_id = application.tenant_id
    WHERE application.tenant_id = ?
      AND application.case_number = ?
      ${ownerClause}
    LIMIT 1
  `);
  const row = ownerUserId
    ? await statement.bind(actor.tenantId, caseNumber, ownerUserId).first<CaseDetailRow>()
    : await statement.bind(actor.tenantId, caseNumber).first<CaseDetailRow>();

  if (!row) {
    throw new CaseDetailError(
      404,
      "CASE_NOT_FOUND",
      "Sagen findes ikke, eller du har ikke adgang.",
    );
  }

  const usesSubmittedVersion = row.current_version_id !== null;
  if (
    usesSubmittedVersion &&
    (!row.version_id || row.version_snapshot_json === null || row.version_number === null)
  ) {
    throw new CaseDetailError(
      409,
      "CASE_VERSION_MISSING",
      "Sagens aktuelle version kunne ikke findes.",
    );
  }

  let snapshot = normalizeApplicationSnapshotJson(
    usesSubmittedVersion ? row.version_snapshot_json! : row.draft_state_json,
    initialApplicationState,
    row.system_name,
  );
  if (!usesSubmittedVersion) {
    snapshot = await hydrateDraftAttachments(DB, actor.tenantId, row.id, snapshot);
  }

  return {
    case: {
      id: row.id,
      caseNumber: row.case_number,
      title: row.title,
      systemName: row.system_name,
      status: row.status,
      phase: row.phase,
      versionNumber: usesSubmittedVersion
        ? row.version_number!
        : row.current_version_number,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: usesSubmittedVersion
        ? row.version_submitted_at ?? row.submitted_at
        : row.submitted_at,
      applicantName: row.applicant_name,
      applicantEmail: row.applicant_email,
      consultantName: row.consultant_name,
    },
    snapshot,
  };
}

async function hydrateDraftAttachments(
  DB: D1Database,
  tenantId: string,
  applicationId: string,
  snapshot: ApplicationFormState,
) {
  const result = await DB.prepare(`
    SELECT id, kind, original_name, size_bytes, content_type
    FROM portal_attachments
    WHERE tenant_id = ? AND application_id = ?
      AND application_version_id IS NULL AND status = 'ready'
    ORDER BY created_at, id
  `)
    .bind(tenantId, applicationId)
    .all<SafeDraftAttachment>();
  return withSafeDraftAttachments(snapshot, result.results);
}

function requestedCaseNumber(value: string) {
  try {
    return normalizeCaseNumber(value);
  } catch (error) {
    if (error instanceof CaseDialogError) {
      throw new CaseDetailError(400, error.code, error.message);
    }
    throw error;
  }
}
