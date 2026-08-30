import { AuthHttpError } from "./http";
import {
  devLoginPolicy,
  verifyDemoAccessCode,
  type AuthEnvironment,
} from "./primitives";
import type { AuthProvider } from "./types";

export async function assertDemoLoginAccess(
  requestUrl: string | URL,
  environment: AuthEnvironment,
  accessCode: string | undefined,
  currentProvider: AuthProvider | null,
) {
  const policy = devLoginPolicy(requestUrl, environment);
  if (!policy.configurationValid) {
    throw new AuthHttpError(
      503,
      "DEV_LOGIN_CONFIGURATION_ERROR",
      "Testlogin mangler en gyldig serverkonfiguration.",
    );
  }
  if (!policy.enabled) {
    throw new AuthHttpError(
      403,
      "DEV_LOGIN_DISABLED",
      "Testlogin er ikke aktiveret i dette miljø.",
    );
  }
  if (
    policy.accessCodeRequired &&
    currentProvider !== "dev" &&
    !(await verifyDemoAccessCode(accessCode, environment))
  ) {
    throw new AuthHttpError(
      403,
      "INVALID_DEMO_ACCESS_CODE",
      "Demo-adgangskoden er ikke korrekt.",
    );
  }

  return policy;
}
