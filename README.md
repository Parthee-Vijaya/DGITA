# D-GITA Workspace

En moderne, interaktiv portal til kommunale IT-anskaffelser. Løsningen samler ansøgning, sagsbehandling, ledergodkendelse, dokumentation, kvitteringer og administration i ét responsivt workspace.

De indlæste startsager er fiktive, mens systemopslaget er genereret fra de udleverede KITOS- og Kalundborg-oversigter. D1 er det autoritative datalager, og dokumentbytes gemmes privat i R2. Portalen sender endnu ikke rigtige Outlook-mails.

## Formularmotor

Ansøgningsformularen har ti trin og én samlet, typesikker kladde. Motoren indeholder:

- dokumenterede synligheds- og kravregler fra Power Pages-formularen
- betingede underspørgsmål for bl.a. erstatningssystem, markedsafdækning, tilkøb, budget, persondata og tværgående funktionalitet
- fem dokumentflows for risikovurdering, databehandleraftale, kontrakt, leverandørtjekliste og arkitektur
- brugerejede kladder i D1 og validerede dokumentuploads med kontrolsum i R2
- versionslåst snapshot, bilagsmanifest og auditpost ved indsendelse
- trinvalidering, låst fremadnavigation og dynamisk gennemgang før indsendelse
- dansk beløbsformat, beregnet total og kontrol af implementeringsdatoer
- udeladelse af skjulte svar og fejlede bilag fra indsendelsessnapshot

Systemkataloget indeholder 4.656 KITOS-poster. De 420 Kalundborg-systemer er koblet entydigt på UUID og markeres særskilt i søgeresultaterne. Lokale kaldenavne og tidligere navne kan bruges i fritekstsøgningen, men anvendes aldrig som join-nøgle.

## Roller, adgang og admin

Portalen har præcis tre roller. I det lokale testmiljø kan de vælges i topbaren:

- Bruger: opretter ansøgninger og ser kun sager, der matcher brugerens stabile ejer-id og tenant
- D-GITA-konsulent: ser kommunens arbejdskø, kommenterer konkrete ansøgningsfelter og udfylder de separate D-GITA-godkendelsesfelter
- Admin: har alle konsulent- og brugerfunktioner samt et redigerbart indholdsmodul

Adminmodulet håndterer portaltekster, formularhjælp, hele FAQ-listen, generelle og kommunale links, databehandlerkrav, formularversioner samt mail- og integrationsopsætning. Indholdsændringer slår direkte igennem på forsiden, formularens centrale hjælpetekster og den søgbare vejledningsside.

D-GITA-godkendelsen følger felterne fra Power Pages-kilden: godkendelse, dato, lovgrundlag, ansvarlige, IT-konsulent, infrastrukturændring, bemærkninger, interne kommentarer og fase. Ekstra ansvarlig vises betinget. Interne kommentarer eksponeres ikke i brugerens projektion eller kvittering.

Rolledropdownen er kun en testmekanisme, men hvert skift opretter en ny servervalideret session. Rolle, kommune og ejer kontrolleres igen i API og database. Testlogin er automatisk deaktiveret uden for localhost, medmindre det aktiveres eksplicit. Providerkonfigurationen er klargjort til Fælleskommunal Adgangsstyring og Microsoft Entra ID.

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

## Drift

Cloudflare/Sites-runtime med D1 og R2 er den autoritative driftsmodel. Hele det normaliserede systemkatalog er committed som JSON, så katalogsøgningen ikke afhænger af lokale Excel-filer. Et eventuelt Vercel-preview er ikke en funktionel driftsudgave, medmindre det senere får en tilsvarende database- og filadapter.

## Verifikation

```bash
npm run lint
npm test
```

`npm test` bygger projektet og kontrollerer det server-renderede portalindhold, formularregler, filpolitik, beløbs- og datovalidering samt katalogets 4.656/420-fordeling.

## Fra prototype til drift

Den anbefalede rækkefølge for næste fase er:

1. Forbind Fælleskommunal Adgangsstyring eller Microsoft Entra ID til den eksisterende provider- og sessionsmodel.
2. Tilføj virusscanning og retention-politik til R2-uploadflowet; kontrolsum og versionslåsning er implementeret.
3. Opret PDF-kvittering og en idempotent mail-outbox med statusserne `queued`, `sent` og `failed`.
4. Forbind Microsoft Graph til Outlook-godkendelser uden secrets i browseren.
5. Tilføj auditspor, ESDH-journalisering og integrationstests for hele ansøgning → godkendelse → kvittering-flowet.
