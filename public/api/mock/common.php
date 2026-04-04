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

function mock_write_store(array $store): array
{
    $runtimePath = mock_runtime_path();
    $directory = dirname($runtimePath);

    if (!is_dir($directory)) {
        mkdir($directory, 0777, true);
    }

    file_put_contents(
        $runtimePath,
        json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL
    );

    clearstatcache(true, $runtimePath);

    return [
        'store' => $store,
        'version' => filemtime($runtimePath) ?: time(),
    ];
}

function mock_current_store_payload(): array
{
    $runtimePath = mock_runtime_path();
    $runtimeStore = mock_read_json_file($runtimePath);

    if ($runtimeStore !== []) {
        return [
            'store' => $runtimeStore,
            'version' => is_file($runtimePath) ? (filemtime($runtimePath) ?: time()) : time(),
        ];
    }

    $seed = mock_read_json_file(mock_seed_path());
    return mock_write_store($seed);
}
