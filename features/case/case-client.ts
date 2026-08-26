export type CaseCommentVisibility = "applicant" | "internal";

export type CaseComment = {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  visibility: CaseCommentVisibility;
};

export type CaseActivityEvent = {
  id: string;
  eventType: string;
  summary: string;
  actorName: string;
  createdAt: string;
};

export type SubmitCaseCommentInput = {
  body: string;
  visibility?: CaseCommentVisibility;
};

type CaseCommentsResponse = {
  comments: CaseComment[];
};

type CaseActivityResponse = {
  events: CaseActivityEvent[];
};

export class CaseFeedApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CaseFeedApiError";
    this.status = status;
  }
}

export async function getCaseComments(
  caseId: string,
  signal?: AbortSignal,
): Promise<CaseComment[]> {
  const response = await fetch(caseEndpoint(caseId, "comments"), {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw await responseError(response, "Kommentarerne kunne ikke hentes.");
  }

  return parseCommentsResponse(await response.json()).comments;
}

export async function submitCaseComment(
  caseId: string,
  input: SubmitCaseCommentInput,
  signal?: AbortSignal,
): Promise<CaseComment[]> {
  const body = input.body.trim();
  if (!body) {
    throw new CaseFeedApiError("Kommentaren må ikke være tom.", 400);
  }

  const response = await fetch(caseEndpoint(caseId, "comments"), {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body,
      visibility: input.visibility ?? "applicant",
    }),
    signal,
  });

  if (!response.ok) {
    throw await responseError(response, "Kommentaren kunne ikke gemmes.");
  }

  return parseCommentsResponse(await response.json()).comments;
}

export async function getCaseActivity(
  caseId: string,
  signal?: AbortSignal,
): Promise<CaseActivityEvent[]> {
  const response = await fetch(caseEndpoint(caseId, "activity"), {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw await responseError(response, "Aktiviteten kunne ikke hentes.");
  }

  return parseActivityResponse(await response.json()).events;
}

function caseEndpoint(caseId: string, resource: "comments" | "activity") {
  return `/api/cases/${encodeURIComponent(caseId)}/${resource}`;
}

function parseCommentsResponse(value: unknown): CaseCommentsResponse {
  if (!isRecord(value) || !Array.isArray(value.comments)) {
    throw invalidResponseError();
  }

  const comments = value.comments.map((comment) => {
    if (
      !isRecord(comment) ||
      !isString(comment.id) ||
      !isString(comment.body) ||
      !isString(comment.authorName) ||
      !isString(comment.createdAt) ||
      (comment.visibility !== "applicant" && comment.visibility !== "internal")
    ) {
      throw invalidResponseError();
    }

    const visibility: CaseCommentVisibility = comment.visibility;
    return {
      id: comment.id,
      body: comment.body,
      authorName: comment.authorName,
      createdAt: comment.createdAt,
      visibility,
    };
  });

  return { comments };
}

function parseActivityResponse(value: unknown): CaseActivityResponse {
  if (!isRecord(value) || !Array.isArray(value.events)) {
    throw invalidResponseError();
  }

  const events = value.events.map((event) => {
    if (
      !isRecord(event) ||
      !isString(event.id) ||
      !isString(event.eventType) ||
      !isString(event.summary) ||
      !isString(event.actorName) ||
      !isString(event.createdAt)
    ) {
      throw invalidResponseError();
    }

    return {
      id: event.id,
      eventType: event.eventType,
      summary: event.summary,
      actorName: event.actorName,
      createdAt: event.createdAt,
    };
  });

  return { events };
}

async function responseError(response: Response, fallback: string) {
  let message = fallback;
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isString(payload.error)) {
      message = payload.error;
    }
  } catch {
    // API-fejl uden JSON bruger den sikre standardbesked.
  }
  return new CaseFeedApiError(message, response.status);
}

function invalidResponseError() {
  return new CaseFeedApiError("Serveren returnerede et ugyldigt svar.", 502);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
