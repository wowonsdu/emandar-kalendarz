<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function mock_seed_path(): string
{
    return realpath(__DIR__ . '/../../mock-data/seed-store.json') ?: __DIR__ . '/../../mock-data/seed-store.json';
}

function mock_runtime_path(): string
{
    $configured = getenv('EMANDAR_RUNTIME_STORE_PATH');
    if (is_string($configured) && trim($configured) !== '') {
        return trim($configured);
    }

    $productionDirectory = '/opt/panel.ceo/emandar-data';
    if (is_dir($productionDirectory)) {
        return $productionDirectory . '/runtime-store.json';
    }

    return dirname(__DIR__, 3) . '/.local-state/emandar/runtime-store.json';
}

function mock_runtime_directory(): string
{
    $runtimePath = mock_runtime_path();
    $extension = pathinfo($runtimePath, PATHINFO_EXTENSION);
    $baseName = basename($runtimePath, $extension === '' ? '' : '.' . $extension);

    if ($baseName === '') {
        $baseName = 'runtime-store';
    }

    return dirname($runtimePath) . '/' . $baseName;
}

function mock_meta_path(): string
{
    return mock_runtime_directory() . '/meta.json';
}

function mock_collection_keys(): array
{
    return [
        'users',
        'trainers',
        'organizers',
        'participantProfiles',
        'groups',
        'groupMembers',
        'eventParticipants',
        'relations',
        'trainingEvents',
        'availabilitySlots',
        'trainerSharedSlots',
        'trainerCalendarFeeds',
        'organizerCalendarFeeds',
        'trainerOrganizerCalendarFeeds',
        'trainerExternalBusyMonths',
        'organizerExternalBusyMonths',
        'enrollmentRequests',
        'notifications',
        'accountRequests',
        'trainerAccountApprovals',
        'appSettings',
    ];
}

function mock_default_notification_settings(): array
{
    return [
        'reminderLeadDays' => 7,
        'sendToTrainer' => true,
        'sendToOrganizer' => true,
        'sendToParticipants' => true,
        'requireParticipantSmsConfirmation' => false,
        'reminderSmsTemplate' =>
            'Przypomnienie o szkoleniu {{event_title}} dnia {{event_date}} w {{event_location}}.',
        'confirmationSmsTemplate' =>
            'Czy bierzesz udział w szkoleniu {{event_title}} dnia {{event_date}}? Tak: {{confirm_url}} Nie: {{decline_url}}',
    ];
}

function mock_default_store(): array
{
    return [
        'users' => [],
        'trainers' => [],
        'organizers' => [],
        'participantProfiles' => [],
        'groups' => [],
        'groupMembers' => [],
        'eventParticipants' => [],
        'relations' => [],
        'trainingEvents' => [],
        'publicTrainingEvents' => [],
        'availabilitySlots' => [],
        'trainerSharedSlots' => [],
        'trainerCalendarFeeds' => [],
        'organizerCalendarFeeds' => [],
        'trainerOrganizerCalendarFeeds' => [],
        'trainerExternalBusyMonths' => [],
        'organizerExternalBusyMonths' => [],
        'enrollmentRequests' => [],
        'notifications' => [],
        'accountRequests' => [],
        'trainerAccountApprovals' => [],
        'appSettings' => [
            'signupPhotoMode' => 'optional',
            'enrollmentPhotoMode' => 'optional',
            'defaultNotificationSettings' => mock_default_notification_settings(),
        ],
    ];
}

function mock_collection_path(string $collectionKey): string
{
    return mock_runtime_directory() . '/' . $collectionKey . '.json';
}

function mock_read_json_file(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $json = file_get_contents($path);
    if ($json === false || trim($json) === '') {
        return [];
    }

    $decoded = json_decode($json, true);
    return is_array($decoded) ? $decoded : [];
}

function mock_request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function mock_write_json_file(string $path, array $payload): void
{
    $directory = dirname($path);
    if (!is_dir($directory)) {
        mkdir($directory, 0777, true);
    }

    file_put_contents(
        $path,
        json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL,
        LOCK_EX
    );
}

