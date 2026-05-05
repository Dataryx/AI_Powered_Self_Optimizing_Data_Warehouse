"""
Generate real dashboard API traffic by calling the backend endpoints over HTTP.

IMPORTANT: This script runs **independently** of the Vite/React dashboard UI. If it is
running in another terminal (or as a scheduled job), uvicorn will log dozens of requests
even when your browser is only on the home page. Stop this process to quiet the server.

Default ``--profile mixed`` combines *light* (small limits, cheap calls) and *heavy*
(large scans, wide windows, high optimization limits) so Postgres sees varied SQL.
Use ``--profile light`` or ``--profile heavy`` for a single mix.

Use with run_query_collection.py to capture workload in pg_stat_statements
and persist into ml_optimization.query_logs.
"""

from __future__ import annotations

import argparse
import http.client
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from urllib import parse


@dataclass(frozen=True)
class Endpoint:
    path: str
    weight: float = 1.0


def _light_endpoints() -> List[Endpoint]:
    """Smaller limits and cheap reads — diverse query shapes for pg_stat_statements."""
    return [
        Endpoint("/health", 2.0),
        Endpoint("/api/v1/warehouse/summary", 5.0),
        Endpoint("/api/v1/warehouse/schemas", 2.0),
        Endpoint("/api/v1/warehouse/tables/bronze", 1.5),
        Endpoint("/api/v1/warehouse/tables/silver", 1.5),
        Endpoint("/api/v1/warehouse/tables/gold", 1.5),
        Endpoint("/api/v1/warehouse/sales-stats", 5.0),
        Endpoint("/api/v1/warehouse/top-products?limit=20", 4.0),
        Endpoint("/api/v1/warehouse/top-products?limit=50", 2.0),
        Endpoint("/api/v1/warehouse/customer-stats", 3.0),
        Endpoint("/api/v1/warehouse/stats/gold/fact_sales", 2.0),
        Endpoint("/api/v1/warehouse/stats/silver/orders", 2.0),
        Endpoint("/api/v1/warehouse/stats/gold/fact_inventory_snapshot", 1.5),
        Endpoint("/api/v1/warehouse/data/gold/fact_sales?limit=100&offset=0", 1.5),
        Endpoint("/api/v1/warehouse/data/gold/fact_sales?limit=50&offset=50", 1.0),
        Endpoint("/api/v1/warehouse/data/silver/orders?limit=100&offset=0", 1.5),
        Endpoint("/api/v1/warehouse/data/silver/customer?limit=120&offset=0", 1.2),
        Endpoint("/api/v1/warehouse/data/gold/dim_product?limit=200&offset=0", 1.2),
        Endpoint("/api/v1/warehouse/data/gold/dim_customer?limit=150&offset=0", 1.0),
        Endpoint("/api/v1/warehouse/data/gold/fact_inventory_snapshot?limit=150&offset=0", 1.2),
        Endpoint("/api/v1/monitoring/etl/jobs", 4.0),
        Endpoint("/api/v1/monitoring/etl/job-definitions", 2.0),
        Endpoint("/api/v1/monitoring/etl/pipeline-dag", 2.0),
        Endpoint("/api/v1/monitoring/etl/freshness", 4.0),
        Endpoint("/api/v1/monitoring/etl/errors", 3.0),
        Endpoint("/api/v1/monitoring/etl/throughput", 3.0),
        Endpoint("/api/v1/monitoring/data-quality", 4.0),
        Endpoint("/api/v1/storage/utilization", 3.0),
        Endpoint("/api/v1/storage/growth-trends?days=30", 2.5),
        Endpoint("/api/v1/storage/growth-trends?days=7", 1.5),
        Endpoint("/api/v1/storage/compression", 2.0),
        Endpoint("/api/v1/storage/cache", 2.0),
        Endpoint("/api/v1/storage/resources", 2.0),
        Endpoint("/api/v1/storage/cost", 1.5),
        Endpoint("/api/v1/alerts/active", 3.0),
        Endpoint("/api/v1/alerts/history?days=30", 2.0),
        Endpoint("/api/v1/alerts/history?days=7", 1.5),
        Endpoint("/api/v1/alerts/anomalies", 2.0),
        Endpoint("/api/v1/alerts/incidents", 2.0),
        Endpoint("/api/v1/alerts/config", 1.0),
        Endpoint("/api/v1/optimization/recommendations", 2.0),
        Endpoint("/api/v1/optimization/recommendations?limit=50", 1.5),
        Endpoint("/api/v1/optimization/query-performance?limit=100", 2.0),
        Endpoint("/api/v1/optimization/query-performance?limit=40", 1.0),
        Endpoint("/api/v1/optimization/history?limit=100", 2.0),
        Endpoint("/api/v1/metrics", 1.0),
        Endpoint("/api/v1/metrics/query-performance", 1.0),
        Endpoint("/api/v1/recommendations", 1.0),
    ]


