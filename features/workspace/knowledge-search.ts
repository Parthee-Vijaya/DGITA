export type KnowledgeMatchKind =
  | "all"
  | "exact"
  | "prefix"
  | "substring"
  | "fuzzy";

export type KnowledgeSearchDocument = {
  id: string;
  title: string;
  body?: string;
  location?: string;
  keywords?: readonly string[];
};

export type KnowledgeSearchResult<T extends KnowledgeSearchDocument> = {
  item: T;
  score: number;
  matchKind: KnowledgeMatchKind;
};

export type KnowledgeSearchOptions = {
  /** Lowest accepted score on a 0–1 scale. */
  threshold?: number;
  /** Optional upper bound after relevance sorting. */
  limit?: number;
};

type RankedMatch = {
  score: number;
  kind: Exclude<KnowledgeMatchKind, "all">;
};

type SearchField = {
  value: string;
  weight: number;
};

const DEFAULT_THRESHOLD = 0.54;

const KIND_PRIORITY: Record<Exclude<KnowledgeMatchKind, "all">, number> = {
  exact: 4,
  prefix: 3,
  substring: 2,
  fuzzy: 1,
};

/**
 * Produces the same searchable representation for Danish user input and
 * indexed content. In particular, æ/ø/å remain searchable as ae/o/a.
 */
export function normalizeDanishSearchText(value: string): string {
  return value
    .toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Damerau-Levenshtein distance with adjacent transpositions. */
export function damerauLevenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const rows = left.length + 1;
  const columns = right.length + 1;
  const matrix = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0),
  );

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost =
        left[row - 1] === right[column - 1] ? 0 : 1;

      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );

      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        matrix[row][column] = Math.min(
          matrix[row][column],
          matrix[row - 2][column - 2] + substitutionCost,
        );
      }
    }
  }

  return matrix[left.length][right.length];
}

function allowedDistance(tokenLength: number): number {
  if (tokenLength <= 3) return 0;
  if (tokenLength <= 5) return 1;
  if (tokenLength <= 9) return 2;
  return 3;
}

function strongerMatch(current: RankedMatch | null, next: RankedMatch) {
  if (!current || next.score > current.score) return next;
  if (
    next.score === current.score &&
    KIND_PRIORITY[next.kind] > KIND_PRIORITY[current.kind]
  ) {
    return next;
  }
  return current;
}

function rankToken(queryToken: string, candidateToken: string): RankedMatch | null {
  if (candidateToken === queryToken) {
    return { score: 0.94, kind: "exact" };
  }

  if (candidateToken.startsWith(queryToken)) {
    const lengthPenalty = Math.min(
      0.08,
      (candidateToken.length - queryToken.length) * 0.006,
    );
    return { score: 0.87 - lengthPenalty, kind: "prefix" };
  }

  if (queryToken.length >= 3 && candidateToken.includes(queryToken)) {
    return { score: 0.77, kind: "substring" };
  }

  const maximumDistance = allowedDistance(queryToken.length);
  if (maximumDistance === 0) return null;

  // Very different token lengths cannot be a useful typo correction.
  if (Math.abs(queryToken.length - candidateToken.length) > maximumDistance) {
    return null;
  }

  const distance = damerauLevenshtein(queryToken, candidateToken);
  if (distance > maximumDistance) return null;

  const similarity =
    1 - distance / Math.max(queryToken.length, candidateToken.length);
  if (similarity < 0.72) return null;

  return { score: 0.58 + similarity * 0.2, kind: "fuzzy" };
}

