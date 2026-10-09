#!/bin/sh
set -eu
: "${MONGODB_BACKUP_URI:?MONGODB_BACKUP_URI must be configured for the backup profile}"
BACKUP_ROOT="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
case "$RETENTION_DAYS" in *[!0-9]*|'') echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 2;; esac
[ "$RETENTION_DAYS" -ge 1 ] || { echo "BACKUP_RETENTION_DAYS must be at least 1" >&2; exit 2; }
mkdir -p "$BACKUP_ROOT"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
TARGET="$BACKUP_ROOT/bharatgpilot-$STAMP"
TMP="$TARGET.partial"
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
mkdir -p "$TMP"
echo "Starting MongoDB logical backup at $STAMP (UTC)"
mongodump --uri="$MONGODB_BACKUP_URI" --gzip --out="$TMP"
mv "$TMP" "$TARGET"
trap - EXIT HUP INT TERM
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'bharatgpilot-*' -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +
echo "MongoDB backup completed at $TARGET"