def _heavy_endpoints() -> List[Endpoint]:
    """Large LIMIT/OFFSET reads, COUNT(*), big GROUP BYs, wide windows."""
    return [
        Endpoint("/health", 0.5),
        Endpoint("/api/v1/warehouse/summary", 6.0),
        Endpoint("/api/v1/warehouse/schemas", 2.0),
        Endpoint("/api/v1/warehouse/tables/bronze", 2.0),
        Endpoint("/api/v1/warehouse/tables/silver", 2.0),
        Endpoint("/api/v1/warehouse/tables/gold", 2.0),
        Endpoint("/api/v1/warehouse/sales-stats", 8.0),
        Endpoint("/api/v1/warehouse/top-products?limit=250", 6.0),
        Endpoint("/api/v1/warehouse/customer-stats", 6.0),
        Endpoint("/api/v1/warehouse/stats/gold/fact_sales", 4.0),
        Endpoint("/api/v1/warehouse/stats/silver/orders", 4.0),
        Endpoint("/api/v1/warehouse/data/gold/fact_sales?limit=8000&offset=0", 5.0),
        Endpoint("/api/v1/warehouse/data/gold/fact_sales?limit=8000&offset=4000", 4.0),
        Endpoint("/api/v1/warehouse/data/gold/fact_sales?limit=8000&offset=8000", 3.0),
        Endpoint("/api/v1/warehouse/data/silver/orders?limit=6000&offset=0", 5.0),
        Endpoint("/api/v1/warehouse/data/silver/orders?limit=6000&offset=3000", 4.0),
        Endpoint("/api/v1/warehouse/data/silver/order_item?limit=5000&offset=0", 3.5),
        Endpoint("/api/v1/warehouse/data/gold/dim_customer?limit=3000&offset=0", 2.5),
        Endpoint("/api/v1/warehouse/data/gold/dim_product?limit=4000&offset=0", 2.5),
        Endpoint("/api/v1/warehouse/data/gold/fact_inventory_snapshot?limit=4000&offset=0", 2.0),
        Endpoint("/api/v1/monitoring/etl/jobs", 4.0),
        Endpoint("/api/v1/monitoring/etl/job-definitions", 2.0),
        Endpoint("/api/v1/monitoring/etl/pipeline-dag", 2.0),
        Endpoint("/api/v1/monitoring/etl/freshness", 5.0),
        Endpoint("/api/v1/monitoring/etl/errors", 3.0),
        Endpoint("/api/v1/monitoring/etl/throughput", 4.0),
        Endpoint("/api/v1/monitoring/data-quality", 6.0),
        Endpoint("/api/v1/storage/utilization", 5.0),
        Endpoint("/api/v1/storage/growth-trends?days=365", 5.0),
        Endpoint("/api/v1/storage/compression", 3.0),
        Endpoint("/api/v1/storage/cache", 4.0),
        Endpoint("/api/v1/storage/resources", 3.0),
        Endpoint("/api/v1/storage/cost", 2.0),
        Endpoint("/api/v1/alerts/active", 3.0),
        Endpoint("/api/v1/alerts/history?days=365", 4.0),
        Endpoint("/api/v1/alerts/anomalies", 3.0),
        Endpoint("/api/v1/alerts/incidents", 3.0),
        Endpoint("/api/v1/alerts/config", 1.0),
        Endpoint("/api/v1/optimization/recommendations?limit=250", 5.0),
        Endpoint("/api/v1/optimization/query-performance?limit=250", 5.0),
        Endpoint("/api/v1/optimization/history?limit=250", 4.0),
    ]


