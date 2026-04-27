# Analiza production readiness

Data oceny: 2026-04-28

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
- API wystawia endpointy publiczne, auth, panel bootstrap, generic command endpoint i upload endpoint (`apps/api/src/app.ts`).
- Jest `DomainService`, ktory wykonuje glowne mutacje po stronie API dla profili, grup, wydarzen, relacji, zgloszen, rosteru, moderacji i ustawien (`apps/api/src/services/domain-service.ts`).
- SMSAPI ma adapter z trybem testowym i realnym wywolaniem SMSAPI (`apps/api/src/services/sms-provider.ts`).
- PostgreSQL jest aktywnym runtime storem przez `PgStoreRepository`.
- Seed produkcyjny nie nadpisuje bazy, gdy istnieja juz dane runtime.
- Build, testy i typecheck przechodza lokalnie przed deployem.

## Braki blokujace pelna produkcje

1. Dane domenowe nadal sa trzymane jako kolekcje JSONB, nie jako jawne tabele domenowe. `apps/api/migrations/0001_initial.sql` tworzy store kolekcji, a nie docelowe tabele typu `users`, `trainer_profiles`, `training_events`, `enrollment_requests`, `uploads`, `audit_log`.
2. Sesje i SMS challenge sa w pamieci procesu (`InMemoryAuthStore`). Restart API wyloguje uzytkownikow i uniewazni oczekujace kody, a rate limit per telefon/IP nie jest utrwalony.
3. Rejestracja uczestnika nie jest twardo powiazana z jednorazowym tokenem zweryfikowanego SMS. `registerParticipant` przyjmuje telefon z inputu i moze utworzyc konto bez osobnego server-side dowodu potwierdzenia tego numeru.
4. `POST /api/panel/command/:name` nadal jest ogolnym routerem komend z `unknown[]`. To ogranicza walidacje Zod per akcja, utrudnia jawne kontrakty i zwieksza ryzyko pomylek uprawnien.
5. Publiczne zapisy wymagaja aktywnej sesji po SMS (`submitEnrollment` rzuca blad bez aktora). To moze byc akceptowalne produktowo, ale kontrakt `/api/public/enrollments` nie jest klasycznym anonimowym publicznym enrollmentem i trzeba to swiadomie zatwierdzic.
6. Linki potwierdzenia udzialu i moderacji uzywaja surowych ID rekordow jako tokenow. Brakuje podpisanych tokenow z TTL i jednorazowym uzyciem.
7. Upload zapisuje plik na dysku, ale nie zapisuje metadanych do tabeli `uploads`, nie weryfikuje realnej zawartosci MIME, nie kontroluje wlasciciela/przeznaczenia pliku i zwraca `storagePath` w odpowiedzi API.
8. SMSAPI nie ma utrwalonego `notification_deliveries`, statusow dostarczenia, retry, webhooka ani rate limitu. Domyslny tryb `SMSAPI_TEST_MODE` pozostaje testowy, dopoki jawnie nie zostanie ustawiony na `false`.
9. CORS ma `origin: true` i credentials. Przy cookie session potrzebny jest jawny allowlist origin oraz ochrona przed CSRF dla mutacji.
10. Moderacja community event review w `reviewCommunityEvent` moze dzialac bez zalogowanego aktora i zapisac `publicationReviewedByUserId = "system"`, jesli ktos zna token/ID.
11. Czesc zachowan nadal opiera sie na nazwach i strukturze `mockRepository`, a testy frontendu nadal pokrywaja legacy mock flows. To nie blokuje smoke deployu, ale blokuje czyste utrzymanie produkcyjne.
12. Nie ma audytu mutacji, historii decyzji administracyjnych ani osobnej macierzy uprawnien przetestowanej po stronie API dla participant/moderator/organizer/trainer/admin.

## Najblizsza kolejnosc prac

1. Zastapic `InMemoryAuthStore` tabelami `auth_sessions` i `sms_challenges`, dodac TTL cleanup oraz rate limiting.
2. Dodac server-side SMS verification token i wymagac go przy rejestracji/utworzeniu uczestnika.
3. Rozbic `/api/panel/command/:name` na jawne endpointy z osobnymi schema Zod, zaczynajac od zapisow, rosteru, eventow, grup, relacji, uzytkownikow i ustawien.
4. Wprowadzic podpisane tokeny dla potwierdzen udzialu i moderacji.
5. Domknac upload pipeline: MIME sniffing, rekord `uploads`, wlasciciel, przeznaczenie, kontrolowane URL-e i brak `storagePath` w odpowiedzi publicznej.
6. Dociagnac SMS/notification pipeline: `notification_deliveries`, statusy, retry, test mode, konfiguracja produkcyjnego nadawcy.
7. Zaprojektowac i wdrozyc jawne tabele domenowe albo przynajmniej etap migracji z JSONB store do relacyjnego modelu.
8. Dodac API permission matrix i smoke testy produkcyjnych flow: SMS login, stworzenie wydarzenia, publiczny zapis, akceptacja, potwierdzenie udzialu.

