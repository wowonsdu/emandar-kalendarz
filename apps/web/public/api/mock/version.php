<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'method-not-allowed']);
    exit;
}

http_response_code(200);
echo json_encode(mock_current_version_payload(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
