<?php
declare(strict_types=1);

echo ">> config/local.php ortam değişkenlerinden hazırlanıyor...\n";

$dbHost = trim(getenv('DB_HOST') ?: 'mysql');
$dbPort = trim(getenv('DB_PORT') ?: '3306');
$dbName = trim(getenv('DB_NAME') ?: 'vakalab_test');
$dbUser = trim(getenv('DB_USER') ?: 'root');
$dbPass = getenv('DB_PASSWORD') !== false ? trim(getenv('DB_PASSWORD')) : '';

// DATABASE_URL veya DB_HOST mysql:// ile başlıyorsa otomatik ayrıştır
$rawUrl = getenv('DATABASE_URL') ?: $dbHost;
if (str_starts_with($rawUrl, 'mysql://')) {
    $parts = parse_url($rawUrl);
    if (!empty($parts['host'])) $dbHost = trim($parts['host']);
    if (!empty($parts['user'])) $dbUser = trim($parts['user']);
    if (isset($parts['pass']))  $dbPass = trim($parts['pass']);
    if (!empty($parts['port'])) $dbPort = trim((string)$parts['port']);
    if (!empty($parts['path'])) $dbName = trim(ltrim($parts['path'], '/'));
}

$env = trim(getenv('APP_ENV') ?: 'test');
$https = getenv('APP_HTTPS') !== false ? filter_var(getenv('APP_HTTPS'), FILTER_VALIDATE_BOOLEAN) : true;
$basePath = trim(getenv('APP_BASE_PATH') ?: '');

$aiProvider = trim(getenv('AI_PROVIDER') ?: 'mock');
$aiModel = trim(getenv('AI_MODEL') ?: 'synthetic-v1');
$aiEndpoint = trim(getenv('AI_ENDPOINT') ?: 'https://api.openai.com/v1/chat/completions');
$aiKey = trim(getenv('AI_KEY') ?: '');
$aiTimeout = (int)(getenv('AI_TIMEOUT') ?: 90);
$aiStructured = filter_var(getenv('AI_STRUCTURED_OUTPUTS') ?: 'false', FILTER_VALIDATE_BOOLEAN);

$config = [
    'env' => $env,
    'dsn' => "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
    'db_user' => $dbUser,
    'db_password' => $dbPass,
    'base_path' => $basePath,
    'timezone' => 'Europe/Istanbul',
    'https' => $https,
    'ai' => [
        'provider' => $aiProvider,
        'model' => $aiModel,
        'mode' => 'normal',
        'endpoint' => $aiEndpoint,
        'key' => $aiKey,
        'timeout' => $aiTimeout,
        'structured_outputs' => $aiStructured,
    ],
    'autosave_ms' => 1200,
    'heartbeat_ms' => 15000,
    'idle_ms' => 60000,
    'consent_text' => getenv('CONSENT_TEXT') ?: 'Kurum tarafından onaylanmış onam metni henüz sağlanmadı. Bu ortam test içindir.',
];

$export = "<?php\n// Otomatik üretildi (Coolify / Docker Ortam Değişkenleri)\nreturn " . var_export($config, true) . ";\n";
file_put_contents(__DIR__ . '/../config/local.php', $export);
echo ">> config/local.php başarıyla hazırlandı.\n";

echo ">> MySQL veritabanı bağlantısı kontrol ediliyor ({$dbHost}:{$dbPort})...\n";
$maxTries = 30;
$connected = false;

for ($i = 1; $i <= $maxTries; $i++) {
    try {
        $pdo = new PDO("mysql:host={$dbHost};port={$dbPort};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 3
        ]);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        echo ">> MySQL bağlantısı başarılı ve \"{$dbName}\" veritabanı hazır.\n";
        $connected = true;
        break;
    } catch (Throwable $e) {
        echo ">> MySQL bağlantısı bekleniyor ($i/$maxTries)... (" . $e->getMessage() . ")\n";
        sleep(2);
    }
}

if (!$connected) {
    fwrite(STDERR, "HATA: MySQL veritabanına bağlanılamadı! Lütfen DB_HOST, DB_USER ve DB_PASSWORD değişkenlerini kontrol edin.\n");
    exit(1);
}

// Migration çalıştır
echo ">> Tablo migration işlemleri yürütülüyor...\n";
passthru('php ' . escapeshellarg(__DIR__ . '/console.php') . ' migrate');

// Araştırmacı oluştur
$adminPass = getenv('VAKALAB_ADMIN_PASSWORD');
if ($adminPass !== false && $adminPass !== '') {
    $adminLogin = getenv('VAKALAB_ADMIN_LOGIN') ?: 'arastirmaci';
    echo ">> Araştırmacı hesabı kontrol ediliyor ({$adminLogin})...\n";
    passthru('php ' . escapeshellarg(__DIR__ . '/console.php') . ' researcher ' . escapeshellarg($adminLogin));
}

// Seed yükle (isteğe bağlı)
$seedPass = getenv('VAKALAB_SEED_PASSWORD');
if ($seedPass !== false && $seedPass !== '') {
    echo ">> Test verileri (seed) yükleniyor...\n";
    passthru('php ' . escapeshellarg(__DIR__ . '/console.php') . ' seed');
}
