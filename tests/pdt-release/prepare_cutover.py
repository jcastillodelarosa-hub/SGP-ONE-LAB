"""Render the reviewed activation SQL using the database's actual insert clock."""
from pathlib import Path
import os

TEMPLATE = Path('docs/sql-proposals/pdt/integration/06_ACTIVAR_REVIEW.sql')
OUTPUT = Path('/tmp/pdt-release/activate.sql')


def render(sql):
    value = "VALUES(1,'REPLACE_WITH_PUBLICATION_UTC'::timestamptz,'REPLACE_WITH_ADMIN_USER');"
    if sql.count(value) != 1 or sql.count('REPLACE_WITH_PUBLICATION_UTC') != 2:
        raise ValueError('CUTOVER_TEMPLATE_CHANGED')
    if sql.count('REPLACE_WITH_ADMIN_USER') != 2:
        raise ValueError('CUTOVER_ACTOR_TEMPLATE_CHANGED')
    # clock_timestamp() is evaluated by PostgreSQL at INSERT, after all SQL
    # phases have committed. The result is the effective cutover instant.
    sql = sql.replace(value, "VALUES(1,clock_timestamp(),'Jcastillo') RETURNING to_char(desde AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cutover_utc;")
    sql = sql.replace('REPLACE_WITH_PUBLICATION_UTC', 'EFFECTIVE_DATABASE_INSERT_UTC')
    sql = sql.replace('REPLACE_WITH_ADMIN_USER', 'Jcastillo')
    if 'REPLACE_WITH_' in sql:
        raise ValueError('CUTOVER_PLACEHOLDER_REMAINS')
    return sql


def main():
    output = render(TEMPLATE.read_text())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(OUTPUT, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as file:
        file.write(output)
    print('CUTOVER_SQL_PREPARED_FOR_DATABASE_CLOCK')


if __name__ == '__main__':
    main()