function rankField(query: string, field: SearchField): RankedMatch | null {
  const normalized = normalizeDanishSearchText(field.value);
  if (!normalized) return null;

  if (normalized === query) {
    return { score: 1 * field.weight, kind: "exact" };
  }

  if (normalized.startsWith(query)) {
    return { score: 0.97 * field.weight, kind: "prefix" };
  }

  if (query.length >= 3 && normalized.includes(query)) {
    return { score: 0.9 * field.weight, kind: "substring" };
  }

  const queryTokens = query.split(" ");
  const candidateTokens = normalized.split(" ");
  let weakestScore = 1;
  let totalScore = 0;
  let weakestKind: RankedMatch["kind"] = "exact";

  for (const queryToken of queryTokens) {
    let bestForToken: RankedMatch | null = null;

    for (const candidateToken of candidateTokens) {
      const tokenMatch = rankToken(queryToken, candidateToken);
      if (tokenMatch) bestForToken = strongerMatch(bestForToken, tokenMatch);
    }

    // Multi-word searches use AND semantics. A document must explain every
    // search term instead of matching one common word by accident.
    if (!bestForToken) return null;

    const weightedScore = bestForToken.score * field.weight;
    weakestScore = Math.min(weakestScore, weightedScore);
    totalScore += weightedScore;
    if (KIND_PRIORITY[bestForToken.kind] < KIND_PRIORITY[weakestKind]) {
      weakestKind = bestForToken.kind;
    }
  }

  // Giving the weakest term meaningful influence prevents one exact term from
  // hiding a poor second match.
  return {
    score: weakestScore * 0.65 + (totalScore / queryTokens.length) * 0.35,
    kind: weakestKind,
  };
}

function rankDocument(
  document: KnowledgeSearchDocument,
  query: string,
): RankedMatch | null {
  const fields: SearchField[] = [
    { value: document.title, weight: 1 },
    ...(document.keywords ?? []).map((value) => ({ value, weight: 0.98 })),
    ...(document.location ? [{ value: document.location, weight: 0.88 }] : []),
    ...(document.body ? [{ value: document.body, weight: 0.82 }] : []),
  ];

  let best: RankedMatch | null = null;
  for (const field of fields) {
    const fieldMatch = rankField(query, field);
    if (fieldMatch) best = strongerMatch(best, fieldMatch);
  }

  const queryTokens = query.split(" ");
  if (queryTokens.length > 1) {
    let weakestScore = 1;
    let totalScore = 0;
    let weakestKind: RankedMatch["kind"] = "exact";
    let allTokensMatch = true;

    for (const queryToken of queryTokens) {
      let bestForToken: RankedMatch | null = null;
      for (const field of fields) {
        const tokenMatch = rankField(queryToken, field);
        if (tokenMatch) bestForToken = strongerMatch(bestForToken, tokenMatch);
      }

      if (!bestForToken) {
        allTokensMatch = false;
        break;
      }

      weakestScore = Math.min(weakestScore, bestForToken.score);
      totalScore += bestForToken.score;
      if (KIND_PRIORITY[bestForToken.kind] < KIND_PRIORITY[weakestKind]) {
        weakestKind = bestForToken.kind;
      }
    }

    if (allTokensMatch) {
      best = strongerMatch(best, {
        score:
          weakestScore * 0.65 +
          (totalScore / queryTokens.length) * 0.35,
        kind: weakestKind,
      });
    }
  }

  return best;
}

/**
 * Searches FAQ and guidance documents, sorted by relevance. Equal scores keep
 * their original source order, which makes the result deterministic.
 */
export function searchKnowledge<T extends KnowledgeSearchDocument>(
  documents: readonly T[],
  rawQuery: string,
  options: KnowledgeSearchOptions = {},
): KnowledgeSearchResult<T>[] {
  const query = normalizeDanishSearchText(rawQuery);
  const limit = options.limit ?? Number.POSITIVE_INFINITY;

  if (!query) {
    return documents.slice(0, limit).map((item) => ({
      item,
      score: 0,
      matchKind: "all",
    }));
  }

  const threshold = options.threshold ?? DEFAULT_THRESHOLD;

  return documents
    .map((item, index) => ({ item, index, match: rankDocument(item, query) }))
    .filter(
      (candidate): candidate is {
        item: T;
        index: number;
        match: RankedMatch;
      } => Boolean(candidate.match && candidate.match.score >= threshold),
    )
    .sort((left, right) => {
      const scoreDifference = right.match.score - left.match.score;
      if (scoreDifference !== 0) return scoreDifference;

      const kindDifference =
        KIND_PRIORITY[right.match.kind] - KIND_PRIORITY[left.match.kind];
      if (kindDifference !== 0) return kindDifference;

      return left.index - right.index;
    })
    .slice(0, limit)
    .map(({ item, match }) => ({
      item,
      score: Number(match.score.toFixed(6)),
      matchKind: match.kind,
    }));
}
