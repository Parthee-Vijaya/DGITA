import { authErrorResponse, noStoreJson } from "../../../features/auth/http";
import { requireActor } from "../../../features/auth/server";
import {
  PortalAccessError,
  listCasesForActor,
} from "../../../features/workspace/server-repository";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const cases = await listCasesForActor(actor);
    return noStoreJson({ cases });
  } catch (error) {
    if (error instanceof PortalAccessError) {
      return noStoreJson({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
