"""Validate a protected Supabase PostgreSQL connection without logging credentials.

Accept direct, session-pooler and transaction-pooler connection strings for the
pinned SGP project. Never accept an arbitrary host or disabled TLS.
"""
import os
import sys
from urllib.parse import parse_qs, unquote, urlsplit, urlunsplit, urlencode

PROJECT = "ocvxbwzqxbrfndkvjmfx"
POOLER_SUFFIX = ".pooler.supabase.com"
DIRECT_HOST = f"db.{PROJECT}.supabase.co"


def diagnose(url):
    if not isinstance(url, str) or not url.strip():
        return "MISSING_SECRET"
    if url != url.strip() or any(ord(c) < 32 or ord(c) == 127 for c in url):
        return "INVALID_FORMAT"
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ("postgres", "postgresql"):
            return "INVALID_SCHEME"
        if parsed.fragment or parsed.path not in ("/postgres",):
            return "INVALID_DATABASE"
        if not parsed.password:
            return "MISSING_PASSWORD"
        host = (parsed.hostname or "").lower()
        port = parsed.port
        user = unquote(parsed.username or "")
        if host == DIRECT_HOST:
            if user != "postgres" or port != 5432:
                return "INVALID_PROJECT_USER_OR_PORT"
        elif host.endswith(POOLER_SUFFIX) and host.startswith("aws-"):
            if user != f"postgres.{PROJECT}" or port not in (5432, 6543):
                return "INVALID_PROJECT_USER_OR_PORT"
        else:
            return "INVALID_PROJECT_HOST"
        query = parse_qs(parsed.query, keep_blank_values=True, strict_parsing=True)
        if query.get("sslmode") not in (["require"], ["verify-ca"], ["verify-full"]):
            return "TLS_REQUIRED"
        # Other libpq connection options are allowed; reject options that can
        # redirect to another host or disable the verified TLS policy.
        forbidden = {"host", "hostaddr", "port", "user", "dbname", "database",
                     "service", "sslrootcert", "sslcert", "sslkey", "options",
                     "passfile", "sslnegotiation"}
        if forbidden.intersection(query):
            return "UNSAFE_CONNECTION_OVERRIDE"
        return None
    except (ValueError, TypeError, UnicodeError):
        return "INVALID_FORMAT"


def secure_url(url):
    """Add explicit TLS only after project host/user/port validation succeeds."""
    reason = diagnose(url)
    if reason is None:
        return url
    if reason != "TLS_REQUIRED":
        raise ValueError(reason)
    parsed = urlsplit(url)
    query = parse_qs(parsed.query, keep_blank_values=True, strict_parsing=True)
    if "sslmode" in query:
        raise ValueError("TLS_REQUIRED")
    query["sslmode"] = ["require"]
    secured = urlunsplit(parsed._replace(query=urlencode(query, doseq=True)))
    reason = diagnose(secured)
    if reason:
        raise ValueError(reason)
    return secured


def valid(url):
    return diagnose(url) is None


if __name__ == "__main__":
    try:
        url = secure_url(os.environ.get("PDT_DATABASE_URL", ""))
        print("::add-mask::" + url)
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as out:
            out.write("DATABASE_URL=" + url + "\n")
        print("PRODUCTION_DATABASE_TARGET_AND_TLS_VERIFIED")
    except ValueError as exc:
        print(f"::error::SGP_PDT_DATABASE_URL_{exc}")
        sys.exit(1)