def build_endpoints(*, profile: str = "mixed") -> List[Endpoint]:
    """
    Dashboard-facing GET paths.

    - ``mixed`` (default): light + heavy so traffic includes cheap and expensive SQL.
    - ``light``: small limits only.
    - ``heavy``: large scans / aggregations only.
    """
    profile = (profile or "mixed").strip().lower()
    if profile == "light":
        return _light_endpoints()
    if profile == "heavy":
        return _heavy_endpoints()
    if profile == "mixed":
        return _light_endpoints() + _heavy_endpoints()
    raise ValueError(f"Unknown profile {profile!r}; use mixed, light, or heavy.")


def weighted_choice(endpoints: List[Endpoint]) -> Endpoint:
    total = sum(e.weight for e in endpoints)
    r = random.random() * total
    upto = 0.0
    for e in endpoints:
        upto += e.weight
        if upto >= r:
            return e
    return endpoints[-1]


def _new_connection(parsed_base: parse.SplitResult, timeout_s: float) -> http.client.HTTPConnection:
    scheme = parsed_base.scheme.lower()
    host = parsed_base.hostname or "localhost"
    if parsed_base.port is not None:
        port = parsed_base.port
    else:
        port = 443 if scheme == "https" else 80
    if scheme == "https":
        return http.client.HTTPSConnection(host, port, timeout=timeout_s)
    return http.client.HTTPConnection(host, port, timeout=timeout_s)


def do_get(conn: http.client.HTTPConnection, base_prefix: str, path: str, timeout_s: float) -> Tuple[bool, int, bool]:
    """
    Return (ok, status_code, should_reconnect).
    should_reconnect indicates the connection should be recreated before next request.
    """
    try:
        full_path = f"{base_prefix}{path}"
        conn.request(
            "GET",
            full_path,
            headers={
                "Accept": "application/json",
                "User-Agent": "dashboard-traffic-generator/1.0",
                "Connection": "keep-alive",
            },
        )
        resp = conn.getresponse()
        _ = resp.read()  # consume body so connection can be reused
        code = int(resp.status or 0)
        return (200 <= code < 300), code, False
    except Exception:
        return False, 0, True


