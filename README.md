# F1 · Grand Prix

Fristående svensk F1-applikation med React/Vite/TypeScript, Express och SQLite (`better-sqlite3`). Jolpica är enda externa datakällan. Inga konton eller betaltjänster.

## Lokal utveckling på Windows

Öppna projektmappen i VS Code och kör i PowerShell med Node.js 24 LTS:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Öppna adressen Vite visar, normalt http://localhost:5180. Backend kör lokalt på port 3107 enligt `.env.example`. `PORT` i `.env` används även av Vites proxy. SQLite skapas automatiskt i `data/f1.sqlite`. Första hämtningen kan ta någon minut eftersom även föregående säsongs resultat verifieras. Ingen exempeldata visas i applikationen.

Välj vid behov andra lediga portar med `PORT` (backend) och `VITE_PORT` (frontend) i `.env` och starta om utvecklingskommandot. Vite avslutar med ett tydligt fel om den valda porten är upptagen. Vites proxy använder `localhost` för att nå samma backend även när Windows skiljer på IPv4 och IPv6.

`npm.cmd test` kör logik-, tidszons-, cache- och backuptester. `npm.cmd run build` typkontrollerar och bygger båda delarna. `npm.cmd start` serverar det färdiga bygget via Express på http://localhost:3107 med den lokala `.env`-filen. Docker använder fortsatt intern port 3000.

## Struktur och API

Livekortet använder en gemensam backendanslutning till F1:s inofficiellt dokumenterade SignalR-flöde via SSE på `https://livetiming.formula1.com/signalrcore`. Ingen API-avgift, ny paketinstallation eller separat tjänst har lagts till. Protokollet har undersökts med https://github.com/julesr0y/f1-livetiming-api som referens; projektets kod eller paket har inte installerats. Åtkomst och format kan ändras.

`GET /api/live` returnerar position, förarkod och stall. Frontend läser denna endpoint var femte sekund medan översikten visas; besökare startar inga egna anslutningar till F1. Live kräver matchande Grand Prix, sessionstyp Race, status Started, giltiga positionsrader och ett Heartbeat yngre än 45 sekunder. Annars döljs positionsraderna och kortet visar vänteläge, inaktuella data eller anslutningsfel. Avbrutna anslutningar återansluts efter 30 sekunder. Data ligger endast i minnet. Backend behöver kunna hålla en utgående HTTPS/SSE-anslutning öppen. Ingen Docker-konfiguration eller produktionsmiljö har ändrats för detta tillägg.

- `client/`: startsida, sessionsschema, nedräkning och mästerskapsflikar.
- `server/jolpica.ts`: integration, validering och normalisering.
- `server/cache.ts`: en SQLite-tabell med JSON-värde och lyckad uppdateringstid per nyckel, WAL-läge.
- `server/service.ts`: uppdateringar och val av nästa lopp.
- `shared/`: datamodeller och svensk tidsformatering.
- `GET /api/dashboard`: cachad kalender, nästa lopp, WDC/WCC, status och uppdateringstider.
- `GET /api/health`: processens och databasens tillgänglighet; innebär inte att Jolpica är tillgängligt.

Backend uppdaterar på egen timer; besökare utlöser inga Jolpica-anrop. Kalender hämtas var 12:e timme och tabeller var 6:e timme, eller var 30:e minut under aktuell helg. Efter planerad racestart kontrolleras resultat var 5:e minut. Bekräftade resultat sparas permanent. Anrop görs sekventiellt med minst 1,1 sekunders mellanrum och 15 sekunders timeout. Fel behåller sparad data och försöks igen tidigast efter 5 minuter. Intervaller konfigureras i `.env.example`; timern har en minuts upplösning. Frontend läser backend varje minut och räknar ned lokalt varje sekund.

Kalenderåret väljs dynamiskt. Föregående års oavslutade kalender behålls över nyår. Efter finalen kan nästa års publicerade kalender visas, medan tabellerna behåller sin tydligt märkta säsong. Under uppehåll visas nästa publicerade helg.

