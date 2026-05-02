# React Frontend Architecture Audit

## Cel dokumentu

Ten dokument opisuje:

- aktualną architekturę frontendu
- wzorce, z których projekt już korzysta
- miejsca, gdzie architektura zaczyna się łamać
- pliki, które powinny zostać podzielone
- rekomendowaną standardyzację dla React + TypeScript + Vite
- plan porządkowania projektu bez przepisywania wszystkiego naraz

## Aktualny stack

- React `18.3`
- React Router `7`
- Vite `6`
- Vitest `3`
- Tailwind CSS `4`
- Radix UI + lokalne wrappery w `src/app/components/ui`
- aplikacyjny context w `src/app/providers/AppProviders.tsx`
- klient API w `src/data/apiClient.ts`, React Query i backend Fastify/PostgreSQL

## Wzorce, które już są w projekcie

Projekt nie jest przypadkowy. Ma kilka sensownych fundamentów:

- Warstwowy podział `app / data / domain`
- Routing oddzielony od layoutów w `src/app/routes.tsx` i `src/app/layouts.tsx`
- Część logiki domenowej jest czysta i testowalna w `src/domain/utils.ts`
- Dostęp do danych jest schowany za klientem API w `src/data/apiClient.ts`
- UI primitives są wydzielone do `src/app/components/ui`
- Są testy domeny, repo i części helperów UI
- Jest rozróżnienie public/private store oraz auth/session flow

To oznacza, że projekt ma bazę pod dobrą architekturę. Problem nie leży w braku kierunku, tylko w zbyt dużej koncentracji odpowiedzialności w kilku plikach.

## Główne problemy architektoniczne

### 1. Monolityczne pliki route-level

Największe pliki:

- `src/app/pages/panel.tsx` -> `12715` linii
- `src/app/pages/public.tsx` -> `3147` linii
- `src/app/providers/AppProviders.tsx` -> `782` linii
- `src/domain/utils.ts` -> `978` linii
- `src/app/dashboard.ts` -> `591` linii

To są rozmiary, przy których pliki przestają być modułami, a stają się kontenerami na cały subsystem.

### 2. `panel.tsx` jest "application shell inside one file"

W `src/app/pages/panel.tsx` siedzą równocześnie:

- strony panelu
- lokalne komponenty UI
- helpery formatowania
- helpery domenowe dla widoku
- formularze
- dialogi
- analytics/dashboards
- zarządzanie grupami
- zarządzanie wydarzeniami
- settings
- katalogi ludzi

Ten plik eksportuje wiele stron:

- `DashboardPage`
- `RequestsPage`
- `RelationsPage`
- `GroupsPage`
- `EventsPage`
- `EventManagementPage`
- `TrainerDirectoryPage`
- `OrganizerDirectoryPage`
- `ProfileSettingsPage`
- `UserManagementPage`

To jest najważniejsze miejsce do rozbicia.

### 3. `public.tsx` powiela ten sam problem po stronie publicznej

W `src/app/pages/public.tsx` znajdują się jednocześnie:

- landing
- kalendarz
- listing community events
- event details
- review flow
- trainer directory
- auth flows SMS
- register/login flows

To daje jeden plik z wieloma różnymi bounded contexts.

### 4. `AppProviders.tsx` jest God Providerem

`src/app/providers/AppProviders.tsx` łączy w jednym miejscu:

- auth lifecycle
- subscriptions do store
- scalanie public/private store
- county i derived values
- mapowanie friendly errors
- wszystkie akcje aplikacyjne
- definicję jednego bardzo dużego context value

To jest klasyczny "fat context facade". Działa, ale bardzo utrudnia:

- testowanie
- izolowanie side effects
- reużycie logiki
- mockowanie pojedynczych capabilities
- czytelność zależności

### 5. Warstwa danych nadal jest zbyt szeroka

Aktywne `src/data/mockRepository.ts` nie jest juz runtime persistence. Aktualny dlug siedzi glownie w `src/data/apiClient.ts`, `AppProviders.tsx` i zbyt szerokich panelowych read modelach. W jednym miejscu sa nadal naraz:

- auth/session helpers
- CSRF, upload i SMS helpers
- CRUD dla grup
- CRUD dla wydarzeń
- flow rejestracji i SMS
- signed action token calls
- invalidacja szerokiego store po mutacjach

To oznacza brak wyraźnych granic między:

- data access
- application actions
- domain workflows

### 6. Brakuje tooling contract dla jakości kodu

W repo nie ma jawnie skonfigurowanych:

- `tsconfig.json`
- ESLint
- Prettier albo Biome

Przy tym rozmiarze projektu to już nie jest opcjonalne. Brak tych narzędzi powoduje, że standard kodu żyje wyłącznie "w głowie autora".

### 7. Testy są sensowne, ale nierówne

