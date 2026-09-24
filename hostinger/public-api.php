<?php
declare(strict_types=1);

// This file is installed as public_html/api/index.php.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

$private = dirname(__DIR__, 2) . '/supergraphic-private';
try {
    if (!is_file($private . '/config.php')) {
        http_response_code(503);
        echo json_encode(['error' => 'The gallery is not configured yet.']);
        exit;
    }
    require $private . '/database.php';
    require $private . '/app.php';
    sg_run(require $private . '/config.php', $private);
} catch (Throwable $error) {
    // Never expose a database URI, password or stack trace in the response/log.
    error_log('Super Graphic API failure: ' . get_class($error) . ' [' . $error->getCode() . ']');
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => 'The gallery is temporarily unavailable. Please try again.']);
}