**Databegränsningar:** Jolpica har inget säkert fält för inställt, pågående eller uppskjutet lopp. Lopp som tas bort ur kalendern försvinner vid kalenderuppdatering. Ändrade tider slår igenom då. Om ett inställt/uppskjutet lopp ligger kvar utan resultat behålls helgen med väntestatus; applikationen gissar inte att den är avslutad. Manuell hantering kan behövas om källan aldrig korrigeras. Saknade starttider visas som opublicerade och används inte för nedräkning. En planerad racestart som passerats betyder endast att resultat inväntas.

## Docker – förberett, ingen automatisk deployment

Planerad produktionsadress: **https://f1.mikaelstenberg.com**. Detta är måladressen för en framtida, separat godkänd deployment; DNS, proxy host och HTTPS-certifikat är inte konfigurerade eller verifierade genom denna dokumentation.

Projektet använder befintliga konfigurationsfiler och behöver ingen separat produktionsmall. `.env` är den aktiva lokala konfigurationen och `.env.example` är mallen utan hemligheter. `compose.yaml` anger containerns produktionsvärden: `PORT=3000` och `DATABASE_PATH=/app/data/f1.sqlite`. Utvecklingsportarna `PORT=3107` och `VITE_PORT=5180` används inte i Docker. Compose läser övriga angivna inställningar från miljön eller `.env`, med standardvärden i Compose-filen. `PROXY_NETWORK` ska motsvara det befintliga nätverk som Nginx Proxy Manager använder.

En multi-stage-image med Node.js 24 kör Express och byggd frontend som användaren `node`. Compose ansluter endast till ett befintligt externt nätverk, standard `proxy`. Ange det faktiska nätverksnamnet i `PROXY_NETWORK` före deployment. Inga värdportar publiceras och inga gemensamma tjänster ändras. Containerns port 3000 är tillgänglig på nätverket. Nginx Proxy Manager behöver vid en separat godkänd konfiguration peka på tjänsten `f1`, HTTP-port 3000. Domän och HTTPS konfigureras separat av serverägaren.

För en uttryckligen godkänd deployment: verifiera först projekt, branch/commit, faktisk nätverkskonfiguration och `.env`. Lokal konfigurationskontroll är `docker compose config --quiet`. `docker compose up -d --build f1` bygger imagen och skapar/återskapar endast appens container. Granska sedan healthcheck, loggar och webbsidan. Dessa kommandon ska inte köras som del av en vanlig lokal kodändring. Ingen MariaDB används och inga produktionsmigrationer finns.

De namngivna volymerna `f1_data` och `f1_backups` innehåller databas respektive backup och överlever containeruppdateringar. Bevara Compose-projektnamnet så samma volymer återanvänds. Radera aldrig volymer vid uppdatering. Säkerhetskopior på samma server behöver även kopieras till annan lagringsplats.

## Konsistent backup

Lokalt, medan databasen används:

```powershell
npm.cmd run backup -- ./backups/f1-2026-10-25.sqlite
```

Ange ett nytt filnamn varje gång. SQLite Online Backup API används; databasen inklusive WAL kopieras konsistent. En befintlig målfil skrivs aldrig över.

Motsvarande manuella, separat godkända steg i Docker är `docker compose exec f1 node dist/server/backup.js /app/backups/NYTT-FILNAMN.sqlite`. Kopiera därefter backupfilen från backupvolymen till separat lagring. Återställning ska planeras separat och aldrig skriva över en körande databas.

API-dokumentation: https://api.jolpi.ca/docs/ . Projektet har ingen koppling till Formula 1 eller FIA.

## Genomförd lokal verifiering

Typkontroll och produktionsbygge har körts. Automatiska tester omfattar normala/sprinthelger, saknade tider, felaktig kalender, båda svenska tidsomställningarna, nedräkning, resultatstyrt loppbyte, nyår/säsongsslut, cache vid API-fel, samtidiga uppdateringar samt persistent SQLite och konsistent backup. Riktiga kalender-, resultat-, WDC- och WCC-svar har hämtats och använts lokalt. Gränssnittet har kontrollerats i webbläsare på desktop och mobil (390 px), inklusive flikväxling och avsaknad av horisontell overflow. Produktionsservern har inte kontaktats.

Docker finns inte installerat i verifieringsmiljön: `docker compose config`, imagebygge, containerstart, volymrättigheter och proxyanslutning återstår att verifiera i en Docker-miljö. Ingen deployment har utförts.