def worker(
    parsed_base: parse.SplitResult,
    base_prefix: str,
    endpoints: List[Endpoint],
    timeout_s: float,
    requests_per_worker: int,
    min_sleep_ms: int,
    max_sleep_ms: int,
    stats: Dict[str, int],
    lock: threading.Lock,
    run_forever: bool = False,
    stop_event: Optional[threading.Event] = None,
) -> None:
    conn = _new_connection(parsed_base, timeout_s=timeout_s)

    def _one_request() -> None:
        nonlocal conn
        ep = weighted_choice(endpoints)
        ok, code, reconnect = do_get(conn, base_prefix, ep.path, timeout_s=timeout_s)
        if reconnect:
            try:
                conn.close()
            except Exception:
                pass
            conn = _new_connection(parsed_base, timeout_s=timeout_s)
        with lock:
            stats["total"] += 1
            if ok:
                stats["success"] += 1
            else:
                stats["failed"] += 1
            if 200 <= code < 300:
                stats["2xx"] += 1
            elif 400 <= code < 500:
                stats["4xx"] += 1
            elif 500 <= code < 600:
                stats["5xx"] += 1
        if max_sleep_ms > 0:
            sleep_ms = random.randint(max(0, min_sleep_ms), max(min_sleep_ms, max_sleep_ms))
            time.sleep(sleep_ms / 1000.0)

    try:
        if run_forever:
            while True:
                if stop_event is not None and stop_event.is_set():
                    break
                _one_request()
        else:
            for _ in range(requests_per_worker):
                _one_request()
    finally:
        try:
            conn.close()
        except Exception:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate real dashboard API traffic (default: mixed light + heavy workload)."
    )
    parser.add_argument("--base-url", default="http://localhost:8000", help="Backend base URL (default: http://localhost:8000)")
    parser.add_argument("--total-requests", type=int, default=200000, help="Total GET requests to send (default: 200000)")
    parser.add_argument("--concurrency", type=int, default=16, help="Number of worker threads (default: 16)")
    parser.add_argument("--timeout-seconds", type=float, default=120.0, help="Per-request timeout (default: 120; heavy pulls can be slow)")
    parser.add_argument("--min-sleep-ms", type=int, default=5, help="Min per-request sleep in worker (default: 5)")
    parser.add_argument("--max-sleep-ms", type=int, default=40, help="Max per-request sleep in worker (default: 40)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument(
        "--profile",
        choices=("mixed", "light", "heavy"),
        default="mixed",
        help="mixed=light+heavy (default); light=cheap/small only; heavy=large scans only.",
    )
    parser.add_argument(
        "--light",
        action="store_true",
        help="Same as --profile light.",
    )
    parser.add_argument(
        "--forever",
        action="store_true",
        help="Send requests until Ctrl+C (--total-requests ignored).",
    )
    args = parser.parse_args()

    random.seed(args.seed)
    profile = "light" if args.light else args.profile
    endpoints = build_endpoints(profile=profile)
    parsed_base = parse.urlsplit(args.base_url)
    base_prefix = parsed_base.path.rstrip("/")

    if not args.forever and args.total_requests <= 0:
        raise ValueError("total-requests must be > 0 unless --forever")
    if args.concurrency <= 0:
        raise ValueError("concurrency must be > 0")

    print(f"Traffic profile: {profile}; endpoints={len(endpoints)}")
    if args.forever:
        print("Forever mode: press Ctrl+C to stop.")

    stats = {"total": 0, "success": 0, "failed": 0, "2xx": 0, "4xx": 0, "5xx": 0}
    lock = threading.Lock()
    start = time.time()

    if args.forever:
        stop_event = threading.Event()
        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            futures = [
                ex.submit(
                    worker,
                    parsed_base,
                    base_prefix,
                    endpoints,
                    args.timeout_seconds,
                    0,
                    args.min_sleep_ms,
                    args.max_sleep_ms,
                    stats,
                    lock,
                    True,
                    stop_event,
                )
                for _ in range(args.concurrency)
            ]
            try:
                while True:
                    time.sleep(0.25)
            except KeyboardInterrupt:
                print("\nStopping workers...", flush=True)
                stop_event.set()
            for f in futures:
                try:
                    f.result(timeout=120)
                except Exception:
                    pass
    else:
        req_per_worker = args.total_requests // args.concurrency
        remainder = args.total_requests % args.concurrency
        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            futures = []
            for i in range(args.concurrency):
                n = req_per_worker + (1 if i < remainder else 0)
                futures.append(
                    ex.submit(
                        worker,
                        parsed_base,
                        base_prefix,
                        endpoints,
                        args.timeout_seconds,
                        n,
                        args.min_sleep_ms,
                        args.max_sleep_ms,
                        stats,
                        lock,
                        False,
                        None,
                    )
                )
            for f in as_completed(futures):
                _ = f.result()

    elapsed = time.time() - start
    rps = stats["total"] / elapsed if elapsed > 0 else 0.0
    print(
        f"Done. total={stats['total']}, success={stats['success']}, failed={stats['failed']}, "
        f"2xx={stats['2xx']}, 4xx={stats['4xx']}, 5xx={stats['5xx']}, elapsed_s={elapsed:.1f}, rps={rps:.1f}"
    )


if __name__ == "__main__":
    main()

