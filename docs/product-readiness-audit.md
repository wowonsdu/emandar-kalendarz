# Analiza production readiness

Data oceny: 2026-05-02

## Status

System jest wdrozony pod `https://panel.ceo/emandar/` z API pod `/emandar/api`, PostgreSQL i lokalnym katalogiem uploadow. Aktualny deploy dziala w kontenerach za produkcyjnym proxy. Aplikacja jest po technicznym cutoverze z mock runtime, ale nadal wymaga domkniecia read modeli, dlugu frontu i pakietu roster/rezerwowi/komunikacja przed pelnym statusem production ready.

## Zweryfikowane po deployu

- `https://panel.ceo/emandar/` zwraca `200`.
- `https://panel.ceo/emandar/api/health` zwraca `{"ok":true,"service":"emandar-api"}`.
- Aktualny hashed asset weba zwraca `200`.
- Kontenery `emandar-api` i `emandar-postgres` dzialaja w sieci produkcyjnego proxy.
- API startuje z base path `/emandar` i healthcheckiem pod `/emandar/api/health`.
- Legacy store API jest w produkcyjnym env wylaczone przez `ALLOW_LEGACY_STORE_API=false`.

## Co jest juz zrobione

- Web uzywa klienta API (`apps/web/src/data/apiClient.ts`) dla publicznych list, sesji, SMS, jawnych mutacji panelu, signed action tokens i uploadow.
- API wystawia endpointy publiczne, auth, read modele panelu, guarded participant registration, jawne mutacje panelowe, upload endpoint i legacy endpointy tylko za `ALLOW_LEGACY_STORE_API`.
- Jest `DomainService`, ktory wykonuje glowne mutacje po stronie API dla profili, grup, wydarzen, relacji, zgloszen, rosteru, moderacji i ustawien (`apps/api/src/services/domain-service.ts`).
- SMSAPI ma adapter z trybem testowym i realnym wywolaniem SMSAPI (`apps/api/src/services/sms-provider.ts`).
- PostgreSQL jest aktywnym runtime storem przez `PgStoreRepository`.
- Produkcyjne sesje, SMS challenge i signed action tokens przechodza przez `PgAuthStore`; memory store zostaje tylko dla dev/test.
- Udane potwierdzenie SMS dla numeru bez konta wydaje jednorazowy `registrationToken`, a `POST /api/auth/register-participant` wymaga tokenu przypisanego do tego telefonu.
- Mutacje cookie-based wymagaja `x-emandar-csrf`, a CORS uzywa allowlisty `CORS_ALLOWED_ORIGINS`.
- Upload zapisuje rekord `uploads`, waliduje limit 5 MB oraz magic header JPG/PNG/WEBP, przypisuje `owner_user_id` i `purpose`, nie zwraca `storagePath`, a uzycie uploadu w krytycznych komendach sprawdza wlasciciela i przeznaczenie.
- Mutacje API zapisują podstawowy `audit_log`, a SMS zapisuje `notification_deliveries` oraz audyt wysylki, bledow kodu, rate limitu i logowania.
- Publiczne i panelowe listy szkolen/wydarzen maja endpointy stronicowane z domyslnym `pageSize=25` i limitem `pageSize=100`.
- Backend signed action tokens dzialaja dla potwierdzenia udzialu i moderacji wydarzen spolecznosci; panelowy dashboard potwierdzenia udzialu nie wysyla juz surowego `eventParticipant.id` jako tokena.
- Seed produkcyjny nie nadpisuje bazy, gdy istnieja juz dane runtime.
- Build, testy i typecheck przechodza lokalnie przed deployem.

## Czescowo zrobione

- Signed attendance/community tokens: backend i podstawowe frontendowe uzycie sa podlaczone, ale trzeba jeszcze przejsc przez wszystkie zewnetrzne szablony SMS/komunikacji i upewnic sie, ze kazdy link wysylany poza aplikacje pochodzi z endpointu `panel/signed-actions/*`.
- Server-side pagination: endpointy i publiczne listy sa stronicowane. Panel nadal ma szerszy `panelStore` dla dashboardow i detali, wiec docelowe read modele trzeba wydzielic per widok, zamiast utrzymywac jeden duzy store dla calego panelu.
- SMS hardening: rate limit, limit blednych prob i brak zwracania kodu poza `SMSAPI_TEST_MODE=true` sa wdrozone. Nadal brakuje webhookow statusow SMSAPI/retry i finalnego real-SMS gate'u.
- Smoke/E2E: jest `pnpm smoke:production`, ale wynik po deployu trzeba jeszcze wlaczyc jako stala bramke release.

## Braki blokujace pelna produkcje

1. Dane domenowe nadal sa trzymane jako kolekcje JSONB, nie jako jawne tabele domenowe. `apps/api/migrations/0001_initial.sql` tworzy store kolekcji plus tabele operacyjne, ale nie docelowy relacyjny model domeny.
2. Pozostalosc `POST /api/panel/command/:name` moze istniec tylko jako legacy za flaga. Produkcyjnie `ALLOW_LEGACY_STORE_API=false` musi blokowac `/bootstrap`, `/panel/command`, `/mock` i `/store`.
3. Publiczne zapisy wymagaja aktywnej sesji po SMS (`submitEnrollment` rzuca blad bez aktora). To moze byc akceptowalne produktowo, ale kontrakt `/api/public/enrollments` nie jest klasycznym anonimowym publicznym enrollmentem i trzeba to swiadomie zatwierdzic.
4. Audyt mutacji jest podstawowy i techniczny. Nadal trzeba doprecyzowac historie decyzji domenowych oraz osobna macierz uprawnien API dla participant/moderator/organizer/trainer/admin.
5. Front nadal ma duze monolity: `panel.tsx`, `public.tsx`, `AppProviders.tsx`; dodatkowo czesc widokow panelowych laduje zbyt szeroki zestaw danych.
6. Read modele dla ciezkich list nadal powinny przejsc z JSONB collection store na jawne tabele/widoki: events, community events, participants/enrollments, group memberships.
7. Roster / rezerwowi / komunikacja pozostaje product lockiem. Nie robic czastkowych zmian UX przed pelnym pakietem: `oczekuję`, `rezerwowi`, `uczestniczę`, osobne `organizuję`, komunikacja rezerwowa i manualne powiadomienia.

## Najblizsza kolejnosc prac

1. Wydzielic panelowe read modele per widok, zaczynajac od list wydarzen i hookow odczytu, z zachowaniem aktualnego UX.
2. Uruchomic `pnpm smoke:production` po deployu i zapisywac wynik jako ignorowany artefakt release.
3. Dociagnac SMS/notification pipeline: webhook statusow, retry, real-SMS gate z `SMSAPI_TEST_MODE=false`, testem wysylki i potwierdzeniem billing/kosztow.
4. Rozszerzyc `audit_log` o semantyczne zdarzenia domenowe i pola potrzebne do historii decyzji administracyjnych.
5. Zaprojektowac etap migracji z JSONB store do jawnych read modeli/tabel.
6. Rozszerzyc testy macierzy uprawnien dla modelu kumulatywnych rol: participant, moderator, organizer, trainer, admin.

## Load-test dataset

Zaakceptowany prog danych demo dla obecnego etapu to okolo `350` przypisanych demo uczestnikow oraz `50` kont/tworcow wydarzen spolecznosciowych. Nie traktujemy juz pelnych `500` przypisan jako wymaganej bramki dla tego pakietu.
