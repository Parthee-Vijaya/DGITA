export const MAX_CASE_COMMENT_LENGTH = 8_000;

export type CaseCommentVisibility = "shared" | "internal";
export type CaseCommentApiVisibility = "applicant" | "internal";
export type CaseCommentCategory = "comment" | "question" | "decision" | "note";

export type CreateCaseCommentInput = {
  body: string;
  visibility?: CaseCommentApiVisibility;
  category?: CaseCommentCategory;
};

export type CaseCommentActor = {
  role: "user" | "consultant" | "admin";
};

export class CaseDialogError extends Error {
  readonly status: 400 | 403 | 404 | 413 | 422;
  readonly code: string;

  constructor(
    status: 400 | 403 | 404 | 413 | 422,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "CaseDialogError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeCaseNumber(value: string) {
  const caseNumber = value.trim().toUpperCase();
  if (
    caseNumber.length < 3 ||
    caseNumber.length > 64 ||
    !/^[A-Z0-9][A-Z0-9._-]*$/.test(caseNumber)
  ) {
    throw new CaseDialogError(400, "INVALID_CASE_NUMBER", "Sagsnummeret er ugyldigt.");
  }
  return caseNumber;
}

export function normalizeCommentInput(actor: CaseCommentActor, value: unknown) {
  if (!value || typeof value !== "object") {
    throw new CaseDialogError(400, "INVALID_COMMENT", "Kommentaren er ugyldig.");
  }
  const input = value as Record<string, unknown>;
  if (typeof input.body !== "string") {
    throw new CaseDialogError(422, "COMMENT_BODY_REQUIRED", "Skriv en kommentar.");
  }
  const body = input.body.trim();
  if (!body) {
    throw new CaseDialogError(422, "COMMENT_BODY_REQUIRED", "Skriv en kommentar.");
  }
  if (body.length > MAX_CASE_COMMENT_LENGTH) {
    throw new CaseDialogError(
      413,
      "COMMENT_TOO_LONG",
      `Kommentaren må højst være ${MAX_CASE_COMMENT_LENGTH.toLocaleString("da-DK")} tegn.`,
    );
  }

  const requestedVisibility = input.visibility ?? "applicant";
  if (
    requestedVisibility !== "applicant" &&
    requestedVisibility !== "shared" &&
    requestedVisibility !== "internal"
  ) {
    throw new CaseDialogError(422, "INVALID_VISIBILITY", "Kommentartypen er ugyldig.");
  }
  const visibility: CaseCommentVisibility =
    requestedVisibility === "internal" ? "internal" : "shared";
  if (actor.role === "user" && visibility === "internal") {
    throw new CaseDialogError(
      403,
      "INTERNAL_COMMENT_FORBIDDEN",
      "Du har ikke adgang til interne kommentarer.",
    );
  }

  const category = input.category ?? (visibility === "internal" ? "note" : "comment");
  if (!isCommentCategory(category)) {
    throw new CaseDialogError(422, "INVALID_CATEGORY", "Kommentarkategorien er ugyldig.");
  }
  if (actor.role === "user" && (category === "decision" || category === "note")) {
    throw new CaseDialogError(
      403,
      "COMMENT_CATEGORY_FORBIDDEN",
      "Du har ikke adgang til den valgte kommentarkategori.",
    );
  }

  return { body, visibility, category };
}

function isCommentCategory(value: unknown): value is CaseCommentCategory {
  return value === "comment" || value === "question" || value === "decision" || value === "note";
}