function mock_runtime_store_to_persisted_collections(array $store): array
{
    $defaults = mock_default_store();
    $collections = [];

    foreach (mock_collection_keys() as $collectionKey) {
        $value = $store[$collectionKey] ?? $defaults[$collectionKey];
        $collections[$collectionKey] = is_array($value) ? $value : $defaults[$collectionKey];
    }

    return $collections;
}

function mock_store_from_persisted_collections(array $collections): array
{
    $defaults = mock_default_store();
    $store = $defaults;

    foreach (mock_collection_keys() as $collectionKey) {
        $value = $collections[$collectionKey] ?? $defaults[$collectionKey];
        $store[$collectionKey] = is_array($value) ? $value : $defaults[$collectionKey];
    }

    $store['publicTrainingEvents'] = [];

    return $store;
}

function mock_has_runtime_shards(): bool
{
    if (!is_file(mock_meta_path())) {
        return false;
    }

    foreach (mock_collection_keys() as $collectionKey) {
        if (!is_file(mock_collection_path($collectionKey))) {
            return false;
        }
    }

    return true;
}

function mock_write_runtime_collections(array $collections, ?int $version = null): array
{
    $normalizedCollections = mock_runtime_store_to_persisted_collections($collections);
    $meta = mock_read_json_file(mock_meta_path());
    $nextVersion = $version ?? (int) ($meta['version'] ?? 0) + 1;

    foreach ($normalizedCollections as $collectionKey => $value) {
        mock_write_json_file(mock_collection_path($collectionKey), $value);
    }

    $nextMeta = [
        'version' => $nextVersion,
        'updatedAt' => gmdate('c'),
    ];
    mock_write_json_file(mock_meta_path(), $nextMeta);

    return [
        'collections' => $normalizedCollections,
        'version' => $nextVersion,
    ];
}

function mock_bootstrap_runtime_if_needed(): void
{
    if (mock_has_runtime_shards()) {
        return;
    }

    $legacyRuntime = mock_read_json_file(mock_runtime_path());
    if ($legacyRuntime !== []) {
        mock_write_runtime_collections(mock_runtime_store_to_persisted_collections($legacyRuntime), 1);
        return;
    }

    $seed = mock_read_json_file(mock_seed_path());
    mock_write_runtime_collections(mock_runtime_store_to_persisted_collections($seed), 1);
}

function mock_read_runtime_collections(): array
{
    mock_bootstrap_runtime_if_needed();

    $collections = [];
    $defaults = mock_default_store();

    foreach (mock_collection_keys() as $collectionKey) {
        $value = mock_read_json_file(mock_collection_path($collectionKey));
        $collections[$collectionKey] = $value !== [] ? $value : $defaults[$collectionKey];
    }

    return $collections;
}

function mock_current_version(): int
{
    mock_bootstrap_runtime_if_needed();
    $meta = mock_read_json_file(mock_meta_path());
    return (int) ($meta['version'] ?? 1);
}

function mock_current_store_payload(): array
{
    $collections = mock_read_runtime_collections();

    return [
        'store' => mock_store_from_persisted_collections($collections),
        'version' => mock_current_version(),
    ];
}

function mock_current_version_payload(): array
{
    return [
        'version' => mock_current_version(),
    ];
}

function mock_persist_runtime_patch(array $collections, int $baseVersion): array
{
    mock_bootstrap_runtime_if_needed();

    $currentVersion = mock_current_version();
    if ($baseVersion !== $currentVersion) {
        return [
            'error' => 'version-conflict',
            'currentVersion' => $currentVersion,
        ];
    }

    $allowedKeys = array_flip(mock_collection_keys());
    $currentCollections = mock_read_runtime_collections();
    $writtenCollections = [];

    foreach ($collections as $collectionKey => $value) {
        if (!is_string($collectionKey) || !isset($allowedKeys[$collectionKey]) || !is_array($value)) {
            return [
                'error' => 'invalid-collections',
            ];
        }

        $currentCollections[$collectionKey] = $value;
        $writtenCollections[] = $collectionKey;
    }

    if ($writtenCollections === []) {
        return [
            'version' => $currentVersion,
            'writtenCollections' => [],
        ];
    }

    $persisted = mock_write_runtime_collections($currentCollections, $currentVersion + 1);

    return [
        'version' => $persisted['version'],
        'writtenCollections' => $writtenCollections,
    ];
}
