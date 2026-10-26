# F1 Hubb: begränsad deployment

Server: `codex-f1@192.168.1.105`, nyckel `C:\Users\micke\.ssh\codex_f1`. Domän: `f1.mikaelstenberg.com`. DNS, Nginx Proxy Manager och certifikat hanteras av serverägaren.

**Status 2026-10-26:** hjälparna är installerade av administratören. Första deploymenten och en uppdatering via Windows-kommandot har genomförts och verifierats. Applikationen är tillgänglig över HTTPS. Se [verifieringsrapporten](VERIFICATION.md) för version, tester och avgränsningar.

## Vad administratören godkänner

`production/install.sh` ersätter endast `/etc/f1-hubb/compose.yaml`, installerar F1-hjälpfiler i samma root-skyddade katalog, ersätter `/usr/local/sbin/deploy-f1-hubb`, lägger till `status-f1-hubb` och `rollback-f1-hubb` samt en avgränsad sudoers-fil `/etc/sudoers.d/codex-f1-hubb`. De tre kommandona får köras utan argument. Kontot får inte generell sudo, Docker-grupp eller åtkomst till Docker-socketen. Installeraren säkerhetskopierar befintlig Compose-fil, deployment-skript och eventuell tidigare F1-sudoers. Den deployar inte och rör inga containrar, volymer, nätverk eller systemversioner. Befintlig skyddad Dockerfile behålls.

Byggkontexten ändras från användarskrivbar katalog till en ny root-ägd snapshot under `/var/lib/f1-hubb-deploy/releases`. Snapshot skapas genom att läsa en fast lista projektfiler som `codex-f1`; root extraherar bara vanliga filer/kataloger efter validering. Symlänkar, hårdlänkar, specialfiler, absoluta sökvägar och privata/runtime-filer avvisas. Användarens Dockerfile och `.dockerignore` används inte i den skyddade byggkontexten. Docker Compose läser inte projektets `.env`, och hjälparna startar med rensad miljö och Bash privileged mode för att ignorera bland annat BASH_ENV.

Compose behåller projektet `f1-hubb`, containern `f1-hubb`, UID/GID 1000:1000, intern port 3000, befintligt `proxy-net`, namngivna SQLite-/backupvolymer och befintliga säkerhetsbegränsningar. Inga värdportar publiceras. Imagen får namnet `f1-hubb:current`.

Detta är begränsad Docker-administration, **inte isolering av opålitlig applikationskod**. Kod och npm-installationsskript körs i Docker-bygget med nätverksåtkomst. Runtime-koden har nätverksåtkomst till `proxy-net` och kan skriva F1-volymerna. Programmet delar värdens kernel via Docker. Endast betrodd, granskad kod ska publiceras. Inga produktionshemligheter monteras i bygget.

## Publicera med ett kommando på Windows

Efter att administratören installerat och godkänt hjälparna, öppna projektets PowerShell-terminal:

```powershell
.\scripts\Publish-F1.ps1
```

Lås vid behov först upp SSH-nyckeln med `ssh-add C:\Users\micke\.ssh\codex_f1`. Skriptet committar/pushar aldrig: applikationskoden måste vara committad och HEAD måste matcha GitHub main. Det kör tester och build, skapar ett Git-arkiv utan lokal `.env`/databas/node_modules, verifierar SHA-256, överför över SSH och placerar källkoden i en ny ren staging-katalog. Föregående uppladdad källkod bevaras i `/opt/f1-hubb/source-history`; `/opt/f1-hubb/data` berörs inte. En skyddad snapshot byggs på servern och endast tjänsten `f1` återskapas.

Ett gemensamt root-ägt lås hindrar samtidiga deployment-/status-/rollbackkörningar. Före containeruppdatering skapas konsistent SQLite-backup i backupvolymen. Kontroll av healthy, intern HTTP/Docker-DNS, frontend, bilder, typsnitt, SQLite-integritet, läs/skriv, datamarkör över uppdateringar och Jolpica-cache körs efteråt. Övriga containrars ID, starttid och restart count jämförs före/efter. En första initialisering kan ta flera minuter. Vid fel avbryts kommandot utan automatisk rollback eller dataradering.

## Status och rollback

Över samma SSH-anslutning kan agenten köra `sudo -n /usr/local/sbin/status-f1-hubb` för avgränsad status och loggar. Om publiceringen misslyckas ska felet rapporteras innan nästa ändrande åtgärd.

Efter separat godkännande återställer `sudo -n /usr/local/sbin/rollback-f1-hubb` imagen från före senaste containeruppdateringen. Volymerna behålls; ny SQLite-backup tas före byte. Ingen databasbackup återställs automatiskt. En första installation har ingen tidigare image. Kodrollback kan misslyckas om framtida datamodeller blir inkompatibla; databasåterställning kräver då separat plan och godkännande.

Snapshots, källkodshistorik, images och backuper rensas inte automatiskt. Behåll extra kopior av viktiga SQLite-backuper utanför servern. Sätt inte deployment att köra automatiskt på push.

## Nginx Proxy Manager

Serverägaren konfigurerar hosten `f1.mikaelstenberg.com`, schema `http`, forward hostname `f1-hubb`, port `3000`, på befintligt `proxy-net`, och hanterar HTTPS-certifikat. Ingen hostport, MariaDB eller annan extra tjänst behövs.
