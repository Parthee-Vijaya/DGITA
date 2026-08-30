import { AuthHttpError } from "./http";
import {
  devLoginPolicy,
  verifyTestAccessCode,
  type AuthEnvironment,
} from "./primitives";
import type { AuthProvider } from "./types";

export async function assertTestLoginAccess(
  requestUrl: string | URL,
  environment: AuthEnvironment,
  accessCode: string | undefined,
  currentProvider: AuthProvider | null,
) {
  const policy = devLoginPolicy(requestUrl, environment);
  if (!policy.configurationValid) {
    throw new AuthHttpError(
      503,
      "TEST_LOGIN_CONFIGURATION_ERROR",
      "Testlogin mangler en gyldig serverkonfiguration.",
    );
  }
  if (!policy.enabled) {
    throw new AuthHttpError(
      403,
      "TEST_LOGIN_DISABLED",
      "Testlogin er ikke aktiveret i dette miljø.",
    );
  }
  if (
    policy.accessCodeRequired &&
    currentProvider !== "dev" &&
    !(await verifyTestAccessCode(accessCode, environment))
  ) {
    throw new AuthHttpError(
      403,
      "INVALID_TEST_ACCESS_CODE",
      "Testadgangskoden er ikke korrekt.",
    );
  }

  return policy;
}
