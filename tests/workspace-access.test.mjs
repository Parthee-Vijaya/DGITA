import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CONTENT,
  DEMO_CASES,
  DEMO_VIEWERS,
  EMPTY_D_GITA_APPROVAL,
  WORKSPACE_ROLES,
  canAccessArea,
  canViewCase,
  capabilitiesFor,
  editContentEntry,
  filterCasesForViewer,
  isSafeContentUrl,
  normalizeDgitaApproval,
  projectCaseForViewer,
  resolveAccessibleCase,
} from "../features/workspace/model.ts";

test("arbejdsområdet har præcis de tre aftalte roller", () => {
  assert.deepEqual(WORKSPACE_ROLES, ["user", "consultant", "admin"]);
});

test("en bruger ser kun egne ansøgninger i egen tenant", () => {
  const visible = filterCasesForViewer(DEMO_VIEWERS.user, DEMO_CASES);
  assert.equal(visible.length, 7);
  assert.ok(visible.every((item) => item.ownerSubject === DEMO_VIEWERS.user.subject));
  assert.ok(!visible.some((item) => item.id === "ITA-001280"));
});

test("adgang afgøres af stabil subject-id og aldrig af displaynavn", () => {
  const foreignWithSameName = {
    ...DEMO_CASES[0],
    id: "ITA-FOREIGN",
    ownerSubject: "another-subject",
    applicant: DEMO_VIEWERS.user.displayName,
  };
  assert.equal(canViewCase(DEMO_VIEWERS.user, foreignWithSameName), false);
});

test("konsulent og admin ser tenantens sager, men ikke andre kommuners", () => {
  const otherTenant = { ...DEMO_CASES[0], id: "ITA-OTHER", tenantId: "slagelse" };
  const mixed = [...DEMO_CASES, otherTenant];
  assert.equal(filterCasesForViewer(DEMO_VIEWERS.consultant, mixed).length, DEMO_CASES.length);
  assert.equal(filterCasesForViewer(DEMO_VIEWERS.admin, mixed).length, DEMO_CASES.length);
});

test("direkte opslag på en fremmed sag returnerer null og aldrig en fallback", () => {
  assert.equal(resolveAccessibleCase(DEMO_VIEWERS.user, "ITA-001280", DEMO_CASES), null);
  assert.equal(resolveAccessibleCase(DEMO_VIEWERS.user, "ITA-FINDES-IKKE", DEMO_CASES), null);
});

test("rolle-capabilities og views følger den aftalte matrix", () => {
  assert.deepEqual(capabilitiesFor("user"), {
    createApplications: true,
    processApplications: false,
    commentOnFields: false,
    manageContent: false,
  });
  assert.equal(canAccessArea("user", "admin"), false);
  assert.equal(canAccessArea("consultant", "admin"), false);
  assert.equal(canAccessArea("consultant", "consultant"), true);
  assert.equal(canAccessArea("admin", "application"), true);
  assert.ok(Object.values(capabilitiesFor("admin")).every(Boolean));
});

test("brugerprojektionen indeholder aldrig D-GITA-godkendelsen", () => {
  const userProjection = projectCaseForViewer(
    DEMO_VIEWERS.user,
    DEMO_CASES[0],
    { ...EMPTY_D_GITA_APPROVAL, internalComments: "Kun internt" },
  );
  const consultantProjection = projectCaseForViewer(
    DEMO_VIEWERS.consultant,
    DEMO_CASES[0],
    { ...EMPTY_D_GITA_APPROVAL, internalComments: "Kun internt" },
  );
  assert.ok(userProjection);
  assert.equal("dgitaApproval" in userProjection, false);
  assert.equal(consultantProjection?.dgitaApproval.internalComments, "Kun internt");
});

test("ekstra D-GITA-ansvarlig fjernes, når betingelsen ikke er aktiv", () => {
  const normalized = normalizeDgitaApproval({
    ...EMPTY_D_GITA_APPROVAL,
    hasAdditionalResponsible: "Nej",
    additionalResponsible: "Må ikke gemmes",
  });
  assert.equal(normalized.additionalResponsible, "");
});

test("indholdsregisteret rummer kildens vejledninger, FAQ, links og krav", () => {
  const categories = new Set(DEFAULT_CONTENT.map((entry) => entry.category));
  assert.deepEqual([...categories].sort(), ["data_processor", "faq", "form_help", "link", "portal_text"]);
  assert.ok(DEFAULT_CONTENT.filter((entry) => entry.category === "form_help").length >= 10);
  assert.ok(DEFAULT_CONTENT.filter((entry) => entry.category === "faq").length >= 8);
  assert.ok(DEFAULT_CONTENT.some((entry) => entry.id === "guide.esdh"));
  assert.ok(DEFAULT_CONTENT.some((entry) => entry.id === "link.kai"));
});

test("admin kan redigere tekst uden at ændre stabile nøgler", () => {
  const original = DEFAULT_CONTENT.find((entry) => entry.id === "home.hero.title");
  assert.ok(original);
  const edited = editContentEntry(
    DEMO_VIEWERS.admin,
    DEFAULT_CONTENT,
    { ...original, id: original.id, category: "faq", location: "Manipuleret", body: "Ny tekst" },
    "2026-08-26T12:00:00.000Z",
  ).find((entry) => entry.id === original.id);
  assert.equal(edited?.body, "Ny tekst");
  assert.equal(edited?.category, original.category);
  assert.equal(edited?.location, original.location);
  assert.equal(edited?.updatedBy, DEMO_VIEWERS.admin.displayName);
});

test("bruger og konsulent kan ikke ændre adminindhold", () => {
  const entry = DEFAULT_CONTENT[0];
  assert.throws(() => editContentEntry(DEMO_VIEWERS.user, DEFAULT_CONTENT, entry));
  assert.throws(() => editContentEntry(DEMO_VIEWERS.consultant, DEFAULT_CONTENT, entry));
});

test("adminlinks afviser eksekverbare og protokol-relative URL'er", () => {
  assert.equal(isSafeContentUrl("https://www.datatilsynet.dk/"), true);
  assert.equal(isSafeContentUrl("mailto:dgita@example.dk"), true);
  assert.equal(isSafeContentUrl("/intern-side"), true);
  assert.equal(isSafeContentUrl("javascript:alert(1)"), false);
  assert.equal(isSafeContentUrl("data:text/html,test"), false);
  assert.equal(isSafeContentUrl("//evil.example"), false);
});

