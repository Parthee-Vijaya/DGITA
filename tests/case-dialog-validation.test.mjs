import assert from "node:assert/strict";
import test from "node:test";

import {
  CaseDialogError,
  MAX_CASE_COMMENT_LENGTH,
  normalizeCaseNumber,
  normalizeCommentInput,
} from "../features/cases/dialog-validation.ts";

const userActor = {
  userId: "user-1",
  subject: "subject-1",
  tenantId: "tenant-1",
  role: "user",
  displayName: "Test Bruger",
  email: "test@example.test",
  initials: "TB",
  municipality: "Test Kommune",
  provider: "dev",
};

test("brugerkommentarer gemmes som delte kommentarer", () => {
  assert.deepEqual(
    normalizeCommentInput(userActor, {
      body: "  Kan I uddybe status?  ",
      visibility: "applicant",
      category: "question",
    }),
    {
      body: "Kan I uddybe status?",
      visibility: "shared",
      category: "question",
    },
  );
});

test("en almindelig bruger kan ikke oprette interne kommentarer", () => {
  assert.throws(
    () => normalizeCommentInput(userActor, { body: "Privat", visibility: "internal" }),
    (error) => error instanceof CaseDialogError && error.status === 403,
  );
});

test("for lange kommentarer afvises", () => {
  assert.throws(
    () => normalizeCommentInput(userActor, { body: "x".repeat(MAX_CASE_COMMENT_LENGTH + 1) }),
    (error) => error instanceof CaseDialogError && error.status === 413,
  );
});

test("sagsnummer normaliseres uden at acceptere stier", () => {
  assert.equal(normalizeCaseNumber(" ita-001284 "), "ITA-001284");
  assert.throws(
    () => normalizeCaseNumber("../ITA-001284"),
    (error) => error instanceof CaseDialogError && error.status === 400,
  );
});
