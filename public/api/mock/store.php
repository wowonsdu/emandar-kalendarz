<?php

declare(strict_types=1);

require __DIR__ . '/common.php';

http_response_code(200);
echo json_encode(mock_current_store_payload(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
