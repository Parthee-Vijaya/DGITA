"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  History,
  Inbox,
  Info,
  LayoutGrid,
  Link2,
  LockKeyhole,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ApplicationFormView } from "../features/application/ApplicationFormView";
import {
  COMMENTABLE_APPLICATION_FIELDS,
  CONTENT_CATEGORY_LABELS,
  DEMO_CASES,
  DEMO_VIEWERS,
  D_GITA_LEGAL_BASES,
  D_GITA_PHASES,
  EMPTY_D_GITA_APPROVAL,
  WORKSPACE_ROLES,
  canAccessArea,
  capabilitiesFor,
  contentBody,
  defaultAreaForRole,
  filterCasesForViewer,
  isSafeContentUrl,
  resolveAccessibleCase,
  type Approval,
  type CaseRecord,
  type ContentCategory,
  type ContentEntry,
  type DgitaApproval,
  type FieldComment,
  type Phase,
  type WorkspaceArea,
  type WorkspaceRole,
  type WorkspaceViewer,
} from "../features/workspace/model";
import { useDemoWorkspace } from "../features/workspace/use-demo-workspace";

type View = WorkspaceArea;

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  user: "Bruger",
  consultant: "D-GITA konsulent",
  admin: "Admin",
};

const applicationSteps = [
  "Generelle oplysninger",
  "Systemoplysninger",
  "Anskaffelsesform",
  "Værdi for kommunen",
  "Investering",
  "Risiko & data",
  "Implementering",
  "IT-krav",
  "Øvrige",
  "Gennemse",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function HomePage() {
  const [role, setRole] = useState<WorkspaceRole>("user");
  const [view, setView] = useState<View>("home");
  const [selectedId, setSelectedId] = useState<string | null>("ITA-001284");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const workspace = useDemoWorkspace();

  const viewer = DEMO_VIEWERS[role];
  const visibleCases = useMemo(
    () => filterCasesForViewer(viewer, DEMO_CASES),
    [viewer],
  );
  const selectedCase = selectedId
    ? resolveAccessibleCase(viewer, selectedId, DEMO_CASES)
    : null;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3600);
  }

  function navigate(next: View) {
    if (!canAccessArea(role, next)) {
      showToast("Din aktuelle rolle har ikke adgang til dette område.");
      return;
    }
    setView(next);
    setMobileMenu(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCase(id: string) {
    if (!resolveAccessibleCase(viewer, id, DEMO_CASES)) {
      showToast("Sagen findes ikke, eller du har ikke adgang til den.");
      return;
    }
    setSelectedId(id);
    navigate("detail");
  }

  function changeRole(nextRole: WorkspaceRole) {
    const nextViewer = DEMO_VIEWERS[nextRole];
    const nextCanOpenSelected = selectedId
      ? resolveAccessibleCase(nextViewer, selectedId, DEMO_CASES)
      : null;
    setRole(nextRole);
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMobileMenu(false);
    if (!canAccessArea(nextRole, view) || (view === "detail" && !nextCanOpenSelected)) {
      setView(defaultAreaForRole(nextRole));
    }
    if (!nextCanOpenSelected) setSelectedId(null);
    showToast(`Testrolle skiftet til ${ROLE_LABELS[nextRole]}.`);
  }

  return (
    <div className="site-shell">
      <Header
        view={view}
        mobileMenu={mobileMenu}
        profileOpen={profileOpen}
        notificationsOpen={notificationsOpen}
        role={role}
        viewer={viewer}
        onNavigate={navigate}
        onRoleChange={changeRole}
        onMobileMenu={() => setMobileMenu(!mobileMenu)}
        onProfile={() => {
          setProfileOpen(!profileOpen);
          setNotificationsOpen(false);
        }}
        onNotifications={() => {
          setNotificationsOpen(!notificationsOpen);
          setProfileOpen(false);
        }}
      />

      <main id="main-content">
        {view === "home" ? (
          <HomeView role={role} content={workspace.content} onNavigate={navigate} onToast={showToast} />
        ) : null}
        {view === "cases" ? (
          <CasesView personal={role === "user"} rows={visibleCases} onNew={() => navigate("application")} onOpen={openCase} />
        ) : null}
        {view === "consultant" ? (
          <ConsultantView rows={visibleCases} onOpen={openCase} />
        ) : null}
        {view === "application" ? (
          <ApplicationFormView
            onBack={() => navigate("cases")}
            guidance={{
              intro: contentBody(workspace.content, "form.intro", "Spørgsmålene følger D-GITA-processen og tilpasses dine svar undervejs."),
              catalog: contentBody(workspace.content, "form.catalog", "Resultatet viser samtidig, om systemet bruges i Kalundborg."),
              marketResearch: contentBody(workspace.content, "form.market-research", "Har du undersøgt, hvilke løsninger der bedst matcher behov, pris og kvalitet?"),
            }}
            onSubmit={() => {
              showToast("Ansøgningen er versionslåst og indsendt. Outlook-integration afventer forbindelse.");
              navigate("cases");
            }}
            onToast={showToast}
          />
        ) : null}
        {view === "detail" && selectedCase ? (
          <CaseDetail
            key={selectedCase.id}
            item={selectedCase}
            viewer={viewer}
            approval={workspace.approvals[selectedCase.id] ?? EMPTY_D_GITA_APPROVAL}
            fieldComments={workspace.fieldComments.filter((comment) => comment.caseId === selectedCase.id)}
            onBack={() => navigate(role === "user" ? "cases" : "consultant")}
            onSaveApproval={(approval) => {
              workspace.updateApproval(selectedCase.id, approval, viewer);
              showToast("D-GITA-godkendelsen er gemt lokalt i testmiljøet.");
            }}
            onAddFieldComment={(fieldId, fieldLabel, body) => {
              const comment: FieldComment = {
                id: crypto.randomUUID(),
                caseId: selectedCase.id,
                fieldId,
                fieldLabel,
                body,
                authorSubject: viewer.subject,
                authorName: viewer.displayName,
                createdAt: new Date().toISOString(),
                visibility: "applicant",
              };
              workspace.addFieldComment(comment, viewer);
              showToast("Feltkommentaren er gemt og synlig for anmoderen.");
            }}
            onToast={showToast}
          />
        ) : null}
        {view === "detail" && !selectedCase ? (
          <AccessDenied onBack={() => navigate(defaultAreaForRole(role))} />
        ) : null}
        {view === "knowledge" ? <KnowledgeView content={workspace.content} /> : null}
        {view === "admin" ? (
          <AdminView
            content={workspace.content}
            viewer={viewer}
            onUpdateContent={(entry) => workspace.updateContent(entry, viewer)}
            onAddContent={(entry) => workspace.addContent(entry, viewer)}
            onRemoveContent={(id) => workspace.removeContent(id, viewer)}
            onResetContent={() => workspace.resetContent(viewer)}
            onToast={showToast}
          />
        ) : null}
      </main>

      {toast ? (
        <div className="site-toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button type="button" aria-label="Luk besked" onClick={() => setToast(null)}>
            <X size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Header({
  view,
  role,
  viewer,
  mobileMenu,
  profileOpen,
  notificationsOpen,
  onNavigate,
  onRoleChange,
  onMobileMenu,
  onProfile,
  onNotifications,
}: {
  view: View;
  role: WorkspaceRole;
  viewer: WorkspaceViewer;
  mobileMenu: boolean;
  profileOpen: boolean;
  notificationsOpen: boolean;
  onNavigate: (view: View) => void;
  onRoleChange: (role: WorkspaceRole) => void;
  onMobileMenu: () => void;
  onProfile: () => void;
  onNotifications: () => void;
}) {
  const allNavigation: Array<{ label: string; view: View }> = [
    { label: "Startside", view: "home" },
    { label: role === "admin" ? "Ansøgninger" : "Mine ansøgninger", view: "cases" },
    { label: "D-GITA Konsulent", view: "consultant" },
    { label: "Vejledning & FAQ", view: "knowledge" },
    { label: "Admin", view: "admin" },
  ];
  const navigation = allNavigation.filter((item) => canAccessArea(role, item.view));

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">Gå til hovedindhold</a>
      <div className="header-inner">
        <button className="wordmark" type="button" onClick={() => onNavigate("home")}>
          <span className="wordmark-symbol">D</span>
          <span>
            <strong>D-GITA</strong>
            <small>Den Gode IT-Anskaffelse</small>
          </span>
        </button>

        <nav className={cx("site-nav", mobileMenu && "open")} aria-label="Primær navigation">
          {navigation.map((item) => (
            <button
              className={cx(view === item.view && "active")}
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <label className="role-switcher">
            <span>Testrolle</span>
            <select
              aria-label="Skift testrolle"
              value={role}
              onChange={(event) => onRoleChange(event.target.value as WorkspaceRole)}
            >
              {WORKSPACE_ROLES.map((value) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="header-popover-anchor">
            <button className="header-icon-button" type="button" aria-label="Notifikationer" onClick={onNotifications}>
              <Bell size={20} />
              <span>3</span>
            </button>
            {notificationsOpen ? <NotificationPanel /> : null}
          </div>
          <div className="header-popover-anchor profile-anchor">
            <button className="account-button" type="button" onClick={onProfile}>
              <span className="account-avatar">{viewer.initials}</span>
              <span className="account-copy"><strong>{viewer.displayName}</strong><small>{viewer.municipality}</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen ? (
              <div className="header-popover profile-menu">
                <div className="profile-menu-head"><span>{viewer.initials}</span><div><strong>{viewer.displayName}</strong><small>{ROLE_LABELS[role]} · testtilstand</small></div></div>
                <button type="button"><UserRound size={17} /> Min profil</button>
                {capabilitiesFor(role).createApplications ? <button type="button"><ReceiptText size={17} /> Mine kvitteringer</button> : null}
                <button type="button"><Settings2 size={17} /> Indstillinger</button>
              </div>
            ) : null}
          </div>
          <button className="mobile-menu-button" type="button" aria-label="Vis navigation" onClick={onMobileMenu}>
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function NotificationPanel() {
  return (
    <div className="header-popover notification-panel">
      <div className="popover-title"><strong>Notifikationer</strong><span>3 nye</span></div>
      <Notice icon={FileCheck2} title="WSUS klient er under behandling" meta="ITA-001284 · i dag kl. 10.57" />
      <Notice icon={UserCheck} title="Leder har godkendt ansøgningen" meta="Peter Bjerre Ahlgren · i dag" />
      <Notice icon={Mail} title="Kvittering sendt til Outlook" meta="ITA-001285 · i dag kl. 09.45" />
    </div>
  );
}

function Notice({ icon: Icon, title, meta }: { icon: LucideIcon; title: string; meta: string }) {
  return <div className="notice"><span><Icon size={18} /></span><div><strong>{title}</strong><small>{meta}</small></div></div>;
}

function HomeView({
  role,
  content,
  onNavigate,
  onToast,
}: {
  role: WorkspaceRole;
  content: ContentEntry[];
  onNavigate: (view: View) => void;
  onToast: (message: string) => void;
}) {
  const canCreate = capabilitiesFor(role).createApplications;
  return (
    <div className="home-page">
      <section className="editorial-hero">
        <div className="hero-photo">
          <Image src="/dgita-hero.png" alt="Kommunale medarbejdere samarbejder om en IT-anskaffelse" fill priority unoptimized sizes="(max-width: 900px) 100vw, 56vw" />
        </div>
        <div className="hero-content">
          <span className="section-label">Kalundborg Kommune · D-GITA</span>
          <h1>{contentBody(content, "home.hero.title", "En god IT-anskaffelse starter med det rigtige behov.")}</h1>
          <p>{contentBody(content, "home.hero.body", "Opret en ansøgning, eller se dine igangværende og historiske ansøgninger.")}</p>
          <p className="hero-note"><Info size={17} /> Portalen bruges til køb under udbudsgrænsen.</p>
          <div className="hero-actions">
            {canCreate ? <button className="solid-button" type="button" onClick={() => onNavigate("application")}>Opret ansøgning <ArrowRight size={18} /></button> : null}
            <button className={canCreate ? "line-button light" : "solid-button"} type="button" onClick={() => onNavigate(role === "user" ? "cases" : "consultant")}>
              {role === "user" ? "Se mine ansøgninger" : "Åbn D-GITA-arbejdskøen"}
            </button>
          </div>
        </div>
      </section>

      <section className="home-intro page-width">
        <div className="intro-heading">
          <span className="section-label dark">Fra idé til sikker anskaffelse</span>
          <h2>Portalen samler hele forløbet.</h2>
        </div>
        <p>Du beskriver behovet én gang. Derefter hjælper D-GITA-konsulenten med marked, arkitektur, sikkerhed, økonomi, dokumentation og ledergodkendelse.</p>
      </section>

      <section className="process-section page-width" aria-label="D-GITA-processen">
        <ProcessStep number="01" title="Beskriv behovet" text="Svar på de relevante spørgsmål om systemet, arbejdsprocesserne og værdien for kommunen." />
        <ProcessStep number="02" title="Få faglig sparring" text="Din lokale D-GITA-konsulent gennemgår anskaffelsesform, risiko, data og IT-krav." />
        <ProcessStep number="03" title="Indhent godkendelse" text="Lederen modtager et samlet, versionslåst beslutningsgrundlag og godkender digitalt." />
        <ProcessStep number="04" title="Gem dokumentationen" text="Kvitteringer, bilag, kommentarer og statusændringer bliver samlet på sagen." />
      </section>

      <section className="help-editorial page-width">
        <div className="help-photo">
          <Image src="/dgita-help.png" alt="En D-GITA-konsulent hjælper en kollega" fill unoptimized sizes="(max-width: 800px) 100vw, 48vw" />
        </div>
        <div className="help-copy">
          <span className="section-label dark">Har du brug for hjælp?</span>
          <h2>Få afklaring, før du udfylder ansøgningen.</h2>
          <p>{contentBody(content, "home.help.body", "Er du i tvivl om din IT-anskaffelse, hjælper din lokale konsulent dig i gang.")}</p>
          <div className="contact-person">
            <span>CK</span>
            <div><small>Din lokale D-GITA-konsulent</small><strong>Casper Kjeldsen Ravn</strong><a href="mailto:ckra@kalundborg.dk">ckra@kalundborg.dk</a></div>
          </div>
          <button className="solid-button dark" type="button" onClick={() => onToast("Anmodning om formøde er oprettet")}>Book et formøde <ArrowRight size={18} /></button>
        </div>
      </section>

      <section className="resources-section page-width">
        <div className="resources-heading"><span className="section-label dark">Viden og vejledning</span><h2>Genveje til et bedre forløb</h2></div>
        <div className="resource-list">
          <ResourceLink title="Om D-GITA" text="Læs om portalen og processen." onClick={() => onNavigate("knowledge")} />
          <ResourceLink title="Vejledning / FAQ" text="Begreber, funktioner og svar undervejs." onClick={() => onNavigate("knowledge")} />
          <ResourceLink title="Nyttige links" text="KITOS, databehandleraftaler og lokale skabeloner." onClick={() => onNavigate("knowledge")} />
          <ResourceLink title="Info fra din kommune" text="Særlige krav og information fra Kalundborg." onClick={() => onNavigate("knowledge")} />
          <ResourceLink title="Ny funktionalitet" text="Se de seneste ændringer i portalen." onClick={() => onNavigate("knowledge")} />
        </div>
        <div className="operation-strip"><span className="operation-dot" /><strong>Normal drift</strong><span>Alle centrale tjenester fungerer</span><button type="button">Se driftstatus <ExternalLink size={15} /></button></div>
      </section>
    </div>
  );
}

function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="process-step"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}

function ResourceLink({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return <button className="resource-link" type="button" onClick={onClick}><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={19} /></button>;
}

function CasesView({ personal, rows: availableRows, onNew, onOpen }: { personal: boolean; rows: CaseRecord[]; onNew: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("Alle faser");
  const rows = useMemo(() => availableRows.filter((item) => {
    const q = query.toLowerCase();
    return (!q || `${item.id} ${item.system}`.toLowerCase().includes(q)) && (phase === "Alle faser" || item.phase === phase);
  }), [availableRows, query, phase]);
  const featured = availableRows.find((item) => item.id === "ITA-001284") ?? availableRows[0];

  return (
    <div className="portal-page page-width">
      <PageIntro eyebrow={personal ? "Din sagsoversigt" : "Administrativ sagsoversigt"} title={personal ? "Mine ansøgninger" : "Alle ansøgninger"} text={personal ? "Følg dine igangværende og historiske IT-anskaffelser, kommentarer, ledergodkendelser og filer." : "Se alle ansøgninger i kommunen med ejer, status, godkendelse og ansvarlig konsulent."}>
        <button className="solid-button" type="button" onClick={onNew}><Plus size={18} /> Opret ansøgning</button>
      </PageIntro>

      {featured ? <section className="featured-case">
        <div className="featured-case-copy">
          <span className="section-label dark">Senest ændret · {featured.id}</span>
          <h2>{featured.system}</h2>
          <p>Sagen er {featured.phase.toLowerCase()}{featured.consultant !== "Ikke tildelt" ? ` hos ${featured.consultant}` : " og afventer tildeling"}.</p>
          <div className="featured-meta"><PhaseTag phase={featured.phase} /><ApprovalTag approval={featured.approval} /><span>Ændret {featured.changed}</span></div>
        </div>
        <div className="featured-progress" aria-label="Sagsforløb">
          <span className="done"><Check size={16} /></span><i /><span className="done"><Check size={16} /></span><i /><span className="current">3</span><i /><span>4</span>
        </div>
        <button className="line-button" type="button" onClick={() => onOpen(featured.id)}>Åbn sag <ArrowRight size={17} /></button>
      </section> : null}

      <section className="records-section">
        <div className="records-toolbar">
          <label className="clean-search"><Search size={18} /><input aria-label="Søg i ansøgninger" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg på sagsnummer eller system" /></label>
          <label className="clean-select"><Filter size={17} /><select value={phase} onChange={(event) => setPhase(event.target.value)} aria-label="Filtrér på fase"><option>Alle faser</option><option>Kladde</option><option>Indsendt</option><option>Under behandling</option><option>Afsluttet</option></select><ChevronDown size={16} /></label>
        </div>
        <RecordsTable rows={rows} onOpen={onOpen} applicantMode />
      </section>
    </div>
  );
}

function ConsultantView({ rows: availableRows, onOpen }: { rows: CaseRecord[]; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("Alle faser");
  const rows = useMemo(() => availableRows.filter((item) => {
    const q = query.toLowerCase();
    return (!q || `${item.id} ${item.system} ${item.applicant}`.toLowerCase().includes(q)) && (phase === "Alle faser" || item.phase === phase);
  }), [availableRows, query, phase]);

  return (
    <div className="portal-page page-width">
      <PageIntro eyebrow="D-GITA Konsulent" title="Alle sager" text="Visiter, prioritér og følg ansøgninger på tværs af fase, godkendelsesstatus, kommune og ansvarlig konsulent.">
        <div className="queue-count"><span>7</span><div><small>Kræver handling</small><strong>I din arbejdskø</strong></div></div>
      </PageIntro>

      <section className="consultant-summary" aria-label="Sagsstatus">
        <SummaryStat value="2" label="Indsendt" detail="afventer visitering" />
        <SummaryStat value="1" label="Under behandling" detail="WSUS klient" />
        <SummaryStat value="2" label="Afventer leder" detail="godkendelsesmail sendt" />
        <SummaryStat value="3" label="Afsluttet" detail="seneste 90 dage" />
      </section>

      <section className="records-section consultant-records">
        <div className="consultant-filter-title"><div><span className="section-label dark">Sagsliste</span><h2>Aktive ansøgninger</h2></div><button className="line-button" type="button"><Download size={17} /> Eksportér</button></div>
        <div className="records-toolbar">
          <label className="clean-search"><Search size={18} /><input aria-label="Søg i alle sager" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sagsnummer, system eller anmoder" /></label>
          <label className="clean-select"><Filter size={17} /><select value={phase} onChange={(event) => setPhase(event.target.value)}><option>Alle faser</option><option>Kladde</option><option>Indsendt</option><option>Under behandling</option><option>Afsluttet</option></select><ChevronDown size={16} /></label>
        </div>
        <RecordsTable rows={rows} onOpen={onOpen} />
      </section>
    </div>
  );
}

function SummaryStat({ value, label, detail }: { value: string; label: string; detail: string }) {
  return <article><strong>{value}</strong><div><span>{label}</span><small>{detail}</small></div></article>;
}

function RecordsTable({ rows, onOpen, applicantMode }: { rows: CaseRecord[]; onOpen: (id: string) => void; applicantMode?: boolean }) {
  return (
    <div className="clean-table-wrap">
      <table className="clean-table">
        <thead><tr><th>Sag</th><th>Fase</th><th>Oprettet</th><th>Ændret</th><th>{applicantMode ? "D-GITA Konsulent" : "Anmoder"}</th><th>Leder godkendt</th><th aria-label="Filer" /><th aria-label="Åbn" /></tr></thead>
        <tbody>{rows.map((item) => (
          <tr key={item.id} onClick={() => onOpen(item.id)}>
            <td><div className="record-name"><span>{item.system.slice(0, 2).toUpperCase()}</span><div><strong>{item.system}</strong><small>{item.id} · {item.municipality}</small></div></div></td>
            <td><PhaseTag phase={item.phase} /></td>
            <td>{item.created}</td>
            <td>{item.changed}</td>
            <td>{applicantMode ? item.consultant : item.applicant}</td>
            <td><ApprovalTag approval={item.approval} /></td>
            <td><button className="table-action" type="button" aria-label={`Se filer for ${item.id}`}><FolderOpen size={18} /></button></td>
            <td><button className="table-action" type="button" aria-label={`Åbn ${item.id}`}><ArrowRight size={18} /></button></td>
          </tr>
        ))}</tbody>
      </table>
      {rows.length === 0 ? <div className="no-records"><Search size={25} /><strong>Ingen sager matcher</strong><p>Prøv et andet søgeord eller en anden fase.</p></div> : null}
    </div>
  );
}

function PhaseTag({ phase }: { phase: Phase }) {
  const tone = phase === "Kladde" ? "gray" : phase === "Indsendt" ? "blue" : phase === "Under behandling" ? "amber" : "green";
  return <span className={cx("phase-tag", tone)}><i />{phase}</span>;
}

function ApprovalTag({ approval }: { approval: Approval }) {
  const tone = approval === "Godkendt" ? "green" : approval === "Afventer" ? "amber" : approval === "Afvist" ? "red" : "gray";
  return <span className={cx("approval-tag", tone)}>{approval === "Godkendt" ? <CheckCircle2 size={14} /> : approval === "Afvist" ? <XCircle size={14} /> : <Clock3 size={14} />}{approval}</span>;
}

function PageIntro({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: ReactNode }) {
  return <div className="page-intro"><div><span className="section-label dark">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{children ? <div className="page-intro-action">{children}</div> : null}</div>;
}

function AccessDenied({ onBack }: { onBack: () => void }) {
  return <div className="portal-page page-width"><section className="plain-section access-denied"><LockKeyhole size={28} /><span className="section-label dark">Adgang afvist</span><h1>Du kan ikke åbne denne ansøgning</h1><p>Sagen findes ikke, eller den tilhører en anden bruger. Almindelige brugere kan kun se deres egne ansøgninger.</p><button className="solid-button" type="button" onClick={onBack}><ArrowLeft size={17} /> Tilbage til dit område</button></section></div>;
}

function KnowledgeView({ content }: { content: ContentEntry[] }) {
  const [query, setQuery] = useState("");
  const published = content.filter((entry) => entry.published);
  const normalizedQuery = query.trim().toLocaleLowerCase("da-DK");
  const matches = (entry: ContentEntry) => !normalizedQuery || `${entry.title} ${entry.body}`.toLocaleLowerCase("da-DK").includes(normalizedQuery);
  const guidance = published.filter((entry) => entry.category === "form_help" && matches(entry));
  const faqs = published.filter((entry) => entry.category === "faq" && matches(entry));
  const links = published.filter((entry) => entry.category === "link");
  const processor = published.filter((entry) => entry.category === "data_processor");
  const hasSearchResults = guidance.length > 0 || faqs.length > 0;

  return <div className="knowledge-page">
    <section className="knowledge-editorial-hero">
      <div className="knowledge-hero-photo"><Image src="/dgita-help.png" alt="En D-GITA-konsulent vejleder en kommunal kollega" fill priority unoptimized sizes="(max-width: 900px) 100vw, 48vw" /></div>
      <div className="knowledge-hero-copy"><span className="section-label">Viden · Kalundborg Kommune</span><h1>{contentBody(content, "knowledge.hero.title", "Vejledning til Den Gode IT-Anskaffelse")}</h1><p>{contentBody(content, "knowledge.hero.body", "En samlet gennemgang af IT-ansøgningsprocessen og D-GITA-konsulenternes rolle.")}</p><div className="knowledge-hero-stats"><div><strong>{published.filter((entry) => entry.category === "form_help").length}</strong><small>vejledninger</small></div><div><strong>{published.filter((entry) => entry.category === "faq").length}</strong><small>FAQ-svar</small></div><div><strong>{links.length}</strong><small>nyttige links</small></div></div></div>
    </section>

    <div className="page-width knowledge-content">
      <section className="knowledge-intro"><div><span className="section-label dark">Information</span><h2>Kom godt fra behov til færdig sag.</h2><p>{contentBody(content, "knowledge.info", "Vejledningen tager dig gennem alle faser af en IT-anskaffelse.")}</p></div><aside><Info size={21} /><div><strong>Vigtigt tip</strong><p>{contentBody(content, "knowledge.tip", "Involvér D-GITA-konsulenten tidligt i processen.")}</p></div></aside></section>

      <section className="knowledge-process" aria-label="D-GITA-forløbet"><div className="knowledge-section-heading"><span className="section-label dark">Det visuelle forløb</span><h2>Tre roller. Ét fælles beslutningsgrundlag.</h2></div><div className="knowledge-process-steps"><article><span>01</span><small>Anmoder</small><h3>Opret ansøgningen</h3><p>{contentBody(content, "knowledge.process.applicant", "Beskriv behovet og saml dokumentationen.")}</p></article><article><span>02</span><small>Leder</small><h3>Godkend grundlaget</h3><p>{contentBody(content, "knowledge.process.leader", "Lederen godkender eller afviser den indsendte version.")}</p></article><article><span>03</span><small>D-GITA</small><h3>Vurdér og færdigbehandl</h3><p>{contentBody(content, "knowledge.process.consultant", "D-GITA vurderer og færdigbehandler sagen i dialog med anmoderen.")}</p></article></div></section>

      <section className="knowledge-about-grid"><article><BookOpen size={22} /><span className="section-label dark">Om portalen</span><h2>Den Gode IT-Anskaffelse</h2><p>{contentBody(content, "knowledge.about", "D-GITA samler de oplysninger, der skal bruges til en god IT-anskaffelse.")}</p></article><article><UserCheck size={22} /><span className="section-label dark">Rådgivning</span><h2>D-GITA-konsulenten</h2><p>{contentBody(content, "knowledge.consultant", "Konsulenten hjælper med krav, dokumentation og kommunens IT-infrastruktur.")}</p></article></section>

      <section className="knowledge-library"><div className="knowledge-library-head"><div><span className="section-label dark">Ordbog og svar</span><h2>Find det, du har brug for</h2><p>Søg på fx kontrakt, ESDH, risikovurdering, leder eller databehandleraftale.</p></div><label className="knowledge-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg i vejledninger og FAQ" aria-label="Søg i vejledninger og FAQ" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Ryd søgning"><X size={16} /></button> : null}</label></div>
        {hasSearchResults ? <div className="knowledge-answer-grid"><section className="knowledge-accordion"><div className="knowledge-list-title"><BookOpen size={18} /><div><h3>Vejledninger</h3><small>{guidance.length} emner</small></div></div>{guidance.map((entry, index) => <details className="guide-item" key={entry.id}><summary><span>{String(index + 1).padStart(2, "0")}</span>{entry.title}<ChevronDown size={17} /></summary><div><p>{entry.body}</p><small>{entry.location}</small></div></details>)}</section><section className="knowledge-accordion"><div className="knowledge-list-title"><MessageSquare size={18} /><div><h3>Ofte stillede spørgsmål</h3><small>{faqs.length} svar</small></div></div>{faqs.map((entry) => <details className="guide-item faq-guide-item" key={entry.id}><summary><span>?</span>{entry.title}<ChevronDown size={17} /></summary><div><p>{entry.body}</p></div></details>)}</section></div> : <div className="knowledge-empty"><Search size={26} /><h3>Ingen svar matcher “{query}”</h3><p>Prøv et kortere søgeord, eller ryd søgningen for at se alle emner.</p><button className="line-button" type="button" onClick={() => setQuery("")}>Vis alle emner</button></div>}
      </section>

      <div className="knowledge-grid knowledge-bottom-grid"><section className="plain-section knowledge-section"><div className="plain-heading"><span className="section-label dark">Krav og dokumentation</span><h2>Databehandlerkrav</h2></div>{processor.map((entry) => <article className="knowledge-card" key={entry.id}><ShieldCheck size={19} /><div><h3>{entry.title}</h3><p>{entry.body}</p></div></article>)}</section><section className="plain-section knowledge-section"><div className="plain-heading"><span className="section-label dark">Generelle og lokale genveje</span><h2>Nyttige links</h2></div><div className="knowledge-links">{links.map((entry) => entry.url && isSafeContentUrl(entry.url) ? <a href={entry.url} key={entry.id} target={entry.url.startsWith("https://") ? "_blank" : undefined} rel={entry.url.startsWith("https://") ? "noreferrer" : undefined}><Link2 size={18} /><span><strong>{entry.title}</strong><small>{entry.body}</small></span><ExternalLink size={16} /></a> : null)}</div></section></div>

      <section className="knowledge-contact"><div><span className="section-label">Stadig i tvivl?</span><h2>Tag D-GITA med fra begyndelsen.</h2><p>Fortæl kort, hvad du har brug for hjælp til — fx at finde et system, skaffe kontrakt eller dokumentation eller komme i gang med din første ansøgning.</p></div><a className="solid-button" href="mailto:ckra@kalundborg.dk?subject=Ønske%20om%20D-GITA-formøde">Book et formøde <ArrowRight size={18} /></a></section>
    </div>
  </div>;
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <div className="question"><div className="question-copy"><label>{title}</label>{hint ? <p>{hint}</p> : null}</div>{children}</div>;
}

function CaseDetail({
  item,
  viewer,
  approval,
  fieldComments,
  onBack,
  onSaveApproval,
  onAddFieldComment,
  onToast,
}: {
  item: CaseRecord;
  viewer: WorkspaceViewer;
  approval: DgitaApproval;
  fieldComments: FieldComment[];
  onBack: () => void;
  onSaveApproval: (approval: DgitaApproval) => void;
  onAddFieldComment: (fieldId: string, fieldLabel: string, body: string) => void;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState("overblik");
  const canProcess = capabilitiesFor(viewer.role).processApplications;
  const tabs = ["overblik", "ansøgning", "filer", "kommentarer", ...(canProcess ? ["dgita"] : []), "historik"];
  return (
    <div className="detail-page page-width">
      <button className="back-text" type="button" onClick={onBack}><ArrowLeft size={18} /> {viewer.role === "user" ? "Mine ansøgninger" : "Alle sager"}</button>
      <section className="case-title-block">
        <div><span className="section-label dark">{item.id} · {item.municipality} Kommune</span><h1>{item.system}</h1><div className="case-title-meta"><PhaseTag phase={item.phase} /><span>Ændret {item.changed}</span></div></div>
        <div><button className="line-button" type="button" onClick={() => onToast("Kvitteringen er klar til download")}><Download size={17} /> Hent kvittering</button>{canProcess ? <button className="solid-button" type="button" onClick={() => onToast("En Outlook-mail er lagt i afsendelseskøen")}><Mail size={17} /> Send statusmail</button> : null}</div>
      </section>

      <CaseJourney active={item.phase} />

      <nav className="detail-tabs" aria-label="Sagens indhold">
        {tabs.map((name) => <button className={tab === name ? "active" : ""} type="button" key={name} onClick={() => setTab(name)}>{name === "overblik" ? <LayoutGrid size={17} /> : name === "ansøgning" ? <FileText size={17} /> : name === "filer" ? <Paperclip size={17} /> : name === "kommentarer" ? <MessageSquare size={17} /> : name === "dgita" ? <ShieldCheck size={17} /> : <History size={17} />}{name === "dgita" ? "D-GITA godkendelse" : name}<span>{name === "filer" ? "3" : name === "kommentarer" ? String(fieldComments.length) : ""}</span></button>)}
      </nav>

      {tab === "overblik" ? <CaseOverview item={item} onToast={onToast} /> : null}
      {tab === "ansøgning" ? <ApplicationSnapshot canComment={canProcess} comments={fieldComments} onAddComment={onAddFieldComment} /> : null}
      {tab === "filer" ? <FileList onToast={onToast} /> : null}
      {tab === "kommentarer" ? <Comments onToast={onToast} /> : null}
      {tab === "dgita" && canProcess ? <DgitaApprovalPanel value={approval} onSave={onSaveApproval} /> : null}
      {tab === "historik" ? <AuditTrail item={item} /> : null}
    </div>
  );
}

function CaseJourney({ active }: { active: Phase }) {
  const steps: Phase[] = ["Kladde", "Indsendt", "Under behandling", "Afsluttet"];
  const activeIndex = steps.indexOf(active);
  return <div className="case-journey">{steps.map((step, index) => <div className={cx(index < activeIndex && "done", index === activeIndex && "current")} key={step}><span>{index < activeIndex ? <Check size={15} /> : index + 1}</span><strong>{step}</strong>{index < steps.length - 1 ? <i /> : null}</div>)}</div>;
}

function CaseOverview({ item, onToast }: { item: CaseRecord; onToast: (message: string) => void }) {
  return <div className="case-content-grid"><div className="case-primary">
    <section className="attention-block"><span><Info size={22} /></span><div><small>Opmærksomhedspunkt</small><h2>Arkitekturtegning mangler</h2><p>Der er endnu ikke indhentet en arkitekturtegning og beskrivelse af IT-systemets sammenhænge med andre systemer.</p></div><button className="solid-button" type="button" onClick={() => onToast("Filvælger er åbnet")}><Upload size={17} /> Upload bilag</button></section>
    <section className="plain-section"><div className="plain-heading"><span className="section-label dark">Ansøgningen</span><h2>Nøgleoplysninger</h2></div><div className="facts-grid"><Fact label="Anskaffelsesform" value="DIGIT udbud/aftale" /><Fact label="Ansvarlig organisation" value="ORG – Digitalisering og IT" /><Fact label="Dataklassifikation" value="Fortrolige oplysninger" /><Fact label="Antal brugere" value="500–100.000" /><Fact label="Implementering" value="18.09 – 09.10.2026" /><Fact label="Samlet finansiering" value="300,00 kr." /></div></section>
    <section className="plain-section"><div className="plain-heading"><span className="section-label dark">Faglig vurdering</span><h2>To centrale kontroller</h2></div><div className="assessment-list"><div className="assessment ok"><CheckCircle2 size={21} /><div><strong>Markedsafdækning gennemført</strong><p>Spørgsmål 26 er besvaret ja.</p></div></div><div className="assessment missing"><XCircle size={21} /><div><strong>Arkitekturbeskrivelse mangler</strong><p>Spørgsmål 50 er besvaret nej.</p></div></div></div></section>
  </div><aside className="case-aside">
    <section><span className="section-label dark">Ansvar</span><h3>Personer på sagen</h3><Person name={item.applicant} role="Anmoder" initials="PV" /><Person name={item.consultant} role="D-GITA Konsulent" initials="PB" /><Person name={item.leader} role="Godkendende leder" initials="PB" /></section>
    <section><span className="section-label dark">Godkendelse</span><h3>Leder godkendt</h3><ApprovalTag approval={item.approval} /><p>Beslutningen er registreret på den indsendte version af ansøgningen.</p><button className="line-button full" type="button" onClick={() => onToast("Godkendelseskvitteringen er sendt igen")}><Mail size={17} /> Gensend godkendelsesmail</button></section>
    <section><span className="section-label dark">Sagsdata</span><dl><div><dt>Oprettet</dt><dd>{item.created}</dd></div><div><dt>Ændret</dt><dd>{item.changed}</dd></div><div><dt>Kommune</dt><dd>{item.municipality}</dd></div><div><dt>ESDH</dt><dd><button type="button">Åbn reference</button></dd></div></dl></section>
  </aside></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="fact"><small>{label}</small><strong>{value}</strong></div>;
}

function Person({ name, role, initials }: { name: string; role: string; initials: string }) {
  return <div className="case-person"><span>{initials}</span><div><strong>{name}</strong><small>{role}</small></div><button type="button" aria-label={`Send mail til ${name}`}><Mail size={15} /></button></div>;
}

function ApplicationSnapshot({
  canComment,
  comments,
  onAddComment,
}: {
  canComment: boolean;
  comments: FieldComment[];
  onAddComment: (fieldId: string, fieldLabel: string, body: string) => void;
}) {
  const sections = ["Generelle oplysninger", "Systemoplysninger", "System og anskaffelsesform", "Værdi for kommunen", "Investering", "Risikovurdering", "Databehandleraftale", "Implementering", "IT-krav", "Øvrige"];
  return <div className="snapshot-stack"><section className="snapshot plain-section"><div className="plain-heading"><span className="section-label dark">Indsendt version</span><h2>Ansøgningens indhold</h2><span className="locked"><LockKeyhole size={15} /> Version 3 · låst</span></div>{sections.map((section, index) => <button type="button" key={section}><span>{String(index + 1).padStart(2, "0")}</span><strong>{section}</strong><small>{index === 8 ? "1 opmærksomhedspunkt" : "Udfyldt"}</small><ChevronRight size={18} /></button>)}</section><FieldCommentsPanel canComment={canComment} comments={comments} onAddComment={onAddComment} /></div>;
}

const APPLICATION_FIELD_VALUES: Record<string, string> = {
  system: "WSUS klient",
  purpose: "Sikker og ensartet opdatering af kommunens Windows-klienter.",
  users: "500–100.000",
  "personal-data": "Ja · fortrolige oplysninger",
  finance: "300,00 kr.",
};

function FieldCommentsPanel({
  canComment,
  comments,
  onAddComment,
}: {
  canComment: boolean;
  comments: FieldComment[];
  onAddComment: (fieldId: string, fieldLabel: string, body: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return <section className="plain-section field-comments-section"><div className="plain-heading"><span className="section-label dark">Feltvis dialog</span><h2>Kommentarer til ansøgningens felter</h2></div><p className="section-lead">D-GITA-konsulenten kan knytte en kommentar til et konkret svar. Delte kommentarer kan ses af anmoderen, mens interne noter ligger separat under D-GITA-godkendelsen.</p><div className="field-comment-list">{COMMENTABLE_APPLICATION_FIELDS.map((field) => {
    const fieldComments = comments.filter((comment) => comment.fieldId === field.id && comment.visibility === "applicant");
    const draft = drafts[field.id] ?? "";
    return <article className="field-comment-row" key={field.id}><div className="field-comment-answer"><small>{field.label}</small><strong>{APPLICATION_FIELD_VALUES[field.id]}</strong></div>{fieldComments.length ? <div className="saved-field-comments">{fieldComments.map((comment) => <div key={comment.id}><MessageSquare size={15} /><p>{comment.body}</p><small>{comment.authorName} · {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</small></div>)}</div> : <p className="no-field-comment">Ingen kommentarer til feltet.</p>}{canComment ? <div className="field-comment-composer"><textarea rows={2} value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={`Kommentér feltet “${field.label}”`} /><button className="line-button" type="button" disabled={!draft.trim()} onClick={() => { onAddComment(field.id, field.label, draft.trim()); setDrafts((current) => ({ ...current, [field.id]: "" })); }}><Send size={15} /> Gem kommentar</button></div> : null}</article>;
  })}</div></section>;
}

function YesNoControl({ value, onChange }: { value: "" | "Ja" | "Nej"; onChange: (value: "Ja" | "Nej") => void }) {
  return <div className="choice-row" role="radiogroup">{(["Ja", "Nej"] as const).map((option) => <button className={value === option ? "selected" : ""} type="button" role="radio" aria-checked={value === option} key={option} onClick={() => onChange(option)}><span aria-hidden="true">{value === option ? <Check size={14} /> : null}</span>{option}</button>)}</div>;
}

function DgitaApprovalPanel({ value, onSave }: { value: DgitaApproval; onSave: (value: DgitaApproval) => void }) {
  const [draft, setDraft] = useState<DgitaApproval>(() => structuredClone(value));

  function update<K extends keyof DgitaApproval>(field: K, next: DgitaApproval[K]) {
    setDraft((current) => ({ ...current, [field]: next }));
  }

  return <div className="dgita-review-layout"><section className="plain-section dgita-review"><div className="plain-heading"><span className="section-label dark">Internt arbejdsområde</span><h2>D-GITA-godkendelse</h2><button className="solid-button" type="button" onClick={() => onSave(draft)}><Save size={17} /> Gem D-GITA-felter</button></div><div className="internal-notice"><LockKeyhole size={18} /><p>Dette område er kun tilgængeligt for D-GITA-konsulenter og administratorer. Interne kommentarer vises aldrig for anmoderen eller i PDF-kvitteringen.</p></div><Question title="D-GITA felt: Er ansøgningen godkendt?"><YesNoControl value={draft.approved} onChange={(next) => update("approved", next)} /></Question><Question title="D-GITA felt: Dato"><input className="clean-input" type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} /></Question><Question title="D-GITA felt: Angiv på hvilket lovgrundlag at data behandles" hint="Det kan være en idé at tage kontakt til den i kommunen som er informationssikkerhedsansvarlig/koordinator"><label className="clean-select review-select"><select value={draft.legalBasis} onChange={(event) => update("legalBasis", event.target.value as DgitaApproval["legalBasis"])}><option value="">Vælg lovgrundlag</option>{D_GITA_LEGAL_BASES.map((basis) => <option key={basis}>{basis}</option>)}</select><ChevronDown size={16} /></label></Question><Question title="D-GITA felt: D-GITA ansvarlig" hint="Skriv her hvem der er ansvarlig for behandling af formularen."><input className="clean-input" value={draft.responsible} onChange={(event) => update("responsible", event.target.value)} placeholder="Søg efter person" /></Question><Question title="D-GITA felt: Er der flere D-GITA ansvarlige?"><YesNoControl value={draft.hasAdditionalResponsible} onChange={(next) => update("hasAdditionalResponsible", next)} /></Question>{draft.hasAdditionalResponsible === "Ja" ? <Question title="Hvis ja, angiv næste D-GITA ansvarlige"><input className="clean-input" value={draft.additionalResponsible} onChange={(event) => update("additionalResponsible", event.target.value)} placeholder="Angiv en eller flere personer" /></Question> : null}<Question title="D-GITA felt: IT-konsulent" hint="Vælg den person som bliver koblet på løsningen, som en teknisk ansvarlig fra IT-afdelingen."><input className="clean-input" value={draft.itConsultant} onChange={(event) => update("itConsultant", event.target.value)} placeholder="Søg efter person" /></Question><Question title="D-GITA felt: Medfører systemet ændringer i den eksisterende infrastruktur?"><YesNoControl value={draft.infrastructureChanges} onChange={(next) => update("infrastructureChanges", next)} /></Question><Question title="D-GITA felt: Bemærkninger"><textarea className="clean-input" rows={4} value={draft.notes} onChange={(event) => update("notes", event.target.value)} /></Question><Question title="D-GITA felt: Interne kommentarer" hint="Kommentarer mellem D-GITA konsulenter. Feltet er skjult for anmoder og medtages ikke i den PDF, der genereres ved endelig godkendelse."><textarea className="clean-input internal-comment-input" rows={5} value={draft.internalComments} onChange={(event) => update("internalComments", event.target.value)} /></Question><Question title="D-GITA felt: Fase" hint="Beskriver hvilken fase ansøgningen er i."><label className="clean-select review-select"><select value={draft.phase} onChange={(event) => update("phase", event.target.value as DgitaApproval["phase"])}>{D_GITA_PHASES.map((phase) => <option key={phase}>{phase}</option>)}</select><ChevronDown size={16} /></label></Question></section><aside className="review-source-note"><ShieldCheck size={23} /><span className="section-label dark">Kildematch</span><h3>Felter fra den nuværende løsning</h3><p>Godkendelsesfelterne og hjælpeteksterne er kortlagt fra Power Pages-formularen “D-GITA-Godkendelse”.</p><ul><li><Check size={14} /> Betinget ekstra ansvarlig</li><li><Check size={14} /> Lovgrundlag: NSIS, NIS2 eller GDPR</li><li><Check size={14} /> Intern kommentar adskilt fra ansøger</li><li><Check size={14} /> Fase og infrastrukturbeslutning</li></ul></aside></div>;
}

function FileList({ onToast }: { onToast: (message: string) => void }) {
  return <section className="plain-section file-section"><div className="plain-heading"><span className="section-label dark">Dokumenter</span><h2>Filer på sagen</h2><button className="solid-button" type="button" onClick={() => onToast("Filvælger er åbnet")}><Upload size={17} /> Upload fil</button></div>{[["Tjekliste_til_leverandør.pdf", "PDF · 824 KB"], ["Indsendelseskvittering_v3.pdf", "PDF · 392 KB"], ["Markedsafdækning.docx", "DOCX · 218 KB"]].map(([name, meta]) => <div className="document-row" key={name}><FileText size={20} /><div><strong>{name}</strong><small>{meta}</small></div><span>26-08-2026</span><button type="button"><Download size={18} /></button></div>)}</section>;
}

function Comments({ onToast }: { onToast: (message: string) => void }) {
  return <section className="plain-section comments-section"><div className="plain-heading"><span className="section-label dark">Sagsdialog</span><h2>Kommentarer</h2></div><div className="empty-comments"><MessageSquare size={25} /><strong>Der er ingen kommentarer at vise</strong><p>Start en dialog med anmoder eller D-GITA-konsulenten.</p></div><div className="comment-composer"><textarea rows={4} placeholder="Skriv en kommentar til sagen..." /><div><button type="button"><Paperclip size={17} /> Vedhæft</button><button className="solid-button" type="button" onClick={() => onToast("Kommentaren er sendt")}><Send size={17} /> Opret kommentar</button></div></div></section>;
}

function AuditTrail({ item }: { item: CaseRecord }) {
  return <section className="plain-section audit-section"><div className="plain-heading"><span className="section-label dark">Auditspor</span><h2>Historik på sagen</h2></div>{[[item.changed, "Fase ændret til Under behandling", "Peter Bjerre Ahlgren"], ["26-08-2026 10:44", "Ledergodkendelse registreret", "Peter Bjerre Ahlgren"], ["26-08-2026 10:12", "Ansøgning indsendt og kvittering sendt", item.applicant], [item.created, "Sag oprettet som kladde", item.applicant]].map(([date, event, actor], index) => <div className="audit-row" key={event}><div><span>{index === 0 ? <History size={16} /> : <Check size={15} />}</span>{index < 3 ? <i /> : null}</div><time>{date}</time><strong>{event}</strong><small>{actor}</small></div>)}</section>;
}

type AdminTab = ContentCategory | "formular" | "mail" | "integrationer";

function AdminView({
  content,
  viewer,
  onUpdateContent,
  onAddContent,
  onRemoveContent,
  onResetContent,
  onToast,
}: {
  content: ContentEntry[];
  viewer: WorkspaceViewer;
  onUpdateContent: (entry: ContentEntry) => boolean;
  onAddContent: (entry: ContentEntry) => boolean;
  onRemoveContent: (id: string) => boolean;
  onResetContent: () => boolean;
  onToast: (message: string) => void;
}) {
  const [tab, setTab] = useState<AdminTab>("portal_text");
  const contentTabs = Object.entries(CONTENT_CATEGORY_LABELS) as Array<[ContentCategory, string]>;
  const tabs: Array<[AdminTab, string]> = [
    ...contentTabs,
    ["formular", "Formularstruktur"],
    ["mail", "Mail & kvitteringer"],
    ["integrationer", "Integrationer"],
  ];
  const isContentTab = tab in CONTENT_CATEGORY_LABELS;

  return <div className="portal-page page-width"><PageIntro eyebrow="Administration" title="Indhold, formular og workflows" text="Redigér portaltekster, hjælpetekster, FAQ, links og databehandlerkrav. Administratorrollen har samtidig adgang til sager og D-GITA-behandling."><div className="admin-demo-badge"><ShieldCheck size={17} /><span><strong>Admin · testtilstand</strong><small>{viewer.displayName}</small></span></div></PageIntro>
    <div className="admin-mode-note"><Info size={18} /><p>Ændringer gemmes på denne enhed i demoen. Ved kommunal SSO flyttes autorisation, audit og publicering til serveren.</p><button className="line-button" type="button" onClick={() => { if (onResetContent()) onToast("Standardindholdet er gendannet."); }}><RotateCcw size={16} /> Gendan standard</button></div>
    <nav className="admin-nav" aria-label="Adminområder">{tabs.map(([id, label]) => <button className={tab === id ? "active" : ""} type="button" key={id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {isContentTab ? <ContentManager category={tab as ContentCategory} content={content} onUpdate={onUpdateContent} onAdd={onAddContent} onRemove={onRemoveContent} onToast={onToast} /> : null}
    {tab === "integrationer" ? <div className="admin-layout"><section className="plain-section"><div className="plain-heading"><span className="section-label dark">Systemforbindelser</span><h2>Integrationer</h2></div><div className="integration-list"><Integration icon={Mail} title="Microsoft Outlook" detail="Kvitteringer og godkendelsesmails" status="Klar til opsætning" /><Integration icon={LayoutGrid} title="KITOS" detail="Systemkatalog og organisationsopslag" status="Normal drift" /><Integration icon={FolderOpen} title="Dokumentlager" detail="Bilag og versionslåste PDF-filer" status="Normal drift" /><Integration icon={Inbox} title="ESDH" detail="Journalreferencer og arkivering" status="Klar til opsætning" /></div></section><aside className="security-panel"><ShieldCheck size={27} /><span className="section-label">Fremtidig adgang</span><h2>Kommunal SSO og rolleclaims</h2><p>Testdropdownen erstattes af en servervalideret identitet fra Fælleskommunal Adgangsstyring eller kommunens Entra ID.</p><ul><li><Check size={15} /> Stabil brugeridentitet som ejer</li><li><Check size={15} /> Roller fra godkendte grupper</li><li><Check size={15} /> Tenant-adskilte data og auditspor</li></ul></aside></div> : null}
    {tab === "formular" ? <section className="plain-section admin-table-section"><div className="plain-heading"><span className="section-label dark">Publiceret motorversion 1</span><h2>Formularens sektioner</h2><button className="solid-button" type="button" onClick={() => onToast("En ny kladde til formularversion er oprettet.")}><Plus size={17} /> Ny version</button></div><p className="section-lead">Tekster redigeres under Hjælpetekster. Feltnøgler, validering og betingelser er låst til en formularversion, så eksisterende ansøgninger ikke ændres bagudrettet.</p>{applicationSteps.slice(0, -1).map((name, index) => <div className="admin-form-row" key={name}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>{index === 0 ? "7 felter · 4 betingede regler" : `${3 + index} felter · aktiv`}</small></div><button type="button" aria-label={`Flere handlinger for ${name}`}><MoreHorizontal size={19} /></button></div>)}</section> : null}
    {tab === "mail" ? <div className="admin-layout"><section className="plain-section"><div className="plain-heading"><span className="section-label dark">Microsoft Outlook</span><h2>Mail og kvitteringer</h2></div><p className="section-lead">Skabelonerne er klargjort. Faktisk afsendelse kræver en server-side Microsoft Graph-forbindelse og kommunal godkendelse.</p>{[["Ansøgning indsendt", "application.submitted"], ["Ny sag til visitering", "application.received"], ["Ledergodkendelse", "approval.requested"], ["Godkendelse registreret", "approval.completed"], ["Information mangler", "information.requested"], ["Sag afsluttet", "application.closed"]].map(([name, event]) => <div className="mail-template-row" key={event}><Mail size={18} /><div><strong>{name}</strong><code>{event}</code></div><span>Kladde</span><button type="button"><ChevronRight size={18} /></button></div>)}</section><aside className="mail-receipt"><div className="receipt-sender"><span>DG</span><div><strong>D-GITA</strong><small>dgita@kalundborg.dk</small></div></div><small>Ansøgning ITA-001284 er modtaget</small><h3>Tak — din ansøgning er indsendt</h3><p>Din ansøgning om <strong>WSUS klient</strong> er sendt til D-GITA.</p><dl><div><dt>Sagsnummer</dt><dd>ITA-001284</dd></div><div><dt>Fase</dt><dd>Indsendt</dd></div></dl><button type="button">Åbn din sag</button><p>Din PDF-kvittering vedhæftes efter Graph-opsætning.</p><button className="line-button full" type="button" onClick={() => onToast("Preview er vist. Outlook-afsendelse afventer Graph-forbindelsen.")}><Send size={17} /> Test preview</button></aside></div> : null}
  </div>;
}

function ContentManager({
  category,
  content,
  onUpdate,
  onAdd,
  onRemove,
  onToast,
}: {
  category: ContentCategory;
  content: ContentEntry[];
  onUpdate: (entry: ContentEntry) => boolean;
  onAdd: (entry: ContentEntry) => boolean;
  onRemove: (id: string) => boolean;
  onToast: (message: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const entries = content.filter((entry) => entry.category === category);
  const needsUrl = category === "link";

  function addEntry() {
    if (!newTitle.trim() || !newBody.trim()) {
      onToast("Skriv både titel og tekst, før indholdet tilføjes.");
      return;
    }
    if (needsUrl && !isSafeContentUrl(newUrl)) {
      onToast("Linket skal være et sikkert https-, mailto- eller internt link.");
      return;
    }
    const entry: ContentEntry = {
      id: `custom.${category}.${crypto.randomUUID()}`,
      category,
      title: newTitle.trim(),
      body: newBody.trim(),
      url: needsUrl ? newUrl.trim() : undefined,
      location: CONTENT_CATEGORY_LABELS[category],
      published: true,
    };
    if (onAdd(entry)) {
      setNewTitle("");
      setNewBody("");
      setNewUrl("");
      onToast("Indholdet er tilføjet og publiceret i demoen.");
    }
  }

  return <section className="plain-section content-manager"><div className="plain-heading"><span className="section-label dark">Redigerbart indhold</span><h2>{CONTENT_CATEGORY_LABELS[category]}</h2><span className="content-count">{entries.length} elementer</span></div><p className="section-lead">Ret titel, tekst, publiceringsstatus{needsUrl ? " og linkadresse" : ""}. Tekniske feltnøgler og formularlogik kan ikke ændres her.</p><div className="content-entry-list">{entries.map((entry) => <ContentEditorCard key={`${entry.id}:${entry.updatedAt ?? "default"}`} entry={entry} onUpdate={onUpdate} onRemove={onRemove} onToast={onToast} />)}</div><div className="new-content-card"><div><span className="section-label dark">Nyt element</span><h3>Tilføj til {CONTENT_CATEGORY_LABELS[category].toLowerCase()}</h3></div><label>Titel<input className="clean-input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Skriv en tydelig titel" /></label><label>Tekst<textarea className="clean-input" rows={4} value={newBody} onChange={(event) => setNewBody(event.target.value)} placeholder="Skriv indholdet" /></label>{needsUrl ? <label>Linkadresse<input className="clean-input" value={newUrl} onChange={(event) => setNewUrl(event.target.value)} placeholder="https://…, /intern-side eller mailto:…" /></label> : null}<button className="solid-button" type="button" onClick={addEntry}><Plus size={17} /> Tilføj og publicér</button></div></section>;
}

function ContentEditorCard({
  entry,
  onUpdate,
  onRemove,
  onToast,
}: {
  entry: ContentEntry;
  onUpdate: (entry: ContentEntry) => boolean;
  onRemove: (id: string) => boolean;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState(entry);
  const [urlError, setUrlError] = useState("");

  function save() {
    if (draft.url && !isSafeContentUrl(draft.url)) {
      setUrlError("Brug https://, mailto: eller en intern sti der starter med /.");
      return;
    }
    setUrlError("");
    if (onUpdate(draft)) onToast(`“${draft.title}” er gemt.`);
  }

  return <article className="content-editor-card"><div className="content-editor-meta"><span>{entry.location}</span><code>{entry.id}</code></div><label>Titel<input className="clean-input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Tekst<textarea className="clean-input" rows={4} value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} /></label>{entry.category === "link" ? <label>Linkadresse<input className={cx("clean-input", urlError && "input-error")} value={draft.url ?? ""} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} />{urlError ? <small className="field-error">{urlError}</small> : null}</label> : null}<div className="content-editor-actions"><label className="publish-toggle"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft((current) => ({ ...current, published: event.target.checked }))} /><span /> Publiceret</label><div><button className="quiet-danger" type="button" onClick={() => { if (onRemove(entry.id)) onToast(`“${entry.title}” er fjernet. Standardindhold kan gendannes øverst.`); }}><Trash2 size={16} /> Fjern</button><button className="solid-button" type="button" onClick={save}><Save size={16} /> Gem</button></div></div>{entry.updatedAt ? <small className="content-updated">Senest ændret {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.updatedAt))}{entry.updatedBy ? ` af ${entry.updatedBy}` : ""}</small> : null}</article>;
}

function Integration({ icon: Icon, title, detail, status }: { icon: LucideIcon; title: string; detail: string; status: string }) {
  return <div className="integration-row"><span><Icon size={20} /></span><div><strong>{title}</strong><small>{detail}</small></div><em className={status.includes("kø") ? "waiting" : "healthy"}><i />{status}</em><button type="button"><Settings2 size={18} /></button></div>;
}
