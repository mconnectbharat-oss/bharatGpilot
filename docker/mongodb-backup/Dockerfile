FROM mongo:8.0-noble
RUN apt-get update \
    && apt-get install -y --no-install-recommends cron ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY scripts/mongodb-backup.sh /usr/local/bin/mongodb-backup
RUN chmod 0755 /usr/local/bin/mongodb-backup \
    && printf '0 0 * * * root /usr/local/bin/mongodb-backup >> /proc/1/fd/1 2>&1\n' > /etc/cron.d/mongodb-backup \
    && chmod 0644 /etc/cron.d/mongodb-backup
CMD ["sh", "-c", "echo 'MongoDB backup scheduler started; schedule is 00:00 UTC.'; /usr/sbin/cron -f"]
