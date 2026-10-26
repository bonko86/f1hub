# Verifierad deployment 2026-10-26

## Publicerad version och miljö

- Applikationskälla: GitHub `bonko86/f1hub`, `main`, commit `9a3afd886240fd8e7cf50f03e169e8651706e7a2`.
- Publik adress: https://f1.mikaelstenberg.com . HTTPS och befintlig proxy fungerade vid kontrollen; agenten ändrade inte DNS, Nginx Proxy Manager eller certifikat.
- Projekt/container: `f1-hubb`; tjänst `f1`; intern port 3000; nätverk `proxy-net`; inga publicerade hostportar.
- F1-containern rapporterade `running`, `healthy`, restart count 0.
- Slutlig image: `sha256:ff16d9183e426c9935adc1df4e6fb9c445c3e5bd6cdba1309b5639ac44ac1abd` (`f1-hubb:current`).
- Volymer: `f1-hubb_f1_data` och `f1-hubb_f1_backups`.

## Genomförda kontroller

- Administratören installerade det granskade paketet med `deploy/production/install.sh`; ingen generell sudo/Docker-grupp gavs till SSH-kontot.
- Första deploymenten skapade F1-containern och dess två deklarerade volymer. Ingen befintlig F1-container fanns före installationen.
- Lokal typkontroll, produktionsbuild och 12 tester godkända.
- Linux-image byggd på servern med befintlig skyddad Dockerfile. Inga images/versionstaggar i Dockerfile ändrades.
- Healthcheck samt `/api/health`, `/api/dashboard`, `/api/live` svarade HTTP 200.
- Intern HTTP via Docker-DNS `http://f1-hubb:3000/api/health` godkänd.
- Byggd frontend, JS/CSS, lokala flaggor, lagbild, F1-typsnitt och GeoJSON verifierade via HTTP.
- SQLite `quick_check=ok`, läsning och skrivning godkända som UID 1000.
- Kalender med 23 Grand Prix, 23 förare och 11 konstruktörer; inga rapporterade upstream-fel.
- `scripts/Publish-F1.ps1` kördes hela vägen från Windows: GitHub-kontroll, tester, build, SHA-256-verifierad filöverföring, ren staging, skyddad snapshot och begränsat sudo-kommando.
- Vid andra deploymenten togs en konsistent SQLite-backup före uppdateringen. Containern återskapades med en ny imageidentitet. Databasmarkör och ursprungliga cachetider var kvar efter uppdateringen (`persistence=retained`).
- Övriga containrars ID, starttider och restart-räknare var oförändrade efter både installation och uppdatering.
- Publik webbläsarkontroll av översikt, Statistik och utfällbar Säsong genomförd. Statistik visade 23 förare utan trasiga bilder; F1-fonten laddades. Säsong visade 23 lopp, sessionsschema och 18 avslutade lopp. Mobilvy utan horisontell overflow.
- Live-endpointen var i vänteläge eftersom nästa race inte pågick. Livedata under ett faktiskt race är inte verifierade på produktionsservern.

## Återstående begränsningar

- Kodrollback-kommandot är installerat och föregående image har sparats, men rollback har inte körts i produktion eftersom ingen misslyckad deployment behövde återställas.
- Backuper ligger på samma server och behöver även kopieras till separat lagring.
- Deploymentfiler och dokumentation har tillkommit lokalt; agenten har inte committat eller pushat dem.
- För senare publicering: committa/pusha önskad applikationskod separat och kör `.\scripts\Publish-F1.ps1`. Kommandot ändrar inte lokal `.env`, databasen i utvecklingsmiljön eller serverns proxy/DNS.
