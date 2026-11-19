#!/bin/bash
set -e

echo "=========================================="
echo "         VakaLab Başlatılıyor...          "
echo "=========================================="

# 1. Ortam değişkenlerinden config/local.php üret (Dosya yoksa veya zorlanmışsa)
if [ ! -f /var/www/html/config/local.php ] || [ "${FORCE_REGENERATE_CONFIG:-false}" = "true" ]; then
    echo ">> config/local.php ortam değişkenlerinden üretiliyor..."
    php -r '
    $dbHost = getenv("DB_HOST") ?: "mysql";
    $dbPort = getenv("DB_PORT") ?: "3306";
    $dbName = getenv("DB_NAME") ?: "vakalab_test";
    $dbUser = getenv("DB_USER") ?: "root";
    $dbPass = getenv("DB_PASSWORD") !== false ? getenv("DB_PASSWORD") : "";
# 1. Ortam değişkenlerinden config/local.php üret
echo ">> config/local.php ortam değişkenlerinden üretiliyor..."
php -r '
$dbHost = getenv("DB_HOST") ?: "mysql";
$dbPort = getenv("DB_PORT") ?: "3306";
$dbName = getenv("DB_NAME") ?: "vakalab_test";
$dbUser = getenv("DB_USER") ?: "root";
$dbPass = getenv("DB_PASSWORD") !== false ? getenv("DB_PASSWORD") : "";

    $env = getenv("APP_ENV") ?: "test";
    $https = getenv("APP_HTTPS") !== false ? filter_var(getenv("APP_HTTPS"), FILTER_VALIDATE_BOOLEAN) : true;
    $basePath = getenv("APP_BASE_PATH") ?: "";
// Eğer kullanıcı tüm bağlantı URL sini DB_HOST veya DATABASE_URL içine yapıştırdıysa otomatik ayrıştır
$rawUrl = getenv("DATABASE_URL") ?: $dbHost;
if (str_starts_with($rawUrl, "mysql://")) {
    $parts = parse_url($rawUrl);
    if (!empty($parts["host"])) $dbHost = $parts["host"];
    if (!empty($parts["user"])) $dbUser = $parts["user"];
    if (isset($parts["pass"]))  $dbPass = $parts["pass"];
    if (!empty($parts["port"])) $dbPort = (string)$parts["port"];
    if (!empty($parts["path"])) $dbName = ltrim($parts["path"], "/");
}

    $aiProvider = getenv("AI_PROVIDER") ?: "mock";
    $aiModel = getenv("AI_MODEL") ?: "synthetic-v1";
    $aiEndpoint = getenv("AI_ENDPOINT") ?: "https://api.openai.com/v1/chat/completions";
    $aiKey = getenv("AI_KEY") ?: "";
    $aiTimeout = (int)(getenv("AI_TIMEOUT") ?: 90);
    $aiStructured = filter_var(getenv("AI_STRUCTURED_OUTPUTS") ?: "false", FILTER_VALIDATE_BOOLEAN);
$env = getenv("APP_ENV") ?: "test";
$https = getenv("APP_HTTPS") !== false ? filter_var(getenv("APP_HTTPS"), FILTER_VALIDATE_BOOLEAN) : true;
$basePath = getenv("APP_BASE_PATH") ?: "";

    $config = [
        "env" => $env,
        "dsn" => "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
        "db_user" => $dbUser,
        "db_password" => $dbPass,
        "base_path" => $basePath,
        "timezone" => "Europe/Istanbul",
        "https" => $https,
        "ai" => [
            "provider" => $aiProvider,
            "model" => $aiModel,
            "mode" => "normal",
            "endpoint" => $aiEndpoint,
            "key" => $aiKey,
            "timeout" => $aiTimeout,
            "structured_outputs" => $aiStructured,
        ],
        "autosave_ms" => 1200,
        "heartbeat_ms" => 15000,
        "idle_ms" => 60000,
        "consent_text" => getenv("CONSENT_TEXT") ?: "Kurum tarafından onaylanmış onam metni henüz sağlanmadı. Bu ortam test içindir.",
    ];
