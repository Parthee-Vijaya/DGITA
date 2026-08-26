# D-GITA Workspace

En moderne, interaktiv prototype til kommunale IT-anskaffelser. Løsningen samler ansøgning, sagsbehandling, ledergodkendelse, dokumentation, kvitteringer og administration i ét responsivt workspace.

Sagsdata er fiktive, mens systemopslaget er genereret fra de udleverede KITOS- og Kalundborg-oversigter. I Cloudflare/Sites-runtime gemmes kladder i D1 og dokumentbytes i R2. I et Vercel-preview uden tilkoblet database eller objektlager anvendes en tydeligt markeret IndexedDB-fallback på den aktuelle enhed. Prototypen sender endnu ikke rigtige Outlook-mails.

## Formularmotor

Ansøgningsformularen har ti trin og én samlet, typesikker kladde. Motoren indeholder:

- dokumenterede synligheds- og kravregler fra Power Pages-formularen
- betingede underspørgsmål for bl.a. erstatningssystem, markedsafdækning, tilkøb, budget, persondata og tværgående funktionalitet
- fem dokumentflows for risikovurdering, databehandleraftale, kontrakt, leverandørtjekliste og arkitektur
- vedvarende kladder i D1 og validerede dokumentuploads i R2 samt lokal preview-fallback
- trinvalidering, låst fremadnavigation og dynamisk gennemgang før indsendelse
- dansk beløbsformat, beregnet total og kontrol af implementeringsdatoer
- udeladelse af skjulte svar og fejlede bilag fra indsendelsessnapshot

Systemkataloget indeholder 4.656 KITOS-poster. De 420 Kalundborg-systemer er koblet entydigt på UUID og markeres særskilt i søgeresultaterne. Lokale kaldenavne og tidligere navne kan bruges i fritekstsøgningen, men anvendes aldrig som join-nøgle.

## Roller og flows

- Ansøger: overblik, guidet ansøgning i ti trin, sagsstatus, filer og dialog
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

## Vercel-preview

Repoet indeholder en eksplicit `vercel.json`, som bygger løsningen med Next.js. Hele det normaliserede systemkatalog er committed som JSON, så katalogsøgningen ikke afhænger af lokale Excel-filer.

Uden en tilkoblet database og filstorage gemmer previewet kladder og dokumentbytes lokalt i browserens IndexedDB. Data er dermed knyttet til den aktuelle browser/enhed, og lokal indsendelse bliver ikke præsenteret som sendt til D-GITA. En driftsudgave på Vercel skal have en serverbaseret database og direkte objektlager-upload.

## Verifikation

```bash
npm run lint
npm test
```

`npm test` bygger projektet og kontrollerer det server-renderede portalindhold, formularregler, filpolitik, beløbs- og datovalidering samt katalogets 4.656/420-fordeling.

## Fra prototype til drift

Den anbefalede rækkefølge for næste fase er:

1. Forbind Microsoft Entra ID, og bind kladder/bilag til bruger, rolle og tenant frem for den nuværende sessionscookie.
2. Tilføj checksum, virusscanning, retry og retention-politik til R2-uploadflowet.
3. Opret PDF-kvittering og en idempotent mail-outbox med statusserne `queued`, `sent` og `failed`.
4. Forbind Microsoft Graph til Outlook-godkendelser uden secrets i browseren.
5. Tilføj auditspor, ESDH-journalisering og integrationstests for hele ansøgning → godkendelse → kvittering-flowet.
