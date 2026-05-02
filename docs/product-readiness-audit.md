# Analiza production readiness

Data oceny: 2026-05-02

## Status

System jest wdrozony pod `https://panel.ceo/emandar/` z API pod `/emandar/api`, PostgreSQL i lokalnym katalogiem uploadow. To jest dobry etap technicznego cutoveru, ale aplikacja nadal nie jest production ready jako docelowy system Emandar. Aktualny backend przenosi czesc aktywnej logiki z frontendu, jednak nadal uzywa hybrydy JSONB store, komend ogolnych i kilku mechanizmow mock/dev.

## Zweryfikowane po deployu

- `https://panel.ceo/emandar/` zwraca `200`.
- `https://panel.ceo/emandar/api/health` zwraca `{"ok":true,"service":"emandar-api"}`.
- Aktualny hashed asset weba zwraca `200`.
- Kontenery `emandar-api` i `emandar-postgres` dzialaja w sieci produkcyjnego proxy.
- API startuje z base path `/emandar` i healthcheckiem pod `/emandar/api/health`.
- Legacy store API jest w produkcyjnym env wylaczone przez `ALLOW_LEGACY_STORE_API=false`.

## Co jest juz zrobione

- Web uzywa klienta API (`apps/web/src/data/apiClient.ts`) dla bootstrapu, sesji, SMS, komend panelu i uploadow.
- API wystawia endpointy publiczne, auth, panel bootstrap, guarded participant registration, generic command endpoint i upload endpoint (`apps/api/src/app.ts`).
- Jest `DomainService`, ktory wykonuje glowne mutacje po stronie API dla profili, grup, wydarzen, relacji, zgloszen, rosteru, moderacji i ustawien (`apps/api/src/services/domain-service.ts`).
- SMSAPI ma adapter z trybem testowym i realnym wywolaniem SMSAPI (`apps/api/src/services/sms-provider.ts`).
- PostgreSQL jest aktywnym runtime storem przez `PgStoreRepository`.
- Produkcyjne sesje i SMS challenge przechodza przez `PgAuthStore` i tabele `auth_sessions` / `sms_challenges`; memory store zostaje tylko dla dev/test.
- Udane potwierdzenie SMS dla numeru bez konta wydaje jednorazowy `registrationToken`, a `POST /api/auth/register-participant` wymaga tokenu przypisanego do tego telefonu.
- Mutacje cookie-based wymagaja `x-emandar-csrf`, a CORS uzywa allowlisty `CORS_ALLOWED_ORIGINS`.
- Upload zapisuje rekord `uploads`, waliduje limit 5 MB oraz magic header JPG/PNG/WEBP, przypisuje `owner_user_id` i `purpose`, nie zwraca `storagePath`, a uzycie uploadu w krytycznych komendach sprawdza wlasciciela i przeznaczenie.
- Mutacje API zapisują podstawowy `audit_log`, a demo/test SMS zapisuje `notification_deliveries`.
- Seed produkcyjny nie nadpisuje bazy, gdy istnieja juz dane runtime.
- Build, testy i typecheck przechodza lokalnie przed deployem.

## Braki blokujace pelna produkcje

1. Dane domenowe nadal sa trzymane jako kolekcje JSONB, nie jako jawne tabele domenowe. `apps/api/migrations/0001_initial.sql` tworzy store kolekcji plus tabele operacyjne, ale nie docelowy relacyjny model domeny.
2. `POST /api/panel/command/:name` nadal jest ogolnym routerem komend z `unknown[]`. To ogranicza walidacje Zod per akcja, utrudnia jawne kontrakty i zwieksza ryzyko pomylek uprawnien.
3. Publiczne zapisy wymagaja aktywnej sesji po SMS (`submitEnrollment` rzuca blad bez aktora). To moze byc akceptowalne produktowo, ale kontrakt `/api/public/enrollments` nie jest klasycznym anonimowym publicznym enrollmentem i trzeba to swiadomie zatwierdzic.
4. Linki potwierdzenia udzialu i moderacji nadal uzywaja surowych ID rekordow jako tokenow. Migracja dodala tabele `signed_action_tokens`, ale flow generowania i konsumpcji podpisanych tokenow nie jest jeszcze podlaczony.
5. SMSAPI nadal nie ma produkcyjnego gate'u: brak rate limitu per telefon/IP, brak webhooka statusow, brak retry i nadal obowiazuje `SMSAPI_TEST_MODE=true` do finalnego release gate.
6. Audyt mutacji jest podstawowy i techniczny. Nadal trzeba doprecyzowac historie decyzji domenowych oraz osobna macierz uprawnien API dla participant/moderator/organizer/trainer/admin.
7. Moderacja community event review wymaga przejscia na podpisane tokeny; do tego czasu nie nalezy traktowac linkow moderacyjnych jako finalnie produkcyjnych.
8. Czesc zachowan nadal opiera sie na nazwach i strukturze `mockRepository`, a testy frontendu nadal pokrywaja legacy mock flows. To nie blokuje smoke deployu, ale blokuje czyste utrzymanie produkcyjne.

## Najblizsza kolejnosc prac

1. Rozbic `/api/panel/command/:name` na jawne endpointy z osobnymi schema Zod, zaczynajac od zapisow, rosteru, eventow, grup, relacji, uzytkownikow i ustawien.
2. Wprowadzic podpisane tokeny dla potwierdzen udzialu i moderacji oraz przestac generowac linki z surowymi ID.
3. Dociagnac SMS/notification pipeline: trwałe `sms_challenges` juz istnieja, ale trzeba dodac rate limiting, brak zwracania kodu poza test mode, retry/webhook statusow i finalne wlaczenie SMSAPI.
4. Rozszerzyc `audit_log` o semantyczne zdarzenia domenowe i pola potrzebne do historii decyzji administracyjnych.
5. Zaprojektowac i wdrozyc jawne tabele domenowe albo przynajmniej etap migracji z JSONB store do relacyjnego modelu.
6. Dodac API permission matrix i smoke testy produkcyjnych flow: SMS login, stworzenie wydarzenia, publiczny zapis, akceptacja, potwierdzenie udzialu.
