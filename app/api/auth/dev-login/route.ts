import {
  assertSameOrigin,
  AuthHttpError,
  authErrorResponse,
  createDevSession,
  getAuthEnvironment,
  noStoreJson,
  publicActor,
} from "../../../../features/auth";
import { isWorkspaceRole } from "../../../../features/auth/primitives";

export async function POST(request: Request) {
  try {
    const environment = await getAuthEnvironment();
    assertSameOrigin(request, environment);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthHttpError(
        400,
        "INVALID_REQUEST",
        "Loginanmodningen er ikke gyldig.",
      );
    }

    const role =
      body && typeof body === "object" && "role" in body
        ? (body as { role?: unknown }).role
        : undefined;
    if (!isWorkspaceRole(role)) {
      throw new AuthHttpError(
        400,
        "INVALID_TEST_ROLE",
        "Vælg en gyldig testrolle.",
      );
    }
    const accessCode =
      body && typeof body === "object" && "accessCode" in body
        ? (body as { accessCode?: unknown }).accessCode
        : undefined;
    if (accessCode !== undefined && typeof accessCode !== "string") {
      throw new AuthHttpError(
        400,
        "INVALID_TEST_ACCESS_CODE",
        "Testadgangskoden skal være tekst.",
      );
    }

    const session = await createDevSession(
      request,
      role,
      environment,
      accessCode,
    );
    return noStoreJson(
      { authenticated: true, viewer: publicActor(session.actor) },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
