<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method-not-allowed']);
    exit;
}

$body = mock_request_body();
$store = $body['store'] ?? null;

if (!is_array($store)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid-store']);
    exit;
}

http_response_code(200);
echo json_encode(mock_write_store($store), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
