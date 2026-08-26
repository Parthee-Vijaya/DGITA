import assert from "node:assert/strict";
import test from "node:test";

import {
  damerauLevenshtein,
  normalizeDanishSearchText,
  searchKnowledge,
} from "../features/workspace/knowledge-search.ts";

const documents = [
  {
    id: "guide.risk",
    title: "Hvad er en risikovurdering?",
    body: "Vurder sandsynlighed, konsekvens og sikkerhedsforanstaltninger.",
    location: "Vejledning · Risiko",
  },
  {
    id: "guide.dpa",
    title: "Hvad er en databehandleraftale (DBA)?",
    body: "Aftalen beskriver behandling af personoplysninger på kommunens vegne.",
    location: "Vejledning · Persondata",
  },
  {
    id: "guide.esdh",
    title: "ESDH",
    body: "Sådan journaliseres kontrakt, bilag og risikovurdering.",
    location: "Vejledning · ESDH",
  },
  {
    id: "faq.esdh",
    title: "Hvor skal kontrakten journaliseres?",
    body: "Kontrakten og bilagene journaliseres i ESDH.",
    location: "FAQ",
  },
  {
    id: "guide.budget",
    title: "Budget og finansiering",
    body: "Angiv engangsudgift og årlig drift.",
    location: "Vejledning · Økonomi",
  },
];

test("normaliserer dansk case, diakritik og tegnsætning", () => {
  assert.equal(
    normalizeDanishSearchText("  Ændring, ØKONOMI & Årlig drift!  "),
    "aendring okonomi arlig drift",
  );
  assert.equal(normalizeDanishSearchText("Risikóvurdering"), "risikovurdering");
});

test("beregner redigeringsafstand inklusiv ombytning", () => {
  assert.equal(damerauLevenshtein("esdh", "esdh"), 0);
  assert.equal(damerauLevenshtein("risiko", "risiok"), 1);
});

test("finder risikovurdering ved den realistiske stavefejl risikovudering", () => {
  const results = searchKnowledge(documents, "risikovudering");
  assert.equal(results[0]?.item.id, "guide.risk");
  assert.equal(results[0]?.matchKind, "fuzzy");
});

test("finder databehandleraftale ved den realistiske stavefejl databehndleraftale", () => {
  const results = searchKnowledge(documents, "databehndleraftale");
  assert.equal(results[0]?.item.id, "guide.dpa");
  assert.equal(results[0]?.matchKind, "fuzzy");
});

test("rangerer et eksakt ESDH-opslag foran omtale i brødtekst", () => {
  const results = searchKnowledge(documents, "ESDH");
  assert.equal(results[0]?.item.id, "guide.esdh");
  assert.equal(results[0]?.score, 1);
  assert.equal(results[0]?.matchKind, "exact");
  assert.ok(results.some((result) => result.item.id === "faq.esdh"));
});

test("rangerer exact før prefix og prefix før substring", () => {
  const rankingFixture = [
    { id: "substring", title: "IT-risiko" },
    { id: "prefix", title: "Risikostyring" },
    { id: "exact", title: "Risiko" },
  ];

  assert.deepEqual(
    searchKnowledge(rankingFixture, "risiko").map((result) => result.item.id),
    ["exact", "prefix", "substring"],
  );
});

test("udelader irrelevante resultater ved standard-threshold", () => {
  assert.deepEqual(searchKnowledge(documents, "bananplantage"), []);
  assert.deepEqual(searchKnowledge(documents, "togafgang roskilde"), []);
});

test("bruger AND-semantik for flere søgeord", () => {
  const results = searchKnowledge(documents, "kontrakt ESDH");
  assert.deepEqual(results.map((result) => result.item.id), ["guide.esdh", "faq.esdh"]);
});

test("bevarer inputrækkefølgen ved identiske scorer", () => {
  const ties = [
    { id: "first", title: "Kontraktvejledning" },
    { id: "second", title: "Kontraktvejledning" },
    { id: "third", title: "Kontraktvejledning" },
  ];

  assert.deepEqual(
    searchKnowledge(ties, "kontrakt").map((result) => result.item.id),
    ["first", "second", "third"],
  );
});

test("tom søgning returnerer original rækkefølge og respekterer limit", () => {
  const results = searchKnowledge(documents, "   ", { limit: 2 });
  assert.deepEqual(results.map((result) => result.item.id), ["guide.risk", "guide.dpa"]);
  assert.ok(results.every((result) => result.matchKind === "all"));
});
