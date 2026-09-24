<?php
declare(strict_types=1);

use MongoDB\BSON\UTCDateTime;
use MongoDB\BSON\Binary;
use MongoDB\Driver\Manager;

function sg_json(array $body, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function sg_body(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) sg_json(['error' => 'Request too large.'], 413);
    $raw = file_get_contents('php://input', false, null, 0, 32769);
    if (strlen($raw) > 32768) sg_json(['error' => 'Request too large.'], 413);
    try { $body = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException) { sg_json(['error' => 'Invalid request.'], 400); }
    if (!is_array($body)) sg_json(['error' => 'Invalid request.'], 400);
    return $body;
}

function sg_metadata(array $body, array $services): array {
    $result = [];
    foreach ([['title', 160, true], ['description', 2000, true], ['titleAr', 160, false], ['descriptionAr', 2000, false], ['service', 80, true]] as [$key, $max, $required]) {
        $value = $body[$key] ?? '';
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || mb_strlen(trim($value), 'UTF-8') > $max || ($required && trim($value) === '')) {
            sg_json(['error' => "Please provide a valid $key (maximum $max characters)."], 400);
        }
        $result[$key] = trim($value);
    }
    if (!in_array($result['service'], $services, true)) sg_json(['error' => 'Select a Super Graphic service.'], 400);
    return $result;
}

function sg_present(array $row): array {
    $keys = ['id', 'title', 'description', 'titleAr', 'descriptionAr', 'service', 'width', 'height', 'createdAt'];
    $item = array_intersect_key($row, array_flip($keys));
    $item['url'] = '/media-files/' . rawurlencode($row['filename']);
    return $item;
}

function sg_image(): array {
    $file = $_FILES['image'] ?? null;
    if (!$file || is_array($file['error']) || $file['error'] !== UPLOAD_ERR_OK || count($_FILES) !== 1 || $file['size'] > 12 * 1024 * 1024) {
        sg_json(['error' => 'Choose one JPG, PNG or WebP image up to 12 MB.'], 400);
    }
    $info = @getimagesize($file['tmp_name']);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!$info || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) || $info[0] * $info[1] > 40_000_000) {
        sg_json(['error' => 'Upload a valid JPG, PNG or WebP image up to 40 megapixels.'], 400);
    }
    $image = @imagecreatefromstring(file_get_contents($file['tmp_name']));
    if (!$image) sg_json(['error' => 'The image could not be decoded.'], 400);
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($file['tmp_name']);
        $orientation = $exif['Orientation'] ?? 1;
        if (in_array($orientation, [2, 5, 7], true)) imageflip($image, IMG_FLIP_HORIZONTAL);
        if ($orientation === 4) imageflip($image, IMG_FLIP_VERTICAL);
        $rotation = match ($orientation) { 3 => 180, 5, 6 => -90, 7, 8 => 90, default => 0 };
        if ($rotation) { $rotated = imagerotate($image, $rotation, 0); imagedestroy($image); $image = $rotated; }
    }
    $scale = min(1, 2200 / max(imagesx($image), imagesy($image)));
    $width = max(1, (int)round(imagesx($image) * $scale));
    $height = max(1, (int)round(imagesy($image) * $scale));
    $canvas = imagecreatetruecolor($width, $height);
    imagealphablending($canvas, false);
    imagesavealpha($canvas, true);
    imagefill($canvas, 0, 0, imagecolorallocatealpha($canvas, 0, 0, 0, 127));
    imagecopyresampled($canvas, $image, 0, 0, 0, 0, $width, $height, imagesx($image), imagesy($image));
    $stream = tmpfile();
    if (!$stream || !imagewebp($canvas, $stream, 85)) throw new RuntimeException('Image conversion failed.');
    imagedestroy($image);
    imagedestroy($canvas);
    rewind($stream);
    return [$stream, $width, $height];
}

