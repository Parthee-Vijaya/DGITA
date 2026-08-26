import type { Metadata } from "next";

import {
  ApprovalWorkflowError,
  getPublicApprovalRequest,
} from "../../../features/approval/server";
import { ApprovalDecisionClient } from "./ApprovalDecisionClient";

export const metadata: Metadata = {
  title: "Ledergodkendelse · D-GITA",
  description: "Sikkert beslutningsgrundlag til en D-GITA-anskaffelse.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let approval;
  let message: string | null = null;
  try {
    approval = await getPublicApprovalRequest(token);
  } catch (error) {
    message = error instanceof ApprovalWorkflowError
      ? error.message
      : "Godkendelsen kunne ikke åbnes.";
  }
  if (!approval) {
    return <main className="approval-shell"><section className="approval-card approval-error"><span className="section-label dark">D-GITA · Ledergodkendelse</span><h1>Linket kan ikke bruges</h1><p>{message}</p><small>Kontakt D-GITA, hvis du har brug for et nyt godkendelseslink.</small></section></main>;
  }
  return <ApprovalDecisionClient token={token} initialApproval={approval} />;
}
