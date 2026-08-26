import {
  getGraphMailEnvironment,
  readGraphMailConfig,
} from "./config";
import { MicrosoftGraphMailTransport } from "./graph-transport";
import type {
  GraphMailDependencies,
  GraphMailEnvironment,
} from "./types";

export { getGraphMailEnvironment, readGraphMailConfig } from "./config";
export {
  GraphMailConfigurationError,
  GraphMailError,
  GraphMailValidationError,
  isGraphMailError,
} from "./errors";
export {
  graphPayload,
  MicrosoftGraphMailTransport,
} from "./graph-transport";
export type {
  AcceptedMail,
  FetchLike,
  GraphMailConfig,
  GraphMailDependencies,
  GraphMailEnvironment,
  MailAttachment,
  MailContentType,
  MailRecipient,
  MailTransport,
  OutgoingMail,
} from "./types";

export function createGraphMailTransport(
  environment: GraphMailEnvironment,
  dependencies: GraphMailDependencies = {},
) {
  return new MicrosoftGraphMailTransport(
    readGraphMailConfig(environment),
    dependencies,
  );
}

export async function createRuntimeGraphMailTransport(
  dependencies: GraphMailDependencies = {},
) {
  return createGraphMailTransport(
    await getGraphMailEnvironment(),
    dependencies,
  );
}

