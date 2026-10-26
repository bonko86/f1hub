# Språkfiler

Svenska (`sv.ts`) är standardspråk och reservspråk. Ingen automatisk språkväxling eller språkväljare används ännu.

För att lägga till ett språk:

1. Kopiera `sv.ts` till exempelvis `en.ts` och översätt meddelandena. Behåll nycklar och platshållare som `{year}`, `{count}` och `{race}`.
2. Byt exportnamn till `en` och locale till exempelvis `en-GB`. Importera `Language` med `import type { Language } from '../i18n.js'` och avsluta objektet med `satisfies Language` för att kontrollera att alla nycklar finns.
3. Importera språket i `client/i18n.ts`, registrera det i `languages` och ändra `selectedLanguage` till `en`.
4. Kör `npm run check`, `npm test` och `npm run build`.

`t()` hanterar meddelanden och platshållare. Saknade meddelanden faller tillbaka till svenska vid körning. Lägg nya UI-texter i språkfilen, även hjälptexter, tabellrubriker och tillgänglighetstexter.

Datum och siffror formateras med språkets locale via `Intl`. Tidszonen anges separat i `i18n.ts` och förblir `Europe/Stockholm` när språket ändras. Nedräkningens enheter finns också i språkfilen.

Sessioner översätts med stabila sessionsidentifierare. Äldre sparade svenska sessionsnamn stöds utan ändring av databasen. API-fel visas med översatta klientmeddelanden. Förar-, stall-, ban- och Grand Prix-namn från datakällorna behålls som egennamn.
