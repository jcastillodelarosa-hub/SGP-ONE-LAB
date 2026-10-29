"""Fail closed before supplying a protected write-capable database URL."""
import os
import sys
from urllib.parse import parse_qs, urlsplit


def valid(url):
    try:
        parsed = urlsplit(url)
        query = parse_qs(parsed.query, strict_parsing=True)
        return (parsed.scheme in ('postgres', 'postgresql')
                and parsed.username == 'postgres.ocvxbwzqxbrfndkvjmfx'
                and bool(parsed.password)
                and parsed.hostname == 'aws-0-us-east-2.pooler.supabase.com'
                and parsed.port == 5432 and parsed.path == '/postgres'
                and query == {'sslmode': ['require']}
                and not parsed.fragment and not any(c in url for c in '\r\n'))
    except (ValueError, TypeError):
        return False


if __name__ == '__main__':
    if not valid(os.environ.get('PDT_DATABASE_URL', '')):
        print('::error::SGP_PDT_DATABASE_URL_INVALID_TARGET_OR_TLS')
        sys.exit(1)
    print('PRODUCTION_DATABASE_TARGET_AND_TLS_VERIFIED')
