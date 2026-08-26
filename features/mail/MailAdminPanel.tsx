"use client";

import { Check, Clock3, Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MailMessage = {
  id: string;
  caseNumber: string | null;
  recipientEmail: string;
  recipientName: string | null;
  templateKey: string;
  subject: string;
  status: "queued" | "processing" | "sent" | "failed" | "cancelled";
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};

type Dashboard = {
  configured: boolean;
  sender: string | null;
  counts: Partial<Record<MailMessage["status"], number>>;
  messages: MailMessage[];
};

export function MailAdminPanel({ onToast }: { onToast: (message: string) => void }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mail/status", { cache: "no-store" });
      const payload = await response.json() as Dashboard & { error?: string };
      if (!response.ok || !Array.isArray(payload.messages)) {
        throw new Error(payload.error || "Mailkøen kunne ikke hentes.");
      }
      setDashboard(payload);
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  async function processQueue() {
    if (processing) return;
    setProcessing(true);
    try {
      const response = await fetch("/api/mail/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const payload = await response.json() as { processed?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Mailkøen kunne ikke behandles.");
      onToast(`${payload.processed ?? 0} mail(s) blev behandlet.`);
      await refresh();
    } catch (reason) {
      onToast((reason as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  const queued = dashboard?.counts.queued ?? 0;
  return <div className="admin-layout"><section className="plain-section"><div className="plain-heading"><span className="section-label dark">Microsoft Outlook</span><h2>Mail og kvitteringer</h2><span className={dashboard?.configured ? "integration-badge connected" : "integration-badge"}>{dashboard?.configured ? "Graph forbundet" : "Afventer Graph"}</span></div><p className="section-lead">Indsendelseskvitteringer og statusmails gemmes først i en idempotent serverkø. PDF-kvitteringen genereres fra den låste ansøgningsversion og vedhæftes ved afsendelse.</p><div className="mail-queue-toolbar"><div><strong>{queued}</strong><small>venter i kø</small></div><div><strong>{dashboard?.counts.sent ?? 0}</strong><small>sendt</small></div><div><strong>{dashboard?.counts.failed ?? 0}</strong><small>fejlet</small></div><button className="solid-button" type="button" disabled={!dashboard?.configured || queued === 0 || processing} onClick={() => void processQueue()}><Send size={16} /> {processing ? "Behandler…" : "Behandl kø"}</button><button className="line-button" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={16} /> Opdatér</button></div>{error ? <p className="field-error">{error}</p> : null}{loading ? <p className="section-lead">Henter mailkø…</p> : null}{!loading && dashboard?.messages.length === 0 ? <div className="empty-comments"><Mail size={24} /><strong>Mailkøen er tom</strong><p>Nye indsendelser og statusmails vises her.</p></div> : <div className="mail-outbox-list">{dashboard?.messages.map((message) => <article key={message.id}><span>{mailStatusIcon(message.status)}</span><div><strong>{message.subject}</strong><small>{message.caseNumber ?? "Ingen sag"} · {message.recipientName || message.recipientEmail}</small></div><div><b>{mailStatusLabel(message.status)}</b><small>{formatDate(message.sentAt || message.createdAt)}</small></div></article>)}</div>}</section><aside className="security-panel"><ShieldCheck size={27} /><span className="section-label">Server-side afsendelse</span><h2>{dashboard?.configured ? "Outlook er klar" : "Graph mangler konfiguration"}</h2><p>{dashboard?.configured ? `Mails sendes som ${dashboard.sender}. Hemmeligheder bliver på serveren.` : "Tilføj Entra tenant, app-id, serverhemmelighed og den godkendte afsenderpostkasse som miljøhemmeligheder."}</p><ul><li><Check size={15} /> Ingen hemmeligheder i browseren</li><li><Check size={15} /> Idempotens og fem kontrollerede forsøg</li><li><Check size={15} /> Status og auditspor i databasen</li></ul></aside></div>;
}

function mailStatusIcon(status: MailMessage["status"]) {
  return status === "sent" ? <Check size={16} /> : status === "failed" ? <Mail size={16} /> : <Clock3 size={16} />;
}

function mailStatusLabel(status: MailMessage["status"]) {
  const labels: Record<MailMessage["status"], string> = {
    queued: "I kø",
    processing: "Behandles",
    sent: "Sendt",
    failed: "Fejlet",
    cancelled: "Annulleret",
  };
  return labels[status];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
