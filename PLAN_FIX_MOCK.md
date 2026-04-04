# Modułowe Mock API Zamiast Jednego `runtime-store.json`

## Podsumowanie

Przebudować obecny mock backend z modelu `jeden globalny DemoStore` na modułowe mock API per domena, z osobnymi plikami seed/runtime i lekkimi endpointami list/detail/action. Frontend ma przechodzić etapami: najpierw nowa warstwa repozytorium i endpointy za kompatybilną fasadą, potem stopniowe odpinanie ekranów od globalnego `store`.

Docelowy efekt:

- każdy ekran pobiera tylko swój zakres danych,
- mutacje aktualizują tylko właściwą domenę,
- `save.php` i `store.php` przestają być centralnym kontraktem,
- seed/reset działa per domena, nie przez jeden wielki JSON,
- kontrakt mock API zaczyna przypominać przyszły backend, więc późniejsza podmiana implementacji będzie naturalna.

## Kluczowe zmiany

### 1. Nowa struktura danych runtime/seed

Zamiast jednego pliku:

- seed: `public/mock-data/seed-store.json`
- runtime: `.local-state/emandar/runtime-store.json`

wprowadzić katalogi domenowe:

- seed: `public/mock-data/domains/<domain>.json`
- runtime local: `.local-state/emandar/domains/<domain>.json`
- runtime production: `/opt/panel.ceo/emandar-data/domains/<domain>.json`

Domeny v1:

- `auth`
- `profiles`
- `trainers`
- `organizers`
- `relations`
- `events`
- `enrollments`
- `groups`
- `event-participants`
- `calendar-feeds`
- `notifications`
- `account-requests`
- `trainer-approvals`
- `settings`

Dodać jeden lekki plik meta, np. `meta.json`, z:

- wersją globalną mock API,
- `versions[domain]`,
- `updatedAt[domain]`

To ma służyć do polling/checków bez ściągania całych danych.

### 2. Nowy kontrakt endpointów mock API

Zamiast `store.php` i `save.php` jako głównego transportu, wprowadzić endpointy per domena i use-case.

Minimalny styl kontraktu:

- list/detail GET-y zwracają tylko potrzebne rekordy i lekkie `meta`
- action POST-y przyjmują tylko payload danej operacji
- action POST-y zwracają:
  - `ok`
  - zmienione rekordy lub minimalny refreshed resource
  - `affectedDomains`
  - `versions`

Przykładowe grupy endpointów:

- `api/mock/auth/session`
- `api/mock/public/catalog`
- `api/mock/public/trainers`
- `api/mock/public/events/:id`
- `api/mock/panel/navigation`
- `api/mock/panel/dashboard`
- `api/mock/events`
- `api/mock/events/:id`
- `api/mock/events/:id/publish`
- `api/mock/events/:id/review`
- `api/mock/events/:id/unpublish`
- `api/mock/enrollments`
- `api/mock/enrollments/:id/decision`
- `api/mock/groups`
- `api/mock/relations`
- `api/mock/settings`
- `api/mock/meta`

Zasada:

- agregaty per ekran są dozwolone, ale tylko jako świadome read models, nie jako powrót do jednego globalnego store.

### 3. Repozytorium i frontend

Rozbić `mockRepository.ts` na moduły per domena:

- `authRepository`
- `publicCatalogRepository`
- `eventsRepository`
- `enrollmentsRepository`
- `groupsRepository`
- `relationsRepository`
- `settingsRepository`
- `notificationsRepository`

`AppProviders` zostawić przejściowo jako fasadę, ale zmienić jego źródła danych:

- zamiast `subscribePublicStore` i `subscribePrivateStore` opartych o cały snapshot,
- wprowadzić subskrypcje/fetchery per domena lub per read-model.

Migracja etapowa:

1. zachować `useAppState`, ale zasilać go z modułowych źródeł,
2. wydzielić najcięższe ekrany z pełnego store jako pierwsze,
3. na końcu usunąć globalny `DemoStore` jako główny kontrakt transportowy.

Ekrany priorytetowe do migracji:

- panel moderacji wydarzeń społeczności
- szczegół wydarzenia z moderacją/publikacją
- lista wydarzeń społeczności
- panel requests/enrollments
- panel layout/navigation badges
- dashboard

### 4. Polling, cache i invalidation

Usunąć polling pełnego store co `5s`.
Zamiast tego:

- lekki polling `meta`
- refetch tylko dla domen z nowszą wersją
- po mutacji optimistic/local patch dla dotkniętych zasobów
- opcjonalnie krótki refetch tylko dotkniętych domen dla spójności

Domyślny model:

- publiczne read modele cache’owane osobno
- prywatne read modele cache’owane osobno
- mutacja nie wymusza pełnego reloadu app state

### 5. Seed/reset i narzędzia developerskie

Zastąpić obecne skrypty:

- `mock:reset`
- `mock:seed:from-runtime`

wersją domenową:

- reset kopiuje wszystkie `public/mock-data/domains/*.json` do runtime domains
- export do seed działa per domena
- zachować obecną zasadę ochrony trainerów i trainer-linked users, tylko już na poziomie odpowiednich domen

Dodatkowo:

- przygotować skrypt migracji z istniejącego `seed-store.json` i `runtime-store.json` do nowej struktury domenowej
- utrzymać jednorazowy importer legacy store tylko na okres przejściowy

## Interfejsy i typy

Dodać nowe typy transportowe, zamiast używać wszędzie `DemoStore`:

- `MockApiMeta`
- `DomainVersionMap`
- `MockListResponse<T>`
- `MockDetailResponse<T>`
- `MockActionResponse<T>`
- read-modele per ekran, np.:
  - `PanelNavigationSummary`
  - `CommunityModerationListItem`
  - `EventManagementDetail`
  - `PublicCatalogPayload`

`DemoStore` pozostawić tylko jako typ migracyjny/legacy wewnątrz warstwy przejściowej, nie jako docelowy payload API.

## Plan testów

### Backend/mock API

- każdy endpoint domenowy zwraca tylko oczekiwane dane, bez globalnego store
- mutacja eventu aktualizuje tylko właściwe domeny i wersje
- `publish/review/unpublish` nie zwracają całego runtime state
- `meta` zmienia wersję tylko dla dotkniętych domen
- reset i export seed działają poprawnie na katalogu domen

### Frontend

- moderacja community nie wykonuje już serii pełnych `GET /store.php`
- klik zatwierdzenia/publikacji kończy się szybkim odblokowaniem UI
- panel layout pobiera tylko lekki summary do badge’y i skrótów
- publiczny katalog nie pobiera prywatnych domen
- requests/enrollments nie ściągają eventów/grup/notifications, jeśli ekran ich nie potrzebuje

### Regresje

- logowanie i sesja dalej działają
- community review token flow dalej działa
- publikacja official/community zachowuje obecną logikę biznesową
- reset seed nie psuje curated trainer danych
- `npm test` i `npm run build` przechodzą

## Założenia i domyślne decyzje

- Podział danych: per domena, nie per ekran.
- Migracja: etapowa, z tymczasową fasadą `useAppState`.
- Mutacje: też modułowe od pierwszego etapu, bez centralnego `save.php` jako głównego kontraktu.
- Agregaty per ekran są dozwolone, ale wyłącznie jako lekkie read modele.
- `store.php/save.php` mogą zostać chwilowo jako legacy fallback tylko na czas migracji, ale nie rozwijamy ich dalej.
- Runtime persistence ma być fizycznie rozbita na wiele plików domenowych, a nie tylko logicznie filtrowana z jednego JSON-a.
