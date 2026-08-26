import {
  assertSameOrigin,
  authErrorResponse,
  getAuthEnvironment,
  noStoreJson,
  revokeSession,
} from "../../../../features/auth";
import { expiredSessionCookie } from "../../../../features/auth/primitives";

async function logout(request: Request) {
  let originAccepted = false;
  try {
    const environment = await getAuthEnvironment();
    assertSameOrigin(request, environment);
    originAccepted = true;
    await revokeSession(request.headers.get("cookie"));
    return noStoreJson(
      { authenticated: false },
      { headers: { "Set-Cookie": expiredSessionCookie(request.url) } },
    );
  } catch (error) {
    const response = authErrorResponse(error);
    if (originAccepted) {
      response.headers.set("Set-Cookie", expiredSessionCookie(request.url));
    }
    return response;
  }
}

export const POST = logout;
export const DELETE = logout;
