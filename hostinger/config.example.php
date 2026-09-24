<?php
// Place config.php in supergraphic-private, OUTSIDE public_html.
return [
    'mongodb_uri' => '',
    'mongodb_username' => '',
    'mongodb_password' => '',
    'mongodb_database' => 'supergraphic',
    'site_origin' => 'https://supergraphic.ae',
    // PHP password_hash output, not the Node.js salt:hash format.
    'admin_password_hash' => '',
    'production' => true,
];
