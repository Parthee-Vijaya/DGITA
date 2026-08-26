import {
  authErrorResponse,
  getActor,
  getAuthEnvironment,
  noStoreJson,
  publicActor,
} from "../../../../features/auth";
import {
  isDevLoginEnabled,
  parseCookie,
  SESSION_COOKIE_NAME,
  expiredSessionCookie,
} from "../../../../features/auth/primitives";
import type { SessionResponse } from "../../../../features/auth/types";

export async function GET(request: Request) {
  try {
    const environment = await getAuthEnvironment();
    const actor = await getActor(request);
    const response: SessionResponse = actor
      ? {
          authenticated: true,
          viewer: publicActor(actor),
          devLoginEnabled: isDevLoginEnabled(request.url, environment),
        }
      : {
          authenticated: false,
          devLoginEnabled: isDevLoginEnabled(request.url, environment),
        };
    const hadCookie = parseCookie(
      request.headers.get("cookie"),
      SESSION_COOKIE_NAME,
    );
    return noStoreJson(response, {
      headers:
        !actor && hadCookie
          ? { "Set-Cookie": expiredSessionCookie(request.url) }
          : undefined,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