$aiProvider = getenv("AI_PROVIDER") ?: "mock";
$aiModel = getenv("AI_MODEL") ?: "synthetic-v1";
$aiEndpoint = getenv("AI_ENDPOINT") ?: "https://api.openai.com/v1/chat/completions";
$aiKey = getenv("AI_KEY") ?: "";
$aiTimeout = (int)(getenv("AI_TIMEOUT") ?: 90);
$aiStructured = filter_var(getenv("AI_STRUCTURED_OUTPUTS") ?: "false", FILTER_VALIDATE_BOOLEAN);

    $content = "<?php\n// Otomatik üretildi (Coolify / Docker Ortam Değişkenleri)\nreturn " . var_export($config, true) . ";\n";
    file_put_contents("/var/www/html/config/local.php", $content);
    '
    echo ">> config/local.php başarıyla hazırlandı."
fi
$config = [
    "env" => $env,
    "dsn" => "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
    "db_user" => $dbUser,
    "db_password" => $dbPass,
    "base_path" => $basePath,
    "timezone" => "Europe/Istanbul",
    "https" => $https,
    "ai" => [
        "provider" => $aiProvider,
        "model" => $aiModel,
        "mode" => "normal",
        "endpoint" => $aiEndpoint,
        "key" => $aiKey,
        "timeout" => $aiTimeout,
        "structured_outputs" => $aiStructured,
    ],
    "autosave_ms" => 1200,
    "heartbeat_ms" => 15000,
    "idle_ms" => 60000,
    "consent_text" => getenv("CONSENT_TEXT") ?: "Kurum tarafından onaylanmış onam metni henüz sağlanmadı. Bu ortam test içindir.",
];

$content = "<?php\n// Otomatik üretildi (Coolify / Docker Ortam Değişkenleri)\nreturn " . var_export($config, true) . ";\n";
file_put_contents("/var/www/html/config/local.php", $content);
'
echo ">> config/local.php başarıyla hazırlandı."

# 2. MySQL Bağlantısını ve Veritabanını Bekle / Doğrula
echo ">> MySQL veritabanı bağlantısı kontrol ediliyor..."
php -r '
$dbHost = getenv("DB_HOST") ?: "mysql";
$dbPort = getenv("DB_PORT") ?: "3306";
$dbName = getenv("DB_NAME") ?: "vakalab_test";
$dbUser = getenv("DB_USER") ?: "root";
$dbPass = getenv("DB_PASSWORD") !== false ? getenv("DB_PASSWORD") : "";

$rawUrl = getenv("DATABASE_URL") ?: $dbHost;
if (str_starts_with($rawUrl, "mysql://")) {
    $parts = parse_url($rawUrl);
    if (!empty($parts["host"])) $dbHost = $parts["host"];
    if (!empty($parts["user"])) $dbUser = $parts["user"];
    if (isset($parts["pass"]))  $dbPass = $parts["pass"];
    if (!empty($parts["port"])) $dbPort = (string)$parts["port"];
    if (!empty($parts["path"])) $dbName = ltrim($parts["path"], "/");
}

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
'

# 3. Migration İşlemini Çalıştır
echo ">> Tablo migration işlemleri yürütülüyor..."
php /var/www/html/bin/console.php migrate || {
    echo ">> UYARI: Migration çıktısı alındı."
}

# 4. Araştırmacı / Yönetici Hesabı Oluştur (Eğer VAKALAB_ADMIN_PASSWORD tanımlanmışsa)
if [ -n "$VAKALAB_ADMIN_PASSWORD" ]; then
    ADMIN_LOGIN="${VAKALAB_ADMIN_LOGIN:-arastirmaci}"
    echo ">> Araştırmacı hesabı kontrol ediliyor ($ADMIN_LOGIN)..."
    php /var/www/html/bin/console.php researcher "$ADMIN_LOGIN" 2>&1 || echo ">> Not: Araştırmacı hesabı zaten mevcut veya oluşturulamadı (atlandı)."
fi

# 5. İsteğe Bağlı: Test Seed Yükle (Eğer VAKALAB_SEED_PASSWORD tanımlanmışsa)
if [ -n "$VAKALAB_SEED_PASSWORD" ]; then
    echo ">> Test verileri (seed) yükleniyor..."
    php /var/www/html/bin/console.php seed 2>&1 || echo ">> Not: Seed adımı tamamlandı veya koşullar nedeniyle atlandı."
fi

# 6. Dizin İzinlerini Kontrol Et
chown -R www-data:www-data /var/www/html/storage /var/www/html/config 2>/dev/null || true

echo "=========================================="
echo ">> VakaLab Hazır! Web Sunucusu Başlatılıyor."
echo "=========================================="

exec "$@"
