#!/bin/bash
set -e

echo "=========================================="
echo "         VakaLab Başlatılıyor...          "
echo "=========================================="

php /var/www/html/bin/docker-entrypoint.php

chown -R www-data:www-data /var/www/html/storage /var/www/html/config 2>/dev/null || true

echo "=========================================="
echo ">> VakaLab Hazır! Web Sunucusu Başlatılıyor."
echo "=========================================="

exec "$@"
