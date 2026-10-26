# Lokal raceinspelning

`race-snapshot.json` är ett anonymt snapshot från F1:s SignalR Core-källa. Inspelningstid och källadress finns i filen. Det innehåller slutbilden från United States Grand Prix den 25 oktober 2026, inte en komplett tidsserie. Inga cookies, anslutningstokens eller kontouppgifter sparas.

Det offentliga historikarkivet svarade 401 vid kontrollen. Testläget använder därför snapshotets förare och stall tillsammans med ett uttryckligen **simulerat** händelseförlopp. Varvtider, positioner, flaggor, däck och VM-underlag i testläget är inte historiska resultat.

Kör `npm run dev`, välj **Live → Öppna lokalt testläge**. Spela/pausa, välj hastighet eller hoppa direkt till scenarierna. Depåstoppet sker vid 20 s, däckbytet vid 30 s, positionsbytet vid 40 s, Safety Car vid 60 s, röd flagg vid 80 s, återstart vid 100 s, gammal data vid 120 s, avbrott vid 140 s och avslutat lopp vid 160 s.

Uppspelningen använder `liveSnapshot`, `BattleTracker` och den vanliga klientvyn. Testet läser och skriver ingen databas och påverkar inte liveanslutningen. Varje anrop beräknas separat så att olika webbläsare och sökningar inte påverkar varandra.

`/api/replay` registreras endast när backend körs från `server/index.ts`, och tillåter endast anslutningar från localhost. Byggd backend (`dist/server/index.js`) registrerar inte endpointen. Testkontrollerna inkluderas endast i Vites utvecklingsläge. Ingen produktionskonfiguration ändras.
