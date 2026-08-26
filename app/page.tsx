import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getActorFromHeaders } from "../features/auth/server";
import { publicActor } from "../features/auth/types";
import { PortalClient } from "./PortalClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const actor = await getActorFromHeaders(await headers());
  if (!actor) redirect("/login");
  return <PortalClient initialViewer={publicActor(actor)} />;
}
