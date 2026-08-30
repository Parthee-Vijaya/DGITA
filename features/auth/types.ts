import type { WorkspaceRole } from "../workspace/model";

export const AUTH_PROVIDERS = ["dev", "entra", "fk"] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export type Actor = {
  subject: string;
  tenantId: string;
  role: WorkspaceRole;
  displayName: string;
  email: string;
  initials: string;
  municipality: string;
  provider: AuthProvider;
};

export type ServerActor = Actor & {
  /** Intern database-id. Må bruges i serverforespørgsler, men ikke som bruger-id i UI'et. */
  userId: string;
};

export function publicActor(actor: ServerActor): Actor {
  return {
    subject: actor.subject,
    tenantId: actor.tenantId,
    role: actor.role,
    displayName: actor.displayName,
    email: actor.email,
    initials: actor.initials,
    municipality: actor.municipality,
    provider: actor.provider,
  };
}

export type SessionResponse =
  | {
      authenticated: true;
      viewer: Actor;
      devLoginEnabled: boolean;
      devLoginAccessCodeRequired: boolean;
    }
  | {
      authenticated: false;
      devLoginEnabled: boolean;
      devLoginAccessCodeRequired: boolean;
    };
