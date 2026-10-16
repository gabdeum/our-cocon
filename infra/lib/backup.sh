# Shared by cocon-backup and cocon-restore-test. Sourced after common.sh.
# shellcheck shell=bash

# Realtime's internal schemas are left out: its message partitions can't be restored over a
# fresh stack, and _realtime holds that stack's own secrets. Neither is family data.
# shellcheck disable=SC2034
DUMP_EXCLUDE=(-N realtime -N _realtime)

# Exact row count of every table that holds family data, for the restore check.
# shellcheck disable=SC2016
COUNT_SQL='
select format($$%s.%s$$, table_schema, table_name),
       (xpath($$/row/c/text()$$, query_to_xml(format($$select count(*) as c from %I.%I$$, table_schema, table_name), false, true, $$$$)))[1]::text
from information_schema.tables
where table_type = $$BASE TABLE$$ and table_schema in ($$public$$, $$auth$$, $$storage$$, $$supabase_migrations$$)
order by 1;'

backup_rclone_unlock() {
  cocon-secrets open rclone.conf "$COCON_RUN/rclone.conf"
}

rclone_() {
  rclone --config "$COCON_RUN/rclone.conf" --quiet "$@"
}

age_encrypt() {
  age -e -R /etc/cocon/backup-recipients.txt
}

count_files() {
  if [ -d "$1" ]; then find "$1" -type f | wc -l | tr -d ' '; else echo 0; fi
}
