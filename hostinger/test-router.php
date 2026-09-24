<?php
// Local integration tests only. This file is never included in the upload ZIP.
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if (str_starts_with($path, '/api') || str_starts_with($path, '/media-files')) {
    require $_SERVER['DOCUMENT_ROOT'] . '/api/index.php';
    return true;
}
if (is_file($_SERVER['DOCUMENT_ROOT'] . $path)) return false;
readfile($_SERVER['DOCUMENT_ROOT'] . '/index.html');
