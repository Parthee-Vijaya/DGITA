# D-GITA Workspace

En moderne, interaktiv prototype til kommunale IT-anskaffelser. Løsningen samler ansøgning, sagsbehandling, ledergodkendelse, dokumentation, kvitteringer og administration i ét responsivt workspace.

Prototypen bruger kun fiktive data og simulerer integrationer lokalt. Den sender ikke rigtige mails og gemmer ikke personoplysninger.

## Roller og flows

- Ansøger: overblik, guidet ansøgning i syv trin, sagsstatus, filer og dialog
- D-GITA-konsulent: arbejdsbakke, prioritering, sagsbehandling og interne felter
- Leder: versionslåst beslutningsgrundlag, godkendelse eller tilbagesendelse
- Administrator: formularfelter, mailtemplates, kommuner, audit og integrationsstatus
- Outlook: simulerede indsendelses-, påmindelses-, godkendelses- og afslutningskvitteringer

Skift rolle i topbaren for at gennemgå hele prototypen.

## Lokal kørsel

Kræver Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Åbn derefter [http://localhost:3000](http://localhost:3000).

## Verifikation

```bash
npm run lint
npm test
```

`npm test` bygger projektet og kontrollerer det server-renderede portalindhold samt centrale produktkrav.

## Fra prototype til drift

En produktionsudgave bør koble brugerfladen til en tenant-adskilt database, objektlager til bilag, Microsoft Entra ID til login og Microsoft Graph til Outlook. Graph-tokens og andre secrets skal udelukkende opbevares og anvendes server-side. Statusændringer, godkendelser og mails bør håndteres som idempotente, auditerede workflows med retries.
