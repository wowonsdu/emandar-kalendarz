<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method-not-allowed']);
    exit;
}

$body = mock_request_body();
$baseVersion = $body['baseVersion'] ?? null;
$collections = $body['collections'] ?? null;

if (!is_int($baseVersion) || !is_array($collections)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid-patch']);
    exit;
}

$result = mock_persist_runtime_patch($collections, $baseVersion);

if (($result['error'] ?? null) === 'version-conflict') {
    http_response_code(409);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if (($result['error'] ?? null) === 'invalid-collections') {
    http_response_code(400);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(200);
echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
