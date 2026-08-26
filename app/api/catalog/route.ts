import catalogData from "../../../features/catalog/data/system-catalog.json";
import { searchCatalog, type CatalogSystem } from "../../../features/catalog/search";

const catalog = catalogData as CatalogSystem[];

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 120) ?? "";
  const results = searchCatalog(catalog, query, 8);

  return Response.json(
    {
      results,
      total: catalog.length,
      usedInKalundborg: catalog.filter((system) => system.usedInKalundborg).length,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