function sg_run(array $config, string $private): never {
    foreach (['mongodb_uri', 'admin_password_hash', 'site_origin'] as $key) {
        if (empty($config[$key])) throw new RuntimeException('Configuration missing.');
    }
    $origin = rtrim($config['site_origin'], '/');
    $production = $config['production'] ?? true;
    if ($production && parse_url($origin, PHP_URL_SCHEME) !== 'https') throw new RuntimeException('HTTPS is required.');
    if (password_get_info($config['admin_password_hash'])['algoName'] === 'unknown') throw new RuntimeException('Invalid password hash.');
    $method = $_SERVER['REQUEST_METHOD'];
    $path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
    if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true) && ($_SERVER['HTTP_ORIGIN'] ?? '') !== $origin) {
        sg_json(['error' => 'Request origin not allowed.'], 403);
    }
    $options = ['serverSelectionTimeoutMS' => 10000];
    if (!empty($config['mongodb_username']) && !empty($config['mongodb_password'])) {
        $options['username'] = $config['mongodb_username'];
        $options['password'] = $config['mongodb_password'];
    }
    $client = new Manager($config['mongodb_uri'], $options);
    $db = new SgDatabase($client, $config['mongodb_database'] ?? 'supergraphic');
    $media = $db->collection('media');
    $meta = $db->collection('app_meta');
    $sessions = $db->collection('php_sessions');
    $attempts = $db->collection('php_login_attempts');
    $images = $db->collection('php_images');
    $seeds = json_decode(file_get_contents($private . '/seed-media/manifest.json'), true, 64, JSON_THROW_ON_ERROR);
    $services = json_decode(file_get_contents($private . '/services.json'), true, 16, JSON_THROW_ON_ERROR);

    if (!$meta->findOne(['_id' => 'php-schema-v1'])) {
        $media->createIndex(['id' => 1], ['unique' => true]);
        $media->createIndex(['createdAt' => -1, 'id' => -1]);
        $sessions->createIndex(['expiresAt' => 1], ['expireAfterSeconds' => 0]);
        $attempts->createIndex(['expiresAt' => 1], ['expireAfterSeconds' => 0]);
        $meta->updateOne(['_id' => 'php-schema-v1'], ['$set' => ['value' => 'complete']], ['upsert' => true]);
    }
    if (!$meta->findOne(['_id' => 'initial-gallery-v1'])) {
        $session = $client->startSession();
        try {
            $session->startTransaction();
            if (!$meta->findOne(['_id' => 'initial-gallery-v1'], ['session' => $session])) {
                foreach ($seeds as $seed) {
                    $seed['createdAt'] = gmdate('Y-m-d\TH:i:s', time() - $seed['order']) . '.000Z';
                    unset($seed['order']);
                    $media->updateOne(['id' => $seed['id']], ['$setOnInsert' => $seed], ['upsert' => true, 'session' => $session]);
                }
                $meta->insertOne(['_id' => 'initial-gallery-v1', 'value' => 'complete'], ['session' => $session]);
            }
            $session->commitTransaction();
        } catch (Throwable $error) {
            if ($session->isInTransaction()) $session->abortTransaction();
            // Another first request may have completed the same import.
            if (!$meta->findOne(['_id' => 'initial-gallery-v1'])) throw $error;
        } finally { $session->endSession(); }
    }

    $cookieName = $production ? '__Host-supergraphic_media' : 'supergraphic_media';
    $tokenHash = hash('sha256', (string)($_COOKIE[$cookieName] ?? ''));
    $credential = hash('sha256', $config['admin_password_hash']);
    $authenticated = fn() => (bool)$sessions->findOne(['_id' => $tokenHash, 'credential' => $credential, 'expiresAt' => ['$gt' => new UTCDateTime()]]);
    $cookieOptions = ['path' => '/', 'secure' => $production, 'httponly' => true, 'samesite' => 'Strict'];

    if ($path === '/api/media/session' && $method === 'GET') sg_json(['authenticated' => $authenticated()]);
    if ($path === '/api/media/login' && $method === 'POST') {
        $window = (int)floor(time() / 900);
        $attemptId = hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . ':' . $window, $config['admin_password_hash']);
        $counter = $attempts->incrementAttempt($attemptId, new UTCDateTime(($window + 2) * 900 * 1000));
        if ($counter > 10) sg_json(['error' => 'Too many sign-in attempts. Try again in 15 minutes.'], 429);
        $password = sg_body()['password'] ?? null;
        if (!is_string($password) || strlen($password) > 256 || !password_verify($password, $config['admin_password_hash'])) sg_json(['error' => 'Incorrect password.'], 401);
        $sessions->deleteOne(['_id' => $tokenHash]);
        $token = bin2hex(random_bytes(32));
        $expires = time() + 8 * 3600;
        $sessions->insertOne(['_id' => hash('sha256', $token), 'credential' => $credential, 'expiresAt' => new UTCDateTime($expires * 1000)]);
        setcookie($cookieName, $token, [...$cookieOptions, 'expires' => $expires]);
        sg_json(['authenticated' => true]);
    }
    if ($path === '/api/media/logout' && $method === 'POST') {
        $sessions->deleteOne(['_id' => $tokenHash]);
        setcookie($cookieName, '', [...$cookieOptions, 'expires' => time() - 3600]);
        sg_json(['authenticated' => false]);
    }
    if ($path === '/api/media' && $method === 'GET') {
        $items = array_map('sg_present', $media->find([], ['sort' => ['createdAt' => -1, 'id' => -1]])->toArray());
        sg_json(['items' => $items]);
    }
    if (preg_match('~^/media-files/([^/]+)$~D', $path, $match) && in_array($method, ['GET', 'HEAD'], true)) {
        $filename = $match[1];
        if (!$media->findOne(['filename' => $filename])) sg_json(['error' => 'Image not found.'], 404);
        if (in_array($filename, array_column($seeds, 'filename'), true)) {
            $filePath = $private . '/seed-media/' . $filename;
            $length = filesize($filePath);
            $stream = fopen($filePath, 'rb');
        } else {
            $file = $images->findOne(['_id' => $filename]);
            if (!$file) sg_json(['error' => 'Image not found.'], 404);
            $data = $file['data']->getData();
            $length = strlen($data);
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, $data); rewind($stream);
        }
        header('Content-Type: image/webp');
        header('Content-Length: ' . $length);
        header('Cache-Control: public, max-age=31536000, immutable');
        if ($method === 'GET') fpassthru($stream);
        fclose($stream);
        exit;
    }
    if ($path === '/api/media' && $method === 'POST') {
        if (!$authenticated()) sg_json(['error' => 'Your session has expired. Please sign in again.'], 401);
        $fields = sg_metadata($_POST, $services);
        [$stream, $width, $height] = sg_image();
        $id = bin2hex(random_bytes(16));
        $filename = $id . '.webp';
        try {
            $bytes = stream_get_contents($stream);
            // Keep the entire BSON document safely below MongoDB's 16 MB limit.
            if (strlen($bytes) > 12 * 1024 * 1024) sg_json(['error' => 'The processed image is too large. Try a smaller image.'], 400);
            $images->insertOne(['_id' => $filename, 'data' => new Binary($bytes, Binary::TYPE_GENERIC)]);
        }
        finally { fclose($stream); }
        $item = [...$fields, 'id' => $id, 'filename' => $filename, 'width' => $width, 'height' => $height, 'createdAt' => gmdate('Y-m-d\TH:i:s') . '.000Z'];
        try { $media->insertOne($item); }
        catch (Throwable $error) { $images->deleteOne(['_id' => $filename]); throw $error; }
        sg_json(['item' => sg_present($item)], 201);
    }
    if (preg_match('~^/api/media/([a-zA-Z0-9-]+)$~D', $path, $match) && in_array($method, ['PATCH', 'DELETE'], true)) {
        if (!$authenticated()) sg_json(['error' => 'Your session has expired. Please sign in again.'], 401);
        $id = $match[1];
        $item = $media->findOne(['id' => $id]);
        if (!$item) sg_json(['error' => 'Image not found.'], 404);
        if ($method === 'PATCH') {
            $fields = sg_metadata(sg_body(), $services);
            $media->updateOne(['id' => $id], ['$set' => $fields]);
            sg_json(['item' => sg_present([...$item, ...$fields])]);
        }
        $images->deleteOne(['_id' => $item['filename']]);
        $media->deleteOne(['id' => $id]);
        sg_json(['deleted' => true]);
    }
    sg_json(['error' => 'Endpoint not found.'], 404);
}
