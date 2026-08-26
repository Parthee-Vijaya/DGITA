import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { searchCatalog } from "../features/catalog/search.ts";

const catalog = JSON.parse(
  readFileSync(new URL("../features/catalog/data/system-catalog.json", import.meta.url), "utf8"),
);

test("kataloget indeholder alle KITOS-poster og de UUID-matchede Kalundborg-systemer", () => {
  assert.equal(catalog.length, 4_656);
  assert.equal(catalog.filter((system) => system.usedInKalundborg).length, 420);
  assert.equal(new Set(catalog.map((system) => system.id)).size, catalog.length);
  assert.equal(
    catalog.every(
      (system) =>
        system.localSystemId !== "89" &&
        !(system.aliases ?? []).some((alias) => alias.trim() === "89"),
    ),
    true,
  );
});

test("lokalt kaldenavn finder det UUID-matchede Kalundborg-system", () => {
  const [result] = searchCatalog(catalog, "Serviceportalen");
  assert.equal(result.name, "TOPdesk");
  assert.equal(result.source, "both");
  assert.equal(result.usedInKalundborg, true);
});

test("et lokalt alias prioriteres over en udfaset KITOS-post", () => {
  const [result] = searchCatalog(catalog, "Navision");
  assert.equal(result.name, "Dynamics 365 Business Central");
  assert.equal(result.usedInKalundborg, true);
});
