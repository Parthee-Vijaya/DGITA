import type { AuthEnvironment } from "./primitives";

export const EXTERNAL_AUTH_PROVIDERS = ["entra", "fk"] as const;

export type ExternalAuthProvider = (typeof EXTERNAL_AUTH_PROVIDERS)[number];

export type OidcProviderConfig = {
  id: ExternalAuthProvider;
  displayName: string;
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  acceptedIdTokenAlgorithms: readonly string[];
};

const PROVIDER_FIELDS = {
  entra: {
    displayName: "Microsoft Entra ID",
    issuer: "DGITA_ENTRA_ISSUER",
    clientId: "DGITA_ENTRA_CLIENT_ID",
    redirectUri: "DGITA_ENTRA_REDIRECT_URI",
    algorithms: ["RS256"],
  },
  fk: {
    displayName: "Fælleskommunal Adgangsstyring",
    issuer: "DGITA_FK_ISSUER",
    clientId: "DGITA_FK_CLIENT_ID",
    redirectUri: "DGITA_FK_REDIRECT_URI",
    // Context Handler udsteder aktuelt PS256-token. Hold værdien eksplicit,
    // indtil leverandørens discovery-metadata er rettet og integrationen gentestet.
    algorithms: ["PS256"],
  },
} as const;

export function readOidcProviderConfig(
  provider: ExternalAuthProvider,
  environment: AuthEnvironment,
): OidcProviderConfig | null {
  const fields = PROVIDER_FIELDS[provider];
  const issuer = environment[fields.issuer]?.trim();
  const clientId = environment[fields.clientId]?.trim();
  const redirectUri = environment[fields.redirectUri]?.trim();
  if (!issuer || !clientId || !redirectUri) return null;

  const issuerUrl = validatedUrl(issuer, false);
  const redirectUrl = validatedUrl(redirectUri, true);
  if (!issuerUrl || !redirectUrl) return null;

  return {
    id: provider,
    displayName: fields.displayName,
    issuer: issuerUrl.href.replace(/\/$/u, ""),
    clientId,
    redirectUri: redirectUrl.href,
    scopes: ["openid", "profile", "email"],
    acceptedIdTokenAlgorithms: fields.algorithms,
  };
}

export function configuredOidcProviders(environment: AuthEnvironment) {
  return EXTERNAL_AUTH_PROVIDERS.flatMap((provider) => {
    const config = readOidcProviderConfig(provider, environment);
    return config ? [config] : [];
  });
}

function validatedUrl(value: string, allowLocalHttp: boolean) {
  try {
    const url = new URL(value);
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(allowLocalHttp && isLocal)) return null;
    return url;
  } catch {
    return null;
  }
}

