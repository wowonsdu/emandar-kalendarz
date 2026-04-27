# Ocena gotowosci produktu

Data oceny: 2026-04-27

## Wniosek

Produkt jest zaawansowanym MVP po migracji do monorepo i PostgreSQL, ale nie jest jeszcze gotowy jako pelnoprawny system produkcyjny dla Emandar. Najwiekszy postep to wydzielenie API, wspolny kontrakt Zod i trwały store w PostgreSQL. Najwieksze ryzyko zostalo w architekturze aplikacji: logika biznesowa i autoryzacyjna nadal w duzej czesci dziala w `apps/web/src/data/mockRepository.ts`, a API udostepnia glownie snapshot/patch store zamiast domenowych endpointow z kontrola uprawnien po stronie serwera.

## Gotowe

- Monorepo pnpm/Turbo jest ustawione dla `apps/web`, `apps/api` i `packages/shared`; glowne komendy sa w `package.json`.
- Web ma docelowy base path `/emandar/`, a Vite proxy kieruje `/emandar/api` i `/api` na lokalne API (`apps/web/vite.config.ts`).
- API Fastify wystawia healthcheck, store snapshot/version/patch oraz demo SMS auth pod produkcyjnym subpathem (`apps/api/src/app.ts`).
- PostgreSQL store istnieje i zapisuje kolekcje w oddzielnych tabelach JSONB z optymistycznym wersjonowaniem (`apps/api/src/store/pg-store.ts`, `apps/api/migrations/0001_initial.sql`).
- Seed jest czytany z `apps/web/public/mock-data/seed-store.json`; API nie nadpisuje danych, jesli baza ma juz runtime data (`apps/api/src/runtime.ts`).
- Model rol jest w duzej mierze kumulatywny: `getHighestRole`, `hasInheritedRole`, `hasModeratorAccess` i `canUseOrganizerFunctions` rozrozniaja hierarchie od moderatora (`apps/web/src/domain/utils.ts`, `packages/shared/src/index.ts`).
- Publiczne flow kalendarza, trenerow, wydarzen spolecznosci, rejestracji/logowania SMS, panelu, grup, zgloszen, relacji i moderacji istnieja w routingu (`apps/web/src/app/routes.tsx`).
- Sa testy jednostkowe dla API, domeny, repository i czesci flow web (`apps/api/src/app.test.ts`, `apps/web/src/**/*.test.ts`, `packages/shared/test/contracts.test.ts`).
- Deploy shape jest opisany dla web/API/systemd/Nginx/PostgreSQL (`docs/production-migration.md`, `deploy/*`).

## Czesciowe / MVP

- API persistence jest technicznie trwale, ale domenowe operacje nadal sa liczone po stronie frontendu i wysylane jako patch kolekcji. To wystarcza na MVP, ale nie na docelowa integralnosc danych.
- Auth SMS ma HTTP-only cookie po stronie API, ale password login nadal ustawia lokalny mock session id w przegladarce. Frontend ma tez fallback do `localStorage`, wiec model sesji jest mieszany.
- `InMemoryAuthStore` trzyma SMS challenge i sesje w pamieci procesu API. Restart uslugi zerwie aktywne sesje i wyczysci oczekujace challenge.
- SMS jest demo-only: endpoint zwraca kod, a nie integruje realnej bramki SMS. Linki potwierdzenia udzialu sa oparte o identyfikatory rekordow, nie o krotko zyjace podpisane tokeny.
- Powiadomienia sa rekordami w store i ustawieniami szablonow, bez kolejki wysylek, retry, historii dostarczenia i realnego transportu.
- Roster, rezerwowi i potwierdzanie udzialu maja podstawowe statusy i akcje, ale brakuje docelowego flow komunikacji z lista rezerwowa oraz manualnej notyfikacji zamknietego rosteru.
- Walidacja kontraktow istnieje na granicy store patch i SMS, ale wiekszosc typow domenowych nie jest walidowana przez API jako osobne komendy.
- Web typecheck jest obecnie `tsc --noEmit --noCheck`, wiec nie daje pelnej gwarancji typow dla produkcji.
- README i release checklist nadal zawieraja stare komendy `npm`, podczas gdy repo uzywa `pnpm`.

## Blokery produkcyjnego uzycia

1. Przeniesienie autoryzacji domenowej na API. Klient nie moze byc zrodlem prawdy dla decyzji typu akceptacja zgloszenia, publikacja, moderacja, blokady organizatora czy zmiana rosteru.
2. Ujednolicenie auth. Sesje, password login i SMS login musza isc przez API, z trwalym albo swiadomie zarzadzanym session store, rotacja sekretow i bez lokalnego fallbacku jako mechanizmu produkcyjnego.
3. Realny SMS/notification pipeline. Potrzebne sa integracja transportu, podpisane tokeny, wygasanie linkow, retry, status wysylki i audyt tresci wyslanych do uczestnikow.
4. Docelowe flow roster/rezerwowi/komunikacja. Szczegolnie: zbiorcza wiadomosc do rezerwowych, komunikat o braku miejsc, manualna notyfikacja finalnego wyniku i jasny split uczestnika: `oczekuje`, `rezerwowi`, `uczestnicze`, `organizuje`.
5. Migracja z generic store patch do jawnych endpointow domenowych albo przynajmniej serwerowych command handlerow z walidacja, transakcjami i niezmiennikami.
6. Produkcyjna obsluga plikow/zdjec. Aktualny frontend czyta uploady jako dane w kliencie; docelowo potrzebny jest storage, limity, skanowanie/typy MIME i kontrola dostepu.
7. Hardening testow i release gate: pelny typecheck, testy krytycznych uprawnien na API, testy migracji/seedowania i smoke produkcyjnych sciezek.

## Rekomendowana kolejnosc prac

1. Naprawic dokumentacje operacyjna po migracji: README, release checklist, wymagane env vars i jednoznaczny lokalny/prod runbook.
2. Ujednolicic auth po stronie API: session store, logout/login/password/SMS bez mockowego fallbacku produkcyjnego.
3. Wprowadzic API command endpoints dla krytycznych operacji: zgloszenia, roster, wydarzenia, moderacja, role/blokady.
4. Domknac SMS i powiadomienia: realny provider, podpisane linki, statusy dostarczenia i kolejka.
5. Zrealizowac pelny pakiet roster/rezerwowi/komunikacja zgodnie z lockiem produktowym z `AGENTS.md`.
6. Dodac produkcyjne zarzadzanie plikami i zdjeciami.
7. Rozszerzyc testy: API permission matrix, concurrency/version conflicts, migracje PostgreSQL, krytyczne flow panelu i publicznych zapisow.
8. Dopiero po tych krokach wykonac finalny deploy/cutover PostgreSQL i usunac pozostalosci nazewnictwa `mock` z aktywnych sciezek produkcyjnych.
