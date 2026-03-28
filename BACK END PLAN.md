# Plan migracji `emandar-kalendarz` z Cloud Functions na własny backend VPS

## Summary

- Cel: całkowicie zdjąć z `emandar-kalendarz` Cloud Functions i przenieść ich rolę na VPS `51.68.143.29`, bez naruszenia działania `panel.ceo`, `momentum-way`, `sms.panel.ceo`, `magazynek.online` i reszty współdzielonego proxy.
- Zakres zaakceptowany: zostają `Firebase Auth`, `Firestore` i `Storage`; migrujemy logikę backendową HTTP/callable, scheduler SMS i obecne document-trigger side effecty.
- Routing docelowy: frontend zostaje pod `https://panel.ceo/emandar/`, nowe API będzie pod `https://panel.ceo/emandar/api/*`.
- Architektura docelowa: modularny monolit `Node 22 + TypeScript + Fastify`, uruchamiany jako dwa procesy z jednego repozytorium:
  - `emandar-api` dla endpointów HTTP
  - `emandar-worker` dla schedulera i zadań SMS
- Cutover: jedno pełne przełączenie, bez trybu hybrydowego.

## Implementation Changes

- VPS:
  - Utworzyć nowy izolowany deploy root `/opt/emandar-api/current`.
  - Postawić osobny `docker compose` tylko dla Emandar z usługami `api` i `worker`.
  - Podłączyć oba kontenery do istniejącej sieci Docker `deploy_default`, bez ingerencji w inne compose projekty.
  - Nie stawiać nowego terminatora TLS; wykorzystać istniejący `shared-proxy`.
- Caddy:
  - W istniejącym bloku `panel.ceo` dodać wyżej niż statyczne `/emandar/*` nowy additive route:
    - `handle_path /emandar/api/* { reverse_proxy emandar-api:8080 }`
  - Zachować obecne `redir /emandar` i statyczne serwowanie `/emandar/`.
  - Nie zmieniać żadnych innych host blocków.
- Backend API:
  - Zachować kompatybilność semantyczną przez RPC-over-HTTP, a nie REST refactor.
  - Wystawić `POST /emandar/api/v1/rpc/<operation>` dla obecnych callable:
    - `finalizePhoneRegistration`
    - `ensurePhoneParticipantProfile`
    - `getCommunityEventReview`
    - `reviewCommunityEvent`
    - `approveAccountRequest`
    - `rejectAccountRequest`
    - `decideTrainerAccountApproval`
    - `createUnifiedTrainingEvent`
    - `createEnrollmentDraft`
    - `finalizeEnrollmentDraft`
    - `decideEnrollment`
    - `manageEnrollmentRequest`
    - `manageOwnEnrollment`
    - `confirmEnrollmentAttendance`
    - `updateTrainingEventManagement`
    - `archiveTrainingEvent`
    - `syncOwnTrainerCalendarFeeds`
  - Dodać nowe endpointy API dla mutacji, które dziś idą bezpośrednio do Firestore, ale niosą side effecty po triggerach:
    - `requestRelation`
    - `decideRelation`
    - `detachRelation`
    - `decideTrainingEventCollaboration`
  - Uwierzytelnianie:
    - endpointy zalogowane przyjmują `Authorization: Bearer <Firebase ID token>`
    - backend weryfikuje token przez `firebase-admin`
    - endpointy publiczne/anonimowe (`getCommunityEventReview`, `reviewCommunityEvent`, `confirmEnrollmentAttendance`) zostają token-based bez wymagania loginu
- Zastąpienie triggerów:
  - Logikę `onRelationWrite` przenieść do endpointów relacji.
  - Logikę `onEnrollmentRequestWrite` przenieść do endpointów enrollmentów i zarządzania zapisami.
  - Logikę `onTrainingEventWrite` przenieść do tworzenia/zarządzania szkoleniem i decyzji współpracy.
  - Wynik: po cutover nie zostają żadne wymagane Cloud Functions.
