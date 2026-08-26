# D-GITA systemkatalog

`system-catalog.json` er den komplette, deploybare runtimekilde til systemopslaget. Vercel-buildet har derfor ingen afhængighed til lokale Excel-filer.

Kataloget er normaliseret fra:

- `IT Systemkatalog Overblik.xlsx`: 4.656 unikke KITOS-systemer
- `IT Systemer Overblik.xlsx`: 420 Kalundborg-systemer koblet til KITOS via UUID

Hver post indeholder de felter, løsningen bruger til søgning og visning: KITOS-id, officielt navn, leverandør, rettighedshaver, kilde, kommunal anvendelse, matchmetode, lokale aliaser/system-id'er og status i KITOS/Kalundborg. Alle 420 kommunale match er markeret med `source: "both"` og `matchConfidence: "exact-id"`.

Rå regnearkskolonner, som ikke anvendes af løsningen, og administrative placeholderværdier er bevidst ikke kopieret til webkataloget. De oprindelige `.xlsx`-filer versionsstyres ikke, så unødvendige interne oplysninger ikke publiceres sammen med webappen.
