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

## Roller, adgang og admin

Prototypen har præcis tre testroller, som kan vælges i topbaren:

- Bruger: opretter ansøgninger og ser kun sager, der matcher brugerens stabile ejer-id og tenant
- D-GITA-konsulent: ser kommunens arbejdskø, kommenterer konkrete ansøgningsfelter og udfylder de separate D-GITA-godkendelsesfelter
- Admin: har alle konsulent- og brugerfunktioner samt et redigerbart indholdsmodul

Adminmodulet håndterer portaltekster, formularhjælp, hele FAQ-listen, generelle og kommunale links, databehandlerkrav, formularversioner samt mail- og integrationsopsætning. Indholdsændringer slår direkte igennem på forsiden, formularens centrale hjælpetekster og den søgbare vejledningsside.

D-GITA-godkendelsen følger felterne fra Power Pages-kilden: godkendelse, dato, lovgrundlag, ansvarlige, IT-konsulent, infrastrukturændring, bemærkninger, interne kommentarer og fase. Ekstra ansvarlig vises betinget. Interne kommentarer eksponeres ikke i brugerens projektion eller kvittering.

Rolledropdownen er kun en testmekanisme. Den er ikke en produktionsmæssig sikkerhedsgrænse, fordi demoens fiktive data ligger i klienten. En driftsudgave skal udlede identitet, rolle, tenant og ejer server-side fra Fælleskommunal Adgangsstyring eller kommunens Entra ID og gentage alle adgangskontroller i API/database.

## Vejledning og FAQ

Den nye vidensside samler indholdet fra den eksisterende portal i et moderne, responsivt bibliotek med søgning og fold-ud-svar:

- D-GITA-forløbet og konsulentens rolle
- kladde og indsendelse
- korrekte ESDH-sagstyper og handlingsfacetter
- udbudsgrænse, kontrakt, databehandleraftale og risikovurdering
- leverandørtjekliste og AI-støtte til DBA
- den fulde FAQ-liste
- Datatilsynet, KLE, KOMBIT, Virk, KITOS og Kalundborgs interne KAI-link

Alt indhold ligger i det samme versionsmærkede indholdsregister og kan redigeres eller afpubliceres af Admin uden at ændre formularens tekniske feltnøgler eller betingelseslogik.

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

1. Forbind Fælleskommunal Adgangsstyring eller Microsoft Entra ID, og bind kladder/bilag til bruger, rolle og tenant frem for den nuværende sessionscookie.
2. Tilføj checksum, virusscanning, retry og retention-politik til R2-uploadflowet.
3. Opret PDF-kvittering og en idempotent mail-outbox med statusserne `queued`, `sent` og `failed`.
4. Forbind Microsoft Graph til Outlook-godkendelser uden secrets i browseren.
5. Tilføj auditspor, ESDH-journalisering og integrationstests for hele ansøgning → godkendelse → kvittering-flowet.
