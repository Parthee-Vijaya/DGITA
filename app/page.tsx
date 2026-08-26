"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
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
  LockKeyhole,
  Mail,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type View = "home" | "cases" | "consultant" | "application" | "detail" | "admin";
type Phase = "Kladde" | "Indsendt" | "Under behandling" | "Afsluttet";
type Approval = "Ikke startet" | "Afventer" | "Godkendt" | "Afvist";

type CaseRecord = {
  id: string;
  system: string;
  phase: Phase;
  created: string;
  changed: string;
  consultant: string;
  applicant: string;
  municipality: string;
  leader: string;
  approval: Approval;
};

const cases: CaseRecord[] = [
  {
    id: "ITA-001290",
    system: "test",
    phase: "Kladde",
    created: "26-08-2026 13:26",
    changed: "26-08-2026 13:27",
    consultant: "Ikke tildelt",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Ikke valgt",
    approval: "Ikke startet",
  },
  {
    id: "ITA-001284",
    system: "WSUS klient",
    phase: "Under behandling",
    created: "26-08-2026 09:42",
    changed: "26-08-2026 10:57",
    consultant: "Peter Bjerre Ahlgren",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Peter Bjerre Ahlgren",
    approval: "Godkendt",
  },
  {
    id: "ITA-001286",
    system: "Anette",
    phase: "Kladde",
    created: "26-08-2026 09:46",
    changed: "26-08-2026 09:47",
    consultant: "Ikke tildelt",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Ikke valgt",
    approval: "Ikke startet",
  },
  {
    id: "ITA-001285",
    system: "Anita",
    phase: "Indsendt",
    created: "26-08-2026 09:43",
    changed: "26-08-2026 09:45",
    consultant: "Ikke tildelt",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Ikke valgt",
    approval: "Ikke startet",
  },
  {
    id: "ITA-001283",
    system: "Acta Pension",
    phase: "Kladde",
    created: "03-07-2026 10:36",
    changed: "03-07-2026 10:36",
    consultant: "Ikke tildelt",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Ikke valgt",
    approval: "Ikke startet",
  },
  {
    id: "ITA-001280",
    system: "Tester test",
    phase: "Indsendt",
    created: "30-06-2026 08:58",
    changed: "30-06-2026 09:04",
    consultant: "Ikke tildelt",
    applicant: "Anita Mark Vig Lauridsen",
    municipality: "Kalundborg",
    leader: "Partheepan Vijayamohan",
    approval: "Afventer",
  },
  {
    id: "ITA-001278",
    system: "PacerData",
    phase: "Indsendt",
    created: "30-06-2026 08:38",
    changed: "30-06-2026 08:53",
    consultant: "Ikke tildelt",
    applicant: "Anita Mark Vig Lauridsen",
    municipality: "Kalundborg",
    leader: "Partheepan Vijayamohan",
    approval: "Afventer",
  },
  {
    id: "ITA-001235",
    system: "MoEva",
    phase: "Afsluttet",
    created: "16-06-2026 08:15",
    changed: "16-06-2026 08:27",
    consultant: "Anita Mark Vig Lauridsen",
    applicant: "Anita Mark Vig Lauridsen",
    municipality: "Kalundborg",
    leader: "Anita Mark Vig Lauridsen",
    approval: "Afventer",
  },
  {
    id: "ITA-001213",
    system: "Abena Bevillingssystem",
    phase: "Indsendt",
    created: "01-06-2026 10:43",
    changed: "02-06-2026 08:34",
    consultant: "Peter Bjerre Ahlgren",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Peter Bjerre Ahlgren",
    approval: "Godkendt",
  },
  {
    id: "ITA-001183",
    system: "PacerData",
    phase: "Afsluttet",
    created: "18-05-2026 09:58",
    changed: "19-05-2026 10:26",
    consultant: "Partheepan Vijayamohan",
    applicant: "Partheepan Vijayamohan",
    municipality: "Kalundborg",
    leader: "Partheepan Vijayamohan",
    approval: "Godkendt",
  },
];

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
  const [view, setView] = useState<View>("home");
  const [selectedId, setSelectedId] = useState("ITA-001284");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selectedCase = cases.find((item) => item.id === selectedId) ?? cases[1];

  function navigate(next: View) {
    setView(next);
    setMobileMenu(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCase(id: string) {
    setSelectedId(id);
    navigate("detail");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3600);
  }

  return (
    <div className="site-shell">
      <Header
        view={view}
        mobileMenu={mobileMenu}
        profileOpen={profileOpen}
        notificationsOpen={notificationsOpen}
        onNavigate={navigate}
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
          <HomeView onNavigate={navigate} onToast={showToast} />
        ) : null}
        {view === "cases" ? (
          <CasesView onNew={() => navigate("application")} onOpen={openCase} />
        ) : null}
        {view === "consultant" ? (
          <ConsultantView onOpen={openCase} />
        ) : null}
        {view === "application" ? (
          <ApplicationView
            onBack={() => navigate("cases")}
            onSubmit={() => {
              showToast("Ansøgningen er indsendt. Kvittering er sendt til Outlook.");
              openCase("ITA-001284");
            }}
            onToast={showToast}
          />
        ) : null}
        {view === "detail" ? (
          <CaseDetail item={selectedCase} onBack={() => navigate("cases")} onToast={showToast} />
        ) : null}
        {view === "admin" ? <AdminView onToast={showToast} /> : null}
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
  mobileMenu,
  profileOpen,
  notificationsOpen,
  onNavigate,
  onMobileMenu,
  onProfile,
  onNotifications,
}: {
  view: View;
  mobileMenu: boolean;
  profileOpen: boolean;
  notificationsOpen: boolean;
  onNavigate: (view: View) => void;
  onMobileMenu: () => void;
  onProfile: () => void;
  onNotifications: () => void;
}) {
  const navigation: Array<{ label: string; view: View }> = [
    { label: "Startside", view: "home" },
    { label: "Mine ansøgninger", view: "cases" },
    { label: "D-GITA Konsulent", view: "consultant" },
    { label: "Admin", view: "admin" },
  ];

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
          <div className="header-popover-anchor">
            <button className="header-icon-button" type="button" aria-label="Notifikationer" onClick={onNotifications}>
              <Bell size={20} />
              <span>3</span>
            </button>
            {notificationsOpen ? <NotificationPanel /> : null}
          </div>
          <div className="header-popover-anchor profile-anchor">
            <button className="account-button" type="button" onClick={onProfile}>
              <span className="account-avatar">PV</span>
              <span className="account-copy"><strong>Partheepan Vijayamohan</strong><small>Kalundborg Kommune</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen ? (
              <div className="header-popover profile-menu">
                <div className="profile-menu-head"><span>PV</span><div><strong>Partheepan Vijayamohan</strong><small>Kalundborg Kommune</small></div></div>
                <button type="button"><UserRound size={17} /> Min profil</button>
                <button type="button"><ReceiptText size={17} /> Mine kvitteringer</button>
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

function HomeView({ onNavigate, onToast }: { onNavigate: (view: View) => void; onToast: (message: string) => void }) {
  return (
    <div className="home-page">
      <section className="editorial-hero">
        <div className="hero-photo">
          <Image src="/dgita-hero.png" alt="Kommunale medarbejdere samarbejder om en IT-anskaffelse" fill priority unoptimized sizes="(max-width: 900px) 100vw, 56vw" />
        </div>
        <div className="hero-content">
          <span className="section-label">Kalundborg Kommune · D-GITA</span>
          <h1>En god IT-anskaffelse starter med det rigtige behov.</h1>
          <p>Opret en ansøgning, eller se dine igangværende og historiske ansøgninger. D-GITA hjælper dig med at beskrive præcis, hvilke forandringer din IT-anskaffelse skal føre med sig.</p>
          <p className="hero-note"><Info size={17} /> Portalen bruges til køb under udbudsgrænsen.</p>
          <div className="hero-actions">
            <button className="solid-button" type="button" onClick={() => onNavigate("application")}>
              Opret ansøgning <ArrowRight size={18} />
            </button>
            <button className="line-button light" type="button" onClick={() => onNavigate("cases")}>
              Se mine ansøgninger
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
          <p>Er du i tvivl om din IT-anskaffelse, markedsafdækningen eller risikovurderingen, hjælper din lokale konsulent dig i gang.</p>
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
          <ResourceLink title="Om D-GITA" text="Læs om portalen og processen." />
          <ResourceLink title="Vejledning / FAQ" text="Begreber, funktioner og svar undervejs." />
          <ResourceLink title="Nyttige links" text="KLE, databehandleraftaler og lokale skabeloner." />
          <ResourceLink title="Info fra din kommune" text="Særlige krav og information fra Kalundborg." />
          <ResourceLink title="Ny funktionalitet" text="Se de seneste ændringer i portalen." />
        </div>
        <div className="operation-strip"><span className="operation-dot" /><strong>Normal drift</strong><span>Alle centrale tjenester fungerer</span><button type="button">Se driftstatus <ExternalLink size={15} /></button></div>
      </section>
    </div>
  );
}

function ProcessStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="process-step"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}

function ResourceLink({ title, text }: { title: string; text: string }) {
  return <button className="resource-link" type="button"><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={19} /></button>;
}

function CasesView({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("Alle faser");
  const rows = useMemo(() => cases.filter((item) => {
    const q = query.toLowerCase();
    return (!q || `${item.id} ${item.system}`.toLowerCase().includes(q)) && (phase === "Alle faser" || item.phase === phase);
  }), [query, phase]);

  return (
    <div className="portal-page page-width">
      <PageIntro eyebrow="Din sagsoversigt" title="Mine ansøgninger" text="Følg dine igangværende og historiske IT-anskaffelser, kommentarer, ledergodkendelser og filer.">
        <button className="solid-button" type="button" onClick={onNew}><Plus size={18} /> Opret ansøgning</button>
      </PageIntro>

      <section className="featured-case">
        <div className="featured-case-copy">
          <span className="section-label dark">Senest ændret · ITA-001284</span>
          <h2>WSUS klient</h2>
          <p>Sagen er under behandling hos Peter Bjerre Ahlgren. Lederens godkendelse er registreret.</p>
          <div className="featured-meta"><PhaseTag phase="Under behandling" /><ApprovalTag approval="Godkendt" /><span>Ændret 26-08-2026 kl. 10.57</span></div>
        </div>
        <div className="featured-progress" aria-label="Sagsforløb">
          <span className="done"><Check size={16} /></span><i /><span className="done"><Check size={16} /></span><i /><span className="current">3</span><i /><span>4</span>
        </div>
        <button className="line-button" type="button" onClick={() => onOpen("ITA-001284")}>Åbn sag <ArrowRight size={17} /></button>
      </section>

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

function ConsultantView({ onOpen }: { onOpen: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState("Alle faser");
  const rows = useMemo(() => cases.filter((item) => {
    const q = query.toLowerCase();
    return (!q || `${item.id} ${item.system} ${item.applicant}`.toLowerCase().includes(q)) && (phase === "Alle faser" || item.phase === phase);
  }), [query, phase]);

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

function ApplicationView({ onBack, onSubmit, onToast }: { onBack: () => void; onSubmit: () => void; onToast: (message: string) => void }) {
  const [step, setStep] = useState(0);
  const [knownSystem, setKnownSystem] = useState("ja");
  const [personalData, setPersonalData] = useState("ja");

  return (
    <div className="application-page page-width">
      <div className="application-top"><button className="back-text" type="button" onClick={onBack}><ArrowLeft size={18} /> Mine ansøgninger</button><span><Check size={16} /> Kladden er gemt</span></div>
      <div className="application-title"><div><span className="section-label dark">Ny IT-anskaffelse</span><h1>Opret ansøgning</h1><p>Spørgsmålene følger D-GITA-processen og tilpasses dine svar undervejs.</p></div><div className="application-progress"><strong>{step + 1}</strong><span>af {applicationSteps.length}</span></div></div>

      <div className="application-layout">
        <aside className="application-rail">
          <div className="rail-line" aria-hidden="true" />
          {applicationSteps.map((label, index) => (
            <button className={cx(index === step && "active", index < step && "complete")} type="button" key={label} onClick={() => setStep(index)}>
              <span>{index < step ? <Check size={15} /> : index + 1}</span><strong>{label}</strong>
            </button>
          ))}
          <div className="rail-help"><CircleHelp size={20} /><div><strong>Brug for hjælp?</strong><p>Book et formøde med din lokale konsulent.</p><button type="button" onClick={() => onToast("Formøde er klar til booking")}>Book formøde</button></div></div>
        </aside>

        <section className="application-sheet">
          <div className="sheet-heading"><span>Trin {step + 1}</span><h2>{applicationSteps[step]}</h2><p>{stepDescription(step)}</p></div>
          <div className="sheet-fields">
            {step === 0 ? <>
              <Question title="1. Ved du allerede nu hvilket IT-system du vil indkøbe?" hint="Hvis systemet findes i KITOS, kan flere felter udfyldes automatisk."><Choice value={knownSystem} onChange={setKnownSystem} options={["Ja", "Nej"]} /></Question>
              <Question title="2. Erstatter det et allerede eksisterende IT-system?"><Choice value="nej" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              {knownSystem === "ja" ? <Question title="3. Søg IT-systemnavnet i KITOS" hint="Brug rettighedshaverens officielle navn."><div className="lookup-field"><Search size={18} /><input defaultValue="WSUS klient" /><span><Check size={14} /> Fundet</span></div><div className="lookup-card"><span>WS</span><div><strong>WSUS klient</strong><small>Microsoft · fundet i KITOS</small></div><button type="button">Vælg</button></div></Question> : null}
              <div className="two-column-fields"><Question title="6. Kontaktperson – navn"><input className="clean-input" defaultValue="atlu@kalundborg.dk" /></Question><Question title="7. Center / afdeling"><input className="clean-input" defaultValue="ORG – Digitalisering og IT" /></Question></div>
            </> : null}
            {step === 1 ? <>
              <div className="source-note"><Sparkles size={19} /><div><strong>Systemoplysninger fra KITOS</strong><p>Kontrollér dataene før du går videre.</p></div></div>
              <div className="two-column-fields"><Question title="17. Dataejer" hint="Chef eller leder med ansvar for afdelingens data."><input className="clean-input" defaultValue="peah@kalundborg.dk" /></Question><Question title="18. Systemejer"><input className="clean-input" defaultValue="peah@kalundborg.dk" /></Question></div>
              <div className="two-column-fields"><Question title="19. Kontraktejer"><input className="clean-input" defaultValue="atlu@kalundborg.dk" /></Question><Question title="24. Ansvarlig afdeling / enhed"><input className="clean-input" defaultValue="ORG – Digitalisering og IT" /></Question></div>
              <Question title="22. Indsæt link til sag i ESDH" hint="Gem kontrakt, korrespondance, tjekliste, arkitekturtegning og risikovurdering på sagen."><input className="clean-input" placeholder="https://esdh.kommune.dk/sag/..." /></Question>
            </> : null}
            {step === 2 ? <>
              <Question title="25. Anskaffelsesform" hint="Anskaffelsesformen har betydning for kravspecifikationens detaljeringsgrad."><select className="clean-input" defaultValue="DIGIT udbud/aftale"><option>DIGIT udbud/aftale</option><option>Direkte tildeling</option><option>Gratis</option><option>KOMBIT/KL/Offentligt projekt</option><option>SKI-aftale</option></select></Question>
              <Question title="26. Er der gennemført markedsafdækning?" hint="Har du undersøgt, hvilke løsninger der bedst matcher behov, pris og kvalitet?"><Choice value="ja" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              <Question title="26.1 Hvilke IT-systemer er afdækket?"><textarea className="clean-input" rows={4} defaultValue="System A, System B" /></Question>
              <Question title="27. Nyanskaffelse / tilkøb"><Choice value="nyanskaffelse" onChange={() => undefined} options={["Nyanskaffelse", "Tilkøb"]} /></Question>
            </> : null}
            {step === 3 ? <>
              <Question title="28. Formålsbeskrivelse" hint="Hvorfor er anskaffelsen nødvendig? Beskriv effekt og resultater."><textarea className="clean-input" rows={5} defaultValue="Anskaffelsen skal sikre en stabil og ensartet håndtering af klientopdateringer på tværs af kommunen." /></Question>
              <Question title="29. Funktionsbeskrivelse" hint="Overvej først, om et eksisterende system allerede kan løse opgaven."><textarea className="clean-input" rows={5} defaultValue="Systemet understøtter central distribution, planlægning og dokumentation af opdateringer." /></Question>
              <Question title="30. Hvilke arbejdsprocesser understøttes?" hint="Angiv relevante KLE-emner."><div className="token-field"><span>Digital drift <button type="button"><X size={13} /></button></span><span>Systemadministration <button type="button"><X size={13} /></button></span><button type="button"><Plus size={15} /> Tilføj KLE-emne</button></div></Question>
              <Question title="32. Kan andre centre eller teams have gavn af funktionaliteten?"><Choice value="ja" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
            </> : null}
            {step === 4 ? <>
              <Question title="33. Er der et eksisterende budget at købe for?"><Choice value="ja" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              <div className="finance-overview"><span>Samlet finansiering</span><strong>300,00 kr.</strong><small>Beregnet ud fra felterne nedenfor</small></div>
              <div className="three-column-fields"><Question title="34. Engangsomkostninger"><Money value="100,00" /></Question><Question title="35. Årlige driftsudgifter"><Money value="100,00" /></Question><Question title="36. Andre omkostninger"><Money value="100,00" /></Question></div>
              <Question title="38. Beskrivelse af gevinsten"><textarea className="clean-input" rows={4} defaultValue="Mere ensartet drift, færre manuelle opgaver og bedre dokumentation." /></Question>
            </> : null}
            {step === 5 ? <>
              <Question title="Har du allerede lavet en risikovurdering?" hint="Risikovurderingen skal bruges, før ansøgningen kan vurderes."><Choice value="nej" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              <Question title="Har du brug for hjælp til risikovurdering?"><Choice value="ja" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              <Question title="43. Behandler IT-systemet persondata?"><Choice value={personalData} onChange={setPersonalData} options={["Ja", "Nej"]} /></Question>
              {personalData === "ja" ? <><Question title="44. Har du allerede en databehandleraftale?"><Choice value="nej" onChange={() => undefined} options={["Ja", "Nej"]} /></Question><Question title="41. Klassifikation af data"><select className="clean-input" defaultValue="3. Fortrolige oplysninger"><option>1. Almindelige personoplysninger</option><option>2. Følsomme personoplysninger</option><option>3. Fortrolige oplysninger</option><option>4. CPR data</option></select></Question></> : null}
              <div className="upload-field"><Upload size={22} /><div><strong>Upload risikovurdering</strong><small>PDF, DOCX eller XLSX · maks. 25 MB</small></div><button type="button">Vælg fil</button></div>
            </> : null}
            {step === 6 ? <>
              <Question title="45. Milepæle" hint="Vælg de vigtige kontrolpunkter i forløbet."><div className="token-field green"><span><Check size={14} /> Kontraktindgåelse</span><span><Check size={14} /> Test</span><button type="button"><Plus size={15} /> Tilføj</button></div></Question>
              <Question title="48. Ressourcetræk i forbindelse med implementering"><textarea className="clean-input" rows={4} defaultValue="Projektledelse, teknisk opsætning, test, brugerstyring og uddannelse." /></Question>
              <div className="two-column-fields"><Question title="46. Forventet startdato"><input type="date" className="clean-input" defaultValue="2026-09-18" /></Question><Question title="47. Forventet slutdato"><input type="date" className="clean-input" defaultValue="2026-10-09" /></Question></div>
              <Question title="49. Antal brugere"><select className="clean-input" defaultValue="500-100000"><option>0-9</option><option>10-49</option><option>50-99</option><option>100-499</option><option>500-100000</option></select></Question>
            </> : null}
            {step === 7 ? <>
              <div className="requirement-alert"><Info size={20} /><div><strong>Én oplysning mangler</strong><p>Arkitekturtegningen er nødvendig, før sagen kan færdigbehandles.</p></div></div>
              <Question title="50. Er der indhentet arkitekturtegning og beskrivelse af IT-systemets sammenhænge?" hint="Materialet kan fås hos leverandøren."><Choice value="nej" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              <Question title="51. Er bilaget ‘Tjekliste til leverandør’ udfyldt og journaliseret i ESDH?"><Choice value="ja" onChange={() => undefined} options={["Ja", "Nej"]} /></Question>
              <div className="upload-field"><Paperclip size={22} /><div><strong>Vedhæft arkitekturtegning</strong><small>Dokumentet knyttes til sagen og kvitteringen</small></div><button type="button">Vælg fil</button></div>
            </> : null}
            {step === 8 ? <>
              <Question title="52. Angiv chef" hint="Lederen modtager en godkendelsesmail i Outlook."><div className="selected-person"><span>PB</span><div><strong>Peter Bjerre Ahlgren</strong><small>Godkendende leder</small></div><button type="button">Skift</button></div></Question>
              <Question title="53. Har du andre relevante bemærkninger?"><textarea className="clean-input" rows={5} placeholder="Tilføj eventuelle bemærkninger..." /></Question>
              <div className="outlook-note"><Mail size={20} /><div><strong>Godkendelsen sendes via Outlook</strong><p>Lederen får et versionslåst beslutningsgrundlag og et direkte link til sagen.</p></div></div>
            </> : null}
            {step === 9 ? <ReviewApplication /> : null}
          </div>
          <div className="sheet-footer">
            <button className="line-button" type="button" onClick={() => onToast("Kladden er gemt")}>Gem kladde</button>
            <div>{step > 0 ? <button className="text-nav-button" type="button" onClick={() => setStep(step - 1)}><ArrowLeft size={17} /> Forrige</button> : null}{step < applicationSteps.length - 1 ? <button className="solid-button" type="button" onClick={() => setStep(step + 1)}>Fortsæt <ArrowRight size={17} /></button> : <button className="solid-button green" type="button" onClick={onSubmit}><Send size={17} /> Gem og indsend</button>}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

function stepDescription(step: number) {
  return [
    "Vi starter med at afklare systemet, kontaktpersonen og organisationen.",
    "Angiv ansvar for data, system, kontrakt og den tilhørende ESDH-sag.",
    "Beskriv hvordan systemet anskaffes, og hvordan markedet er undersøgt.",
    "Gør det tydeligt, hvilken forandring og værdi systemet skal skabe.",
    "Saml omkostninger, budget og forventede gevinster.",
    "Vurdér risiko, persondata og behovet for en databehandleraftale.",
    "Planlæg milepæle, ressourcer, datoer og antal brugere.",
    "Dokumentér arkitektur, leverandørkrav og systemets sammenhænge.",
    "Vælg den godkendende chef, og tilføj eventuelle bemærkninger.",
    "Kontrollér oplysningerne, før ansøgningen låses og sendes.",
  ][step];
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <div className="question"><div className="question-copy"><label>{title}</label>{hint ? <p>{hint}</p> : null}</div>{children}</div>;
}

function Choice({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <div className="choice-row">{options.map((option) => { const id = option.toLowerCase(); return <button className={value === id ? "selected" : ""} type="button" key={option} onClick={() => onChange(id)}><span>{value === id ? <Check size={14} /> : null}</span>{option}</button>; })}</div>;
}

function Money({ value }: { value: string }) {
  return <div className="money-field"><span>DKK</span><input defaultValue={value} /></div>;
}

function ReviewApplication() {
  const rows = [
    ["System", "WSUS klient · fundet i KITOS"],
    ["Organisation", "ORG – Digitalisering og IT"],
    ["Anskaffelsesform", "DIGIT udbud/aftale"],
    ["Persondata", "Ja · fortrolige oplysninger"],
    ["Samlet finansiering", "300,00 kr."],
    ["Implementering", "18. september – 9. oktober 2026"],
    ["Godkendende chef", "Peter Bjerre Ahlgren"],
  ];
  return <div className="review-block"><div className="review-status"><CheckCircle2 size={25} /><div><strong>Klar til indsendelse</strong><p>Der oprettes en versionslåst PDF-kvittering, som sendes til din Outlook.</p></div></div>{rows.map(([label, value]) => <div className="review-line" key={label}><span>{label}</span><strong>{value}</strong><button type="button">Redigér</button></div>)}<label className="consent-check"><input type="checkbox" defaultChecked /><span><Check size={14} /></span>Jeg har kontrolleret oplysningerne og de vedlagte bilag.</label></div>;
}

function CaseDetail({ item, onBack, onToast }: { item: CaseRecord; onBack: () => void; onToast: (message: string) => void }) {
  const [tab, setTab] = useState("overblik");
  return (
    <div className="detail-page page-width">
      <button className="back-text" type="button" onClick={onBack}><ArrowLeft size={18} /> Mine ansøgninger</button>
      <section className="case-title-block">
        <div><span className="section-label dark">{item.id} · {item.municipality} Kommune</span><h1>{item.system}</h1><div className="case-title-meta"><PhaseTag phase={item.phase} /><span>Ændret {item.changed}</span></div></div>
        <div><button className="line-button" type="button" onClick={() => onToast("Kvitteringen er klar til download")}><Download size={17} /> Hent kvittering</button><button className="solid-button" type="button" onClick={() => onToast("En Outlook-mail er lagt i afsendelseskøen")}><Mail size={17} /> Send statusmail</button></div>
      </section>

      <CaseJourney active={item.phase} />

      <nav className="detail-tabs" aria-label="Sagens indhold">
        {["overblik", "ansøgning", "filer", "kommentarer", "historik"].map((name) => <button className={tab === name ? "active" : ""} type="button" key={name} onClick={() => setTab(name)}>{name === "overblik" ? <LayoutGrid size={17} /> : name === "ansøgning" ? <FileText size={17} /> : name === "filer" ? <Paperclip size={17} /> : name === "kommentarer" ? <MessageSquare size={17} /> : <History size={17} />}{name}<span>{name === "filer" ? "3" : name === "kommentarer" ? "0" : ""}</span></button>)}
      </nav>

      {tab === "overblik" ? <CaseOverview item={item} onToast={onToast} /> : null}
      {tab === "ansøgning" ? <ApplicationSnapshot /> : null}
      {tab === "filer" ? <FileList onToast={onToast} /> : null}
      {tab === "kommentarer" ? <Comments onToast={onToast} /> : null}
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

function ApplicationSnapshot() {
  const sections = ["Generelle oplysninger", "Systemoplysninger", "System og anskaffelsesform", "Værdi for kommunen", "Investering", "Risikovurdering", "Databehandleraftale", "Implementering", "IT-krav", "Øvrige"];
  return <section className="snapshot plain-section"><div className="plain-heading"><span className="section-label dark">Indsendt version</span><h2>Ansøgningens indhold</h2><span className="locked"><LockKeyhole size={15} /> Version 3 · låst</span></div>{sections.map((section, index) => <button type="button" key={section}><span>{String(index + 1).padStart(2, "0")}</span><strong>{section}</strong><small>{index === 8 ? "1 opmærksomhedspunkt" : "Udfyldt"}</small><ChevronRight size={18} /></button>)}</section>;
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

function AdminView({ onToast }: { onToast: (message: string) => void }) {
  const [tab, setTab] = useState("integrationer");
  return <div className="portal-page page-width"><PageIntro eyebrow="Administration" title="Portal og workflows" text="Administrér formular, mailkvitteringer, integrationer og kommunespecifik information." />
    <nav className="admin-nav">{[["integrationer", "Integrationer"], ["formular", "Formular"], ["mail", "Mail & kvitteringer"], ["kommune", "Info fra kommunen"]].map(([id, label]) => <button className={tab === id ? "active" : ""} type="button" key={id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab === "integrationer" ? <div className="admin-layout"><section className="plain-section"><div className="plain-heading"><span className="section-label dark">Systemforbindelser</span><h2>Integrationer</h2></div><div className="integration-list"><Integration icon={Mail} title="Microsoft Outlook" detail="Kvitteringer og godkendelsesmails" status="Normal drift" /><Integration icon={LayoutGrid} title="KITOS" detail="Systemkatalog og organisationsopslag" status="Normal drift" /><Integration icon={FolderOpen} title="Dokumentlager" detail="Bilag og versionslåste PDF-filer" status="Normal drift" /><Integration icon={Inbox} title="ESDH" detail="Journalreferencer og arkivering" status="1 job i kø" /></div></section><aside className="security-panel"><ShieldCheck size={27} /><span className="section-label">Sikkerhed</span><h2>Server-side som standard</h2><p>Graph-tokens, mailadgang og andre secrets må aldrig sendes til browseren. Alle handlinger auditeres og bindes til tenant, bruger og version.</p><ul><li><Check size={15} /> Ingen secrets i klientkode</li><li><Check size={15} /> Versionsbundne godkendelser</li><li><Check size={15} /> Tenant-adskilte data</li></ul></aside></div> : null}
    {tab === "formular" ? <section className="plain-section admin-table-section"><div className="plain-heading"><span className="section-label dark">Publiceret version 12</span><h2>Formularens sektioner</h2><button className="solid-button" type="button" onClick={() => onToast("Ny formularversion er oprettet")}><Plus size={17} /> Ny version</button></div>{applicationSteps.slice(0, -1).map((name, index) => <div className="admin-form-row" key={name}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><small>{index === 0 ? "7 felter · 4 betingede regler" : `${3 + index} felter · aktiv`}</small></div><button type="button"><MoreHorizontal size={19} /></button></div>)}</section> : null}
    {tab === "mail" ? <div className="admin-layout"><section className="plain-section"><div className="plain-heading"><span className="section-label dark">Outlook</span><h2>Mail og kvitteringer</h2></div>{[["Ansøgning indsendt", "application.submitted"], ["Ny sag til visitering", "application.received"], ["Ledergodkendelse", "approval.requested"], ["Godkendelse registreret", "approval.completed"], ["Information mangler", "information.requested"], ["Sag afsluttet", "application.closed"]].map(([name, event]) => <div className="mail-template-row" key={event}><Mail size={18} /><div><strong>{name}</strong><code>{event}</code></div><span>Aktiv</span><button type="button"><ChevronRight size={18} /></button></div>)}</section><aside className="mail-receipt"><div className="receipt-sender"><span>DG</span><div><strong>D-GITA</strong><small>dgita@kalundborg.dk</small></div></div><small>Ansøgning ITA-001284 er modtaget</small><h3>Tak — din ansøgning er indsendt</h3><p>Din ansøgning om <strong>WSUS klient</strong> er sendt til D-GITA.</p><dl><div><dt>Sagsnummer</dt><dd>ITA-001284</dd></div><div><dt>Fase</dt><dd>Indsendt</dd></div></dl><button type="button">Åbn din sag</button><p>Din PDF-kvittering er vedhæftet.</p><button className="line-button full" type="button" onClick={() => onToast("Previewmail er sendt til Outlook")}><Send size={17} /> Send preview</button></aside></div> : null}
    {tab === "kommune" ? <section className="plain-section municipality-info"><div className="plain-heading"><span className="section-label dark">Kalundborg Kommune</span><h2>Lokalt indhold</h2><button className="line-button" type="button" onClick={() => onToast("Kommuneinformationen er gemt")}>Gem ændringer</button></div><Question title="Lokal D-GITA-konsulent"><input className="clean-input" defaultValue="Casper Kjeldsen Ravn" /></Question><Question title="Kontaktmail"><input className="clean-input" defaultValue="ckra@kalundborg.dk" /></Question><Question title="Info fra din kommune"><textarea className="clean-input" rows={7} defaultValue="Her kan kommunen beskrive lokale arbejdsgange, links til risikovurdering, ESDH-praksis og relevante skabeloner." /></Question></section> : null}
  </div>;
}

function Integration({ icon: Icon, title, detail, status }: { icon: LucideIcon; title: string; detail: string; status: string }) {
  return <div className="integration-row"><span><Icon size={20} /></span><div><strong>{title}</strong><small>{detail}</small></div><em className={status.includes("kø") ? "waiting" : "healthy"}><i />{status}</em><button type="button"><Settings2 size={18} /></button></div>;
}
