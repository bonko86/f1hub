# Bankartor

Circuit of the Americas: `turns` = 20 och `raceLaps` = 56 (ordinarie Grand Prix-distans), verifierat mot Formula 1:s banguide för 2026. Övriga banor saknar tills vidare dessa uppgifter och visar inte motsvarande fält.
https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-circuit-of-the-americas.3OjhBbugiQRmN4FnlpBtBc

Varvrekord under race för Circuit of the Americas: 1:36,169, Charles Leclerc, 2019. Verifierat 2026-10-25 mot Formula 1:s baninformation (länk nedan). Lagrad i `lapRecord` för denna bana; andra banor saknar tills vidare verifierat rekord. Uppgiften är statisk och uppdateras inte av Jolpica.

Faktaraden använder datasetets `length` (meter), `opened` och `firstgp`. Saknade värden utelämnas. Circuit of the Americas längd korrigerad från 5514 till 5513 meter enligt Formula 1; öppningsår och första GP verifierade som 2012:
https://www.formula1.com/en/information/united-states-circuit-of-the-americas-austin.5RpZ6us0a3FoaoRxTMpbxI

`circuits.geojson` hämtad 2026-10-25 från https://github.com/bacinger/f1-circuits (filen `f1-circuits.geojson`). MIT-licens, se LICENSE.md.

Konturerna är schematiska och kan avvika från senare ändringar av bansträckningen. Applikationen väljer en geografiskt närliggande bana med Jolpicas koordinater och ritar konturen med korrigerade longitudavstånd. Saknas en match visas ingen karta.
