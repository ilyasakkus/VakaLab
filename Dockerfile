FROM php:8.3-apache

# Gerekli sistem paketlerini kur
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libonig-dev \
    libxml2-dev \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# PHP eklentilerini kur ve derle
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo \
    pdo_mysql \
    mbstring \
    zip \
    gd \
    opcache

# Apache DocumentRoot ayarı -> /var/www/html/public (Güvenlik için tek web kökü)
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
    && sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
    && a2enmod rewrite headers

# PHP çalışma zamanı ayarları
RUN echo "memory_limit = 256M\n\
upload_max_filesize = 50M\n\
post_max_size = 50M\n\
max_execution_time = 120\n\
date.timezone = Europe/Istanbul" > /usr/local/etc/php/conf.d/vakalab.ini

# Resmi Composer aracını kopyala
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Composer bağımlılıklarını önbellek avantajı için önce kopyalayıp kur
COPY composer.json composer.lock ./
RUN composer install --no-dev --prefer-dist --no-autoloader --no-interaction --ignore-platform-req=php

# Proje kaynak kodlarını kopyala
COPY . .

# Composer autoloader'ını tamamla
RUN composer dump-autoload --optimize --no-dev

# İzinleri ayarla
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod +x /var/www/html/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/var/www/html/entrypoint.sh"]
CMD ["apache2-foreground"]
