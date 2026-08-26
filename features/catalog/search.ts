export type CatalogSystem = {
  id: string;
  name: string;
  supplier: string;
  rightsHolder: string;
  kitosId?: string;
  localSystemId?: string;
  localStatus?: string;
  kitosStatus?: string;
  source: "kitos" | "kalundborg" | "both";
  usedInKalundborg: boolean;
  matchConfidence: "exact-id" | "exact-name" | "alias" | "unmatched";
  aliases?: string[];
};

export type RankedCatalogSystem = CatalogSystem & { score: number };

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("da-DK")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankField(field: string, query: string) {
  if (!field || !query) return 0;
  if (field === query) return 100;
  if (field.startsWith(query)) return 82;
  if (field.includes(query)) return 68;

  const queryTokens = query.split(" ").filter(Boolean);
  const fieldTokens = new Set(field.split(" ").filter(Boolean));
  if (queryTokens.length > 0 && queryTokens.every((token) => fieldTokens.has(token))) return 60;
  if (queryTokens.length > 1 && queryTokens.every((token) => field.includes(token))) return 52;
  return 0;
}

export function searchCatalog(
  catalog: CatalogSystem[],
  rawQuery: string,
  limit = 8,
): RankedCatalogSystem[] {
  const query = normalizeSearchText(rawQuery);
  if (query.length < 2) return [];

  return catalog
    .map((system) => {
      const nameScore = rankField(normalizeSearchText(system.name), query);
      const supplierScore = rankField(normalizeSearchText(system.supplier), query) * 0.55;
      const rightsHolderScore = rankField(normalizeSearchText(system.rightsHolder), query) * 0.45;
      const aliasScore = Math.max(
        0,
        ...(system.aliases ?? []).map(
          (alias) => rankField(normalizeSearchText(alias), query) * 0.85,
        ),
      );
      const score = Math.max(nameScore, supplierScore, rightsHolderScore, aliasScore);
      return {
        ...system,
        // Kommunens egne systemer skal være nemme at genkende, også når
        // medarbejderen søger på et lokalt kaldenavn eller et tidligere navn.
        score: score > 0 && system.usedInKalundborg ? score + 25 : score,
      };
    })
    .filter((system) => system.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.usedInKalundborg) - Number(a.usedInKalundborg) ||
        a.name.localeCompare(b.name, "da"),
    )
    .slice(0, limit);
}