- Scheduler i SMS:
  - Źródłem prawdy zostaje Firestore, w szczególności kolekcja `smsDispatches`.
  - `emandar-worker` uruchamia dwa cykle co 1 minutę:
    - `reminder-planner`: skanuje nadchodzące szkolenia i tworzy brakujące `smsDispatches` deterministycznie, jak obecne Functions, ale z precyzją minutową
    - `sms-dispatcher`: pobiera `smsDispatches` ze statusem `pending-provider`, wysyła do `sms.panel.ceo`, zapisuje `messageId`, status i metadane
  - Dodać trzeci cykl `sms-status-poller` dla wiadomości niekońcowych (`accepted`, `queued`, `sending`, `provider_queued`) i aktualizować je przez `GET /v1/messages/:messageId`.
  - Integracja z `sms.panel.ceo`:
    - `POST /v1/messages/sms`
    - `Idempotency-Key = dispatchId`
    - `clientMessageId = dispatchId`
    - Bearer token per usługa Emandar
  - Nie dodawać Redis/Postgres w tym etapie; worker ma działać na Firestore + lease/idempotency.
- Frontend:
  - Zastąpić `callFirebaseFunction` adapterem HTTP do `/emandar/api/v1/rpc/*`.
  - Usunąć produkcyjną zależność od `firebase/functions`; emulatory Functions nie będą już wymagane w docelowym flow.
  - Odczyty Firestore mogą zostać po stronie klienta.
  - Direct Firestore writes, które nie wymagają triggerów i nie wchodzą w scheduler, mogą pozostać w etapie 1:
    - profile użytkowników/trenerów/organizatorów
    - notification settings
    - brand status
    - availability slots
    - CRUD feedów iCal
    - `app_meta/publicSettings`
    - uploady do Storage

## Public Interfaces And Config

- Nowy publiczny interfejs:
  - `POST /emandar/api/v1/rpc/<operation>`
- Nowe sekrety/env dla `emandar-api` i `emandar-worker`:
  - Firebase Admin credentials dla `emandar-prod`
  - `EMANDAR_SMS_SERVICE_TOKEN`
  - `EMANDAR_SMS_BASE_URL=https://sms.panel.ceo`
  - `EMANDAR_PUBLIC_BASE_URL=https://panel.ceo/emandar`
  - `EMANDAR_API_BASE_PATH=/emandar/api`
  - `TZ=Europe/Warsaw`
- Operacyjnie trzeba utworzyć osobny serwis/API key dla Emandar w `sms.panel.ceo`, zamiast używać wspólnych sekretów innych aplikacji.

## Test Plan

- Lokalnie:
  - testy jednostkowe dla domeny przeniesionej z `functions/index.js`
  - testy kontraktowe endpointów RPC z mockiem `firebase-admin` i `sms.panel.ceo`
  - testy workerów dla:
    - planowania reminderów
    - idempotentnego tworzenia `smsDispatches`
    - wysyłki i polling statusów SMS
    - confirm/decline attendance linków
- Scenariusze integracyjne:
  - utworzenie szkolenia
  - zapis uczestnika draft/finalize
  - decyzja trenera/organizatora/admina o zapisie
  - przeniesienie zapisu między szkoleniami
  - request/approve/detach relation
  - zmiana collaboration status przy wydarzeniu
  - wygenerowanie remindera SMS o właściwej minucie
  - pojedyncza wysyłka SMS mimo powtórzonego ticka workera
- Weryfikacja na VPS po wdrożeniu:
  - `https://panel.ceo/emandar/` działa jak wcześniej
  - `https://panel.ceo/emandar/api/health` zwraca `200`
  - brak regresji na:
    - `https://panel.ceo/momentum-way/`
    - `https://sms.panel.ceo/admin`
    - `https://magazynek.online/`
    - `https://gdzieciegniecie.pl/`

## Assumptions And Defaults

- Firebase pozostaje źródłem danych i auth w etapie 1.
- Migracja obejmuje całkowite odejście od Cloud Functions dla Emandar po wdrożeniu nowego API/workerów.
- Modułowość oznacza modularny kod domenowy i osobne entrypointy `api`/`worker`, nie osobne mikroserwisy per funkcja.
- W etapie 1 redeployujemy cały backend Emandar jako jeden obraz; nie planujemy osobnego deployu binarki per pojedyncza funkcja.
- Bezpieczeństwo serwera ma pierwszeństwo nad wygodą: wszystkie zmiany w proxy i Dockerze są additive i izolowane do `emandar`.
