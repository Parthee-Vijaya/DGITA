import catalogData from "./data/system-catalog.json";
import type { CatalogSystem } from "./search";
import type { ApplicationFormState, SelectedCatalogSystem } from "../application/engine";

const systems = new Map((catalogData as CatalogSystem[]).map((system) => [system.id, system]));

export function canonicalCatalogSelection(state: ApplicationFormState): ApplicationFormState {
  if (!state.selectedSystem) return state;
  const system = systems.get(state.selectedSystem.id);
  if (!system) throw new Error("Det valgte system findes ikke i KITOS-kataloget. Søg og vælg systemet igen.");
  const { id, name, supplier, rightsHolder, source, usedInKalundborg, localSystemId, localStatus, kitosStatus } = system;
  const selectedSystem: SelectedCatalogSystem = {
    id, name, supplier, rightsHolder, source, usedInKalundborg,
    ...(localSystemId ? { localSystemId } : {}),
    ...(localStatus ? { localStatus } : {}),
    ...(kitosStatus ? { kitosStatus } : {}),
  };
  // The local-use metadata is authoritative; the applicant's separate answer
  // about the intended procurement remains an explicit, editable answer.
  return { ...state, selectedSystem, catalogQuery: name, existsInKitos: "ja" };
}