Dobre sygnały:

- są testy domenowe
- są testy repo
- są testy helperów UI

Braki:

- mało testów zachowania całych ekranów
- mało testów interakcji użytkownika
- brak sensownej warstwy integration tests dla większych flow
- brak e2e/smoke dla najważniejszych ścieżek panelowych

### 8. W kodzie są ślady zaległości

Przykłady:

- `LoginPageLegacyUnused` w `src/app/pages/public.tsx`
- dużo lokalnych helperów w plikach page-level zamiast w osobnych modułach
- mieszanie logiki prezentacji, stanu i orkiestracji requestów

## Jakie wzorce projekt już stosuje nieformalnie

To warto zachować i doprecyzować:

- Layered architecture: `app -> data -> domain`
- API client facade dla backendu
- Context facade dla akcji aplikacyjnych
- Pure function utilities dla domeny
- Role/capability driven UI zamiast czysto route-based UI
- Reusable UI primitive wrappers

## Jakie wzorce należy wprowadzić jawnie

### 1. Feature-first modules

Zamiast trzymać większość kodu w `pages/*.tsx`, projekt powinien przejść na strukturę feature-based:

```text
src/
  app/
    routes/
    providers/
    layouts/
  features/
    dashboard/
      components/
      hooks/
      selectors/
      pages/
    groups/
      components/
      hooks/
      forms/
      pages/
      selectors/
    events/
      components/
      hooks/
      forms/
      pages/
      selectors/
    auth/
      components/
      hooks/
      pages/
    trainers/
    organizers/
  domain/
  data/
  shared/
```

To jest najbardziej naturalny wzorzec dla Reacta przy rosnących aplikacjach biznesowych.

### 2. Page shell + feature components

Każda strona route-level powinna być cienka:

- pobiera params
- składa feature components
- odpala 1-2 hooki orkiestrujące
- nie zawiera setek linii helperów i stanów

Strona nie powinna być miejscem, gdzie mieszka cała logika modułu.

### 3. Custom hooks dla workflow

Do wydzielenia z dużych stron:

- `useGroupsPageState`
- `useGroupMembersEditor`
- `useEventCreatorForm`
- `useEventManagementState`
- `usePublicEnrollmentFlow`
- `useSmsLoginFlow`
- `useSmsRegistrationFlow`

Hook ma trzymać orkiestrację stanu i efektów, a komponent ma renderować UI.

### 4. Selectors / view models

Dane do widoków powinny być liczone poza komponentami. Dziś dużo `useMemo` robi selekcję danych bezpośrednio w page components.

Do wprowadzenia:

- `selectors.ts` per feature
- `view-model.ts` dla złożonych ekranów
- funkcje `build...Model(...)` i `select...(...)` jako standard

To już częściowo istnieje w `dashboard.ts`. Trzeba ten wzorzec rozszerzyć na grupy, wydarzenia i requests.

### 5. Reducer albo state machine dla złożonych formularzy

Niektóre flow są zbyt rozbudowane na surowe `useState`:

- kreator wydarzenia
- zarządzanie wydarzeniem
- rejestracja SMS
- onboarding
- settings z wieloma sekcjami

Tam powinien wejść:

- `useReducer` dla lokalnego workflow
- albo jawny model zdarzeń i transitions

Nie chodzi o wprowadzanie XState na siłę, tylko o czytelne przejścia stanu.

### 6. Podział providerów

Docelowo `AppProviders.tsx` powinien zostać rozbity na:

- `AuthProvider`
- `StoreProvider`
- `AppActionsProvider`
- `useCurrentUser`
- `useAppStore`
- `useAppActions`

To ograniczy rerender scope i zmniejszy wagę jednego centralnego contextu.

### 7. Data modules zamiast jednego klienta/facade

`apiClient.ts` i provider akcji powinny zostać podzielone co najmniej na:

- `data/auth.ts`
- `data/public-events.ts`
- `data/panel-events.ts`
- `data/groups.ts`
- `data/enrollments.ts`
- `data/notifications.ts`
- `data/trainers.ts`
- `data/uploads.ts`

Na górze może zostać facade eksportujące API zgodne wstecznie.

### 8. Route-level lazy loading

`routes.tsx` importuje dziś duże moduły stron eager. Przy tak ciężkich plikach warto wprowadzić:

- `lazy(() => import(...))`
- per-route chunking

To jest szczególnie ważne dla `panel.tsx` i `public.tsx`.

## Co powinno zostać podzielone najpierw

### Priorytet 1

- `src/app/pages/panel.tsx`
- `src/app/pages/public.tsx`
- `src/app/providers/AppProviders.tsx`
- `src/data/apiClient.ts`

### Priorytet 2

- `src/domain/utils.ts`
- `src/app/dashboard.ts`
- `src/app/navigation.ts`

