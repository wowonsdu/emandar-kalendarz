<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method-not-allowed']);
    exit;
}

$seed = mock_read_json_file(mock_seed_path());

http_response_code(200);
echo json_encode(mock_write_store($seed), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
