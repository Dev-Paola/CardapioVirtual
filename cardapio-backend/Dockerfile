FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip

RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Instala as extensões PECL usadas pelo projeto e pelo worker Redis.
RUN pecl install ds-1.5.0 \
    && docker-php-ext-enable ds \
    && pecl install redis \
    && docker-php-ext-enable redis

RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www