### Priorytet 3

- duże wrappery UI, ale tylko jeśli są własnym kodem produktowym
- vendor-like wrappers z `components/ui` nie są dziś największym problemem

## Rekomendowany podział `panel.tsx`

Docelowy rozkład:

- `src/app/pages/panel/dashboard-page.tsx`
- `src/app/pages/panel/requests-page.tsx`
- `src/app/pages/panel/relations-page.tsx`
- `src/app/pages/panel/groups-page.tsx`
- `src/app/pages/panel/events-page.tsx`
- `src/app/pages/panel/event-management-page.tsx`
- `src/app/pages/panel/profile-settings-page.tsx`
- `src/app/pages/panel/user-management-page.tsx`
- `src/app/pages/panel/directories-page.tsx`

Wydzielone moduły pomocnicze:

- `src/features/groups/components/*`
- `src/features/groups/hooks/*`
- `src/features/groups/selectors/*`
- `src/features/events/components/*`
- `src/features/events/forms/*`
- `src/features/events/hooks/*`
- `src/features/dashboard/components/*`
- `src/features/dashboard/selectors/*`

Zasada:

- route file eksportuje jedną stronę
- komponenty pomocnicze nie siedzą w tym samym pliku, jeśli przekraczają prosty lokalny helper

## Rekomendowany podział `public.tsx`

- `landing-page.tsx`
- `calendar-page.tsx`
- `community-events-page.tsx`
- `event-details-page.tsx`
- `community-event-review-page.tsx`
- `trainers-page.tsx`
- `trainer-details-page.tsx`
- `login-page.tsx`
- `register-page.tsx`

Dodatkowo:

- `features/auth/hooks/use-sms-login-flow.ts`
- `features/auth/hooks/use-sms-register-flow.ts`
- `features/enrollment/hooks/use-public-enrollment-flow.ts`

## Brakujące standardy, które trzeba dopisać do projektu

### 1. Standard pliku React

Każdy większy moduł powinien mieć:

- jeden główny export komponentu albo hooka
- typy lokalne na górze albo w `types.ts`
- helpery tylko jeśli są naprawdę lokalne
- brak mieszania kilku stron w jednym pliku

### 2. Standard nazewnictwa

- `*-page.tsx` dla route pages
- `use-*.ts` albo `use*.ts` dla hooków, jeden konwencjonalny styl do wyboru
- `selectors.ts` dla selekcji danych
- `types.ts` dla lokalnych typów feature
- `actions.ts` albo `service.ts` dla warstwy orkiestracji

### 3. Standard odpowiedzialności

- `domain/` jest czyste i bez Reacta
- `data/` robi I/O i persistence
- `features/` składa use cases i UI
- `app/` skleja routing, providers i layouty

### 4. Standard testów

- utils/domain -> testy jednostkowe
- data modules -> testy integracyjne modułu
- hooks -> testy zachowania
- page flows -> testy user-facing critical paths

### 5. Standard jakości

Do dodania:

- `tsconfig.json` ze `strict: true`
- ESLint z zasadami React hooks, import order i no-unused-vars
- Prettier albo Biome
- prosty CI quality gate: test + build + lint

## Czego brakuje najbardziej

- jawnej struktury feature modules
- jawnego standardu pliku React
- osobnych hooków dla złożonych workflow
- mniejszych route pages
- rozbitego repozytorium danych
- lintingu i formatowania
- testów integracyjnych dla interakcji użytkownika
- route-level code splitting

## Rekomendowana kolejność prac

### Etap 1: Standard i guardrails

- dodać `tsconfig.json`
- dodać ESLint
- dodać formatter
- opisać conventions w `docs/`

### Etap 2: Rozbicie największych entrypointów

- rozdzielić `panel.tsx` na osobne route pages
- rozdzielić `public.tsx`
- zostawić API eksportów zgodne z `routes.tsx`, żeby refactor był bezpieczny

### Etap 3: Wydzielenie feature hooks i selectors

- dashboard
- groups
- events
- auth/enrollment

### Etap 4: Podział warstwy danych

- najpierw publiczne listy wydarzen i hooki read-modeli
- potem auth
- potem groups/events/enrollments

### Etap 5: Stabilizacja testów

- dodać testy flow dla grup i wydarzeń
- dodać smoke testy dla najważniejszych ścieżek panelowych

## Docelowy rezultat

Po uporządkowaniu projekt powinien mieć:

- małe route pages
- feature-based moduły
- czystą granicę `domain / data / features / app`
- cienkie providery
- osobne hooki dla workflow
- osobne selectors dla danych widoku
- przewidywalny standard nazewnictwa i testów

To nie wymaga przepisywania produktu od zera. Wystarczy konsekwentny refactor od największych plików i dopięcie brakującego tooling contract.
