import assert from "node:assert/strict";
import test from "node:test";

import {
  caseNumberFromNotification,
  caseNumberFromPortalLink,
} from "../features/notifications/use-notifications.ts";

test("læser et internt D-GITA-sagslink og normaliserer sagsnummeret", () => {
  assert.equal(caseNumberFromPortalLink("/?case=ita-001284"), "ITA-001284");
  assert.equal(caseNumberFromPortalLink("/?case=ITA-001284#kommentarer"), "ITA-001284");
});

test("afviser eksterne, protokol-relative og ugyldige notifikationslinks", () => {
  assert.equal(caseNumberFromPortalLink("https://example.com/?case=ITA-001284"), null);
  assert.equal(caseNumberFromPortalLink("//example.com/?case=ITA-001284"), null);
  assert.equal(caseNumberFromPortalLink("/anden-side?case=ITA-001284"), null);
  assert.equal(caseNumberFromPortalLink("/?case=../../admin"), null);
});

test("bruger det autoritative sagsnummer som fallback ved ældre links", () => {
  assert.equal(
    caseNumberFromNotification({
      id: "d05c0b50-20d8-42af-a49b-58584b130814",
      eventType: "application.submitted",
      title: "Ansøgning indsendt",
      body: "Sagen er klar.",
      linkPath: null,
      caseNumber: "ita-001285",
      status: "unread",
      createdAt: "2026-08-27T08:00:00.000Z",
    }),
    "ITA-001285",
  );
});
