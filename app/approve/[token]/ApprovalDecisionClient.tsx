"use client";

import {
  Check,
  CheckCircle2,
  Download,
  LockKeyhole,
  Paperclip,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import type { PublicApprovalRequest } from "../../../features/approval/server";
import { DgitaLogo } from "../../../features/brand/BrandLockup";

export function ApprovalDecisionClient({
  token,
  initialApproval,
}: {
  token: string;
  initialApproval: PublicApprovalRequest;
}) {
  const [approval, setApproval] = useState(initialApproval);
  const [comment, setComment] = useState(initialApproval.decisionComment ?? "");
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    if (submitting || approval.status !== "pending") return;
    setSubmitting(decision);
    setError(null);
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const payload = await response.json() as { approval?: PublicApprovalRequest; error?: string };
      if (!response.ok || !payload.approval) {
        throw new Error(payload.error || "Beslutningen kunne ikke gemmes.");
      }
      setApproval(payload.approval);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSubmitting(null);
    }
  }

  const open = approval.status === "pending";
  const approved = approval.status === "approved";
  return (
    <main className="approval-shell">
      <section className="approval-visual" aria-label="D-GITA">
        <DgitaLogo tone="inverse" />
        <blockquote>Én versionslåst ansøgning. Ét tydeligt beslutningsgrundlag.</blockquote>
      </section>
      <section className="approval-card">
        <header>
          <div>
            <span className="section-label dark">Ledergodkendelse · {approval.caseNumber}</span>
            <h1>{open ? `Hej ${approval.approverName}` : approved ? "Godkendelsen er registreret" : approval.status === "rejected" ? "Afvisningen er registreret" : "Godkendelsen er lukket"}</h1>
            <p>{open ? `${approval.applicantName} har bedt dig tage stilling til version ${approval.versionNumber} af ansøgningen.` : `Beslutningen er gemt med tidspunkt og auditspor på version ${approval.versionNumber}.`}</p>
          </div>
          <span className={approved ? "approval-state approved" : approval.status === "rejected" ? "approval-state rejected" : "approval-state"}>
            {approved ? <CheckCircle2 size={22} /> : approval.status === "rejected" ? <XCircle size={22} /> : <LockKeyhole size={22} />}
            {approvalStatusLabel(approval.status)}
          </span>
        </header>
        {open ? <><div className="approval-summary">
          <div><small>System</small><strong>{approval.systemName}</strong></div>
          <div><small>Afdeling</small><strong>{approval.summary.department}</strong></div>
          <div><small>Anskaffelsesform</small><strong>{approval.summary.acquisitionMethod}</strong></div>
          <div><small>Samlet økonomi</small><strong>{approval.summary.totalCost}</strong></div>
          <div><small>Personoplysninger</small><strong>{approval.summary.personalData}</strong></div>
          <div><small>Implementering</small><strong>{approval.summary.implementationPeriod}</strong></div>
        </div>
        <section className="approval-purpose">
          <ShieldCheck size={21} />
          <div><small>Formål og ønsket effekt</small><p>{approval.summary.purpose}</p></div>
        </section>

        <section className="approval-basis" aria-labelledby="approval-basis-title">
          <div>
            <span className="section-label dark">Versionslåst grundlag</span>
            <h2 id="approval-basis-title">Alle oplysninger i version {approval.versionNumber}</h2>
            <p>Indholdet nedenfor er det samme snapshot, som beslutningen og auditsporet bindes til.</p>
          </div>
          {approval.details.map((section) => (
            <details key={section.title}>
              <summary>{section.title}<span>{section.rows.length} felter</span></summary>
              <dl>{section.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
            </details>
          ))}
        </section>

        <section className="approval-attachments" aria-labelledby="approval-attachments-title">
          <div><Paperclip size={19} /><div><small>Dokumentation</small><h2 id="approval-attachments-title">Bilag til versionen</h2></div></div>
          {approval.attachments.length ? (
            <ul>{approval.attachments.map((attachment) => (
              <li key={attachment.id}>
                <div><strong>{attachment.name}</strong><small>{formatBytes(attachment.size)} · {attachmentLabel(attachment.kind)}</small></div>
                <a href={`/api/approvals/${encodeURIComponent(token)}/attachments/${encodeURIComponent(attachment.id)}`}>
                  <Download size={16} /> Hent
                </a>
              </li>
            ))}</ul>
          ) : <p>Der er ikke knyttet bilag til denne version. Den komplette PDF-kvittering følger godkendelsesmailen.</p>}
        </section>

        </> : null}
        {open ? (
          <div className="approval-decision">
            <label>
              Bemærkning til beslutningen <small>Påkrævet ved afvisning</small>
              <textarea rows={5} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} placeholder="Skriv en kort begrundelse eller eventuelle forbehold" />
            </label>
            {error ? <p className="field-error">{error}</p> : null}
            <div>
              <button className="line-button approval-reject" type="button" disabled={Boolean(submitting)} onClick={() => void decide("rejected")}><XCircle size={17} /> {submitting === "rejected" ? "Gemmer…" : "Afvis"}</button>
              <button className="solid-button green" type="button" disabled={Boolean(submitting)} onClick={() => void decide("approved")}><Check size={17} /> {submitting === "approved" ? "Gemmer…" : "Godkend version"}</button>
            </div>
            <small><LockKeyhole size={13} /> Linket kan kun bruges én gang og udløber {formatDate(approval.expiresAt)}.</small>
          </div>
        ) : (
          <div className="approval-complete"><CheckCircle2 size={25} /><div><strong>Tak. D-GITA og anmoderen er orienteret.</strong>{approval.decisionComment ? <p>Bemærkning: {approval.decisionComment}</p> : null}<small>{approval.decidedAt ? formatDate(approval.decidedAt) : "Beslutningen er registreret."}</small></div></div>
        )}
      </section>
    </main>
  );
}

function approvalStatusLabel(status: PublicApprovalRequest["status"]) {
  const labels: Record<PublicApprovalRequest["status"], string> = {
    pending: "Afventer beslutning",
    approved: "Godkendt",
    rejected: "Afvist",
    expired: "Udløbet",
    cancelled: "Annulleret",
  };
  return labels[status];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("da-DK", { dateStyle: "long", timeStyle: "short" }).format(date);
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} bytes`;
  if (value < 1_024 * 1_024) return `${Math.round(value / 1_024)} KB`;
  return `${(value / (1_024 * 1_024)).toLocaleString("da-DK", { maximumFractionDigits: 1 })} MB`;
}

function attachmentLabel(kind: string) {
  const labels: Record<string, string> = {
    "risk-assessment": "Risikovurdering",
    "data-processing-agreement": "Databehandleraftale",
    contract: "Kontrakt",
    "supplier-checklist": "Leverandørtjekliste",
    architecture: "Arkitektur",
  };
  return labels[kind] ?? "Bilag";
}
