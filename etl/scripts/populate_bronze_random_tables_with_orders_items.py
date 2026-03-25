"""
Random Bronze data populator (Option B).

In one execution, this script inserts exactly 100 total rows into the Bronze layer:
  - 10 rows into `bronze.orders` (mandatory)
  - 40 rows into `bronze.order_item` (mandatory)
  - remaining 50 rows into randomly selected additional Bronze tables

It also writes ETL job tracking rows into `monitoring.job_runs` using `ETLJobTracker`
so the dashboard can show "Recent ETL Runs" and (optionally) freshness per table.
"""

from __future__ import annotations

import argparse
import logging
import random
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

from psycopg2.extras import execute_batch

# Ensure project root is on sys.path so ml_optimization can be imported
script_dir = Path(__file__).parent
project_root = script_dir.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml_optimization.utils.db_utils import get_db_connection
from ml_optimization.utils.etl_job_tracker import ETLJobTracker


JOB_NAME = "BRONZE - Random Bronze Tables Populator (100)"
JOB_TYPE = "ingestion"
TRACK_LAYER = "bronze"


def _rand_str(prefix: str, length: int) -> str:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return prefix + "".join(random.choice(letters) for _ in range(max(1, length)))


def _rand_decimal(min_v: float, max_v: float, places: int = 2) -> float:
    value = random.uniform(min_v, max_v)
    return round(value, places)


def _rand_date_within(days_back: int = 3650) -> date:
    return (date.today() - timedelta(days=random.randint(0, days_back)))


def _load_id_pool(connection, table: str, id_col: str) -> List[int]:
    try:
        with connection.cursor() as cur:
            cur.execute(f"SELECT {id_col} FROM bronze.{table}")
            rows = cur.fetchall()
        return [int(r[0]) for r in rows if r and r[0] is not None]
    except Exception:
        return []


def _load_id_pools() -> Dict[str, List[int]]:
    with get_db_connection() as conn:
        pools = {
            "customer_ids": _load_id_pool(conn, "customer", "customer_id"),
            "employee_ids": _load_id_pool(conn, "employment", "employee_id"),
            "product_ids": _load_id_pool(conn, "product", "product_id"),
        }
        return pools


def _generate_orders_and_items(
    order_count: int,
    order_item_count: int,
    batch_id: int,
    pools: Dict[str, List[int]],
) -> Tuple[List[Tuple[Any, ...]], List[Tuple[Any, ...]]]:
    """
    Generate:
      - orders rows tuple: (order_id, customer_id, sales_rep_id, order_date, order_code, order_status,
                             order_total, order_currency, promotion_code, _batch_id)
      - order_items rows tuple: (order_item_id, order_id, product_id, unit_price, quantity, _batch_id)
    """
    if order_item_count % order_count != 0:
        raise ValueError("order_item_count must be divisible by order_count to keep per-order item_id suffixes small.")

    items_per_order = order_item_count // order_count
    now = datetime.now(UTC)
    today = date.today()

    # Keep INT32 safe like the other generator script does.
    # (order_item_id is order_id*10 + i)
    max_order_id = 214_748_363
    order_ids = [(int(now.timestamp()) % max_order_id) + i + 1 for i in range(order_count)]

    customer_ids = pools.get("customer_ids") or []
    employee_ids = pools.get("employee_ids") or []
    product_ids = pools.get("product_ids") or []

    def pick_customer() -> int:
        return random.choice(customer_ids) if customer_ids else random.randint(1, 150_000)

    def pick_employee() -> int:
        return random.choice(employee_ids) if employee_ids else random.randint(1, 1_000)

    def pick_product() -> int:
        return random.choice(product_ids) if product_ids else random.randint(1, 50_000)

    order_rows: List[Tuple[Any, ...]] = []
    order_item_rows: List[Tuple[Any, ...]] = []
    order_totals: Dict[int, float] = {oid: 0.0 for oid in order_ids}

    # Create base order metadata first.
    order_status_choices = ["COMPLETE", "PENDING", "SHIPPED"]
    currency = "USD"

    for oid in order_ids:
        customer_id = pick_customer()
        sales_rep_id = pick_employee()
        order_status = random.choice(order_status_choices)
        order_code = f"RAND-{oid}"

        # Placeholder total (we compute after generating order items).
        order_rows.append(
            (
                oid,
                customer_id,
                sales_rep_id,
                today,
                order_code,
                order_status,
                0.0,  # order_total computed later
                currency,
                None,  # promotion_code
                batch_id,
            )
        )

    # Generate items, exactly `items_per_order` per order.
    for oid in order_ids:
        for i in range(1, items_per_order + 1):
            product_id = pick_product()
            unit_price = _rand_decimal(10.0, 500.0, 2)
            quantity = _rand_decimal(1.0, 5.0, 2)
            order_item_id = oid * 10 + i

            order_item_rows.append(
                (
                    order_item_id,
                    oid,
                    product_id,
                    unit_price,
                    quantity,
                    batch_id,
                )
            )

            order_totals[oid] += round(unit_price * quantity, 2)

    # Patch order_total into order_rows tuples.
    patched_orders: List[Tuple[Any, ...]] = []
    for row in order_rows:
        oid = int(row[0])
        order_total = round(order_totals.get(oid, 0.0), 2)
        patched_orders.append((row[0], row[1], row[2], row[3], row[4], row[5], order_total, row[6], row[7], row[8]))

    return patched_orders, order_item_rows


def _other_table_generators(batch_id: int) -> Dict[str, Any]:
    """
    Returns a dict:
      table_name -> function(n) returning list of row tuples suitable for execute_batch.
    """

    def gen_country(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            country_id = random.randint(1, 50_000)
            rows.append(
                (
                    country_id,
                    _rand_str("Country", 6)[:50],
                    _rand_str("C", 2)[:3],
                    random.randint(1, 999),
                    random.choice(["USD", "EUR", "GBP", "JPY"]),
                    batch_id,
                )
            )
        return rows

    def gen_location(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            location_id = random.randint(1, 1_000_000)
            country_id = random.randint(1, 50_000)
            rows.append(
                (
                    location_id,
                    country_id,
                    _rand_str("Addr", 6)[:100],
                    _rand_str("Addr2", 6)[:100],
                    _rand_str("City", 6)[:50],
                    _rand_str("State", 6)[:50],
                    _rand_str("District", 8)[:50],
                    f"{random.randint(10000, 99999)}",
                    random.randint(1, 999),
                    _rand_str("Desc", 12)[:256],
                    _rand_str("Ship", 16)[:512],
                    country_id,
                    batch_id,
                )
            )
        return rows

    def gen_warehouse(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            warehouse_id = random.randint(1, 500_000)
            location_id = random.randint(1, 1_000_000)
            rows.append((warehouse_id, location_id, _rand_str("WH", 4)[:100], batch_id))
        return rows

    def gen_product(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            product_id = random.randint(1, 50_000)
            list_price = _rand_decimal(10.0, 5000.0, 2)
            min_price = round(min(list_price, _rand_decimal(1.0, list_price, 2)), 2)
            rows.append(
                (
                    product_id,
                    _rand_str("Prod", 10)[:100],
                    _rand_str("ProductDesc", 20)[:1000],
                    random.randint(1, 500),
                    random.randint(1, 100),
                    random.randint(0, 60),
                    random.randint(1, 10_000),
                    random.choice(["Active", "Discontinued", "Backorder"]),
                    list_price,
                    min_price,
                    random.choice(["USD", "EUR", "GBP", "JPY"]),
                    f"https://example.com/catalog/{product_id}",
                    batch_id,
                )
            )
        return rows

    def gen_inventory(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            inventory_id = random.randint(1, 1_000_000)
            product_id = random.randint(1, 50_000)
            warehouse_id = random.randint(1, 500_000)
            on_hand = random.randint(0, 20000)
            available = random.randint(0, on_hand) if on_hand > 0 else 0
            rows.append((inventory_id, product_id, warehouse_id, on_hand, available, batch_id))
        return rows

    def gen_person(n: int) -> List[Tuple[Any, ...]]:
        first_names = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Riley", "Chris", "Jamie"]
        last_names = ["Smith", "Patel", "Kim", "Garcia", "Brown", "Nguyen", "Lopez", "Singh"]
        rows = []
        for _ in range(n):
            person_id = random.randint(1, 150_000)
            rows.append(
                (
                    person_id,
                    random.choice(first_names),
                    random.choice(last_names),
                    _rand_str("M", 4)[:100],
                    _rand_str("Nick", 5)[:50],
                    random.randint(1, 999),
                    random.randint(1, 999),
                    random.choice(["M", "F", "Non-binary"]),
                    batch_id,
                )
            )
        return rows

    def gen_restricted_info(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            person_id = random.randint(1, 150_000)
            dob = _rand_date_within(12000)
            dod = None  # keep null most of the time
            if random.random() < 0.1:
                dod = _rand_date_within((date.today() - dob).days)  # may be before dob; still valid types-wise
            rows.append(
                (
                    person_id,
                    dob,
                    dod,
                    f"GOV-{random.randint(100000, 999999)}",
                    f"PASP-{random.randint(1000000, 9999999)}",
                    _rand_date_within(8000),
                    random.randint(0, 1000),
                    batch_id,
                )
            )
        return rows

    def gen_customer_company(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            company_id = random.randint(1, 20_000)
            rows.append(
                (
                    company_id,
                    _rand_str("Company", 12)[:100],
                    _rand_decimal(1000.0, 1_000_000.0, 2),
                    random.choice(["USD", "EUR", "GBP", "JPY"]),
                    batch_id,
                )
            )
        return rows

    def gen_customer_employee(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            customer_employee_id = random.randint(1, 200_000)
            company_id = random.randint(1, 20_000)
            rows.append(
                (
                    customer_employee_id,
                    company_id,
                    _rand_str("BADGE", 6)[:30],
                    _rand_str("JobTitle", 10)[:100],
                    _rand_str("Dept", 8)[:100],
                    _rand_decimal(100.0, 50_000.0, 2),
                    random.choice(["USD", "EUR", "GBP", "JPY"]),
                    batch_id,
                )
            )
        return rows

    def gen_customer(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            customer_id = random.randint(1, 150_000)
            person_id = random.randint(1, 150_000)
            customer_employee_id = random.randint(1, 200_000)
            rows.append(
                (
                    customer_id,
                    person_id,
                    customer_employee_id,
                    random.randint(1, 10_000),
                    random.randint(0, 10),
                    batch_id,
                )
            )
        return rows

    def gen_employment_jobs(n: int) -> List[Tuple[Any, ...]]:
        rows = []
        for _ in range(n):
            hr_job_id = random.randint(1, 50_000)
            rows.append(
                (
                    hr_job_id,
                    random.randint(1, 50_000),  # countries_country_id
                    _rand_str("Job", 8)[:100],
                    _rand_decimal(1000.0, 100_000.0, 2),
                    _rand_decimal(1000.0, 100_000.0, 2),
                    batch_id,
                )
            )
        return rows

    def gen_employment(n: int) -> List[Tuple[Any, ...]]:
        statuses = ["ACTIVE", "SABBATICAL", "RETIRED"]
        rows = []
        for _ in range(n):
            employee_id = random.randint(1, 20_000)
            rows.append(
                (
                    employee_id,
                    random.randint(1, 150_000),  # person_id
                    random.randint(1, 50_000),  # hr_job_id
                    random.randint(1, 20_000),  # manager_employee_id
                    _rand_date_within(5000),
                    None,  # end_date (null allowed)
                    _rand_decimal(1000.0, 200_000.0, 2),
                    _rand_decimal(0.0, 50.0, 2),
                    random.choice(statuses),
                    batch_id,
                )
            )
        return rows

    return {
        "country": gen_country,
        "location": gen_location,
        "warehouse": gen_warehouse,
        "product": gen_product,
        "inventory": gen_inventory,
        "person": gen_person,
        "restricted_info": gen_restricted_info,
        "customer_company": gen_customer_company,
        "customer_employee": gen_customer_employee,
        "customer": gen_customer,
        "employment_jobs": gen_employment_jobs,
        "employment": gen_employment,
    }


def run_once(count: int) -> None:
    """
    Insert exactly `count` total bronze rows:
      - orders=10
      - order_item=40
      - other tables = count - 50
    """
    if count < 50:
        raise ValueError("count must be >= 50 to satisfy orders=10 and order_item=40 mandatory inserts.")

    orders_count = 10
    order_items_count = 40
    other_total = count - (orders_count + order_items_count)

    logger = logging.getLogger(__name__)
    batch_id = int(datetime.now(UTC).timestamp() // 60)

    pools = _load_id_pools()
    if not pools["customer_ids"]:
        logger.warning("bronze.customer is empty; orders.customer_id will be generated as random IDs.")
    if not pools["employee_ids"]:
        logger.warning("bronze.employment is empty; orders.sales_rep_id will be generated as random IDs.")
    if not pools["product_ids"]:
        logger.warning("bronze.product is empty; order_item.product_id will be generated as random IDs.")

    tracker = ETLJobTracker()
    tracker.ensure_table_exists()

    # Decide which other tables to populate.
    other_table_pool = [
        "country",
        "location",
        "warehouse",
        "product",
        "inventory",
        "person",
        "restricted_info",
        "customer_company",
        "customer_employee",
        "customer",
        "employment_jobs",
        "employment",
    ]
    other_table_count = min(len(other_table_pool), max(1, random.randint(7, 10)))
    other_table_count = min(other_table_count, other_total) if other_total > 0 else 0
    selected_other_tables = random.sample(other_table_pool, k=other_table_count) if other_table_count else []

    other_counts: Dict[str, int] = {t: 1 for t in selected_other_tables}
    remaining = other_total - len(selected_other_tables)
    while remaining > 0 and selected_other_tables:
        t = random.choice(selected_other_tables)
        other_counts[t] += 1
        remaining -= 1

    other_generators = _other_table_generators(batch_id)

    with get_db_connection() as conn:
        # 1) Orders
        orders_job_run_id = tracker.start_job(
            JOB_NAME,
            JOB_TYPE,
            TRACK_LAYER,
            "orders",
            records_total=orders_count,
            metadata={"orders_count": orders_count},
        )

        orders_rows, order_item_rows = _generate_orders_and_items(
            orders_count,
            order_items_count,
            batch_id=batch_id,
            pools=pools,
        )

        try:
            with conn.cursor() as cur:
                execute_batch(
                    cur,
                    """
                    INSERT INTO bronze.orders
                      (order_id, customer_id, sales_rep_id, order_date, order_code, order_status,
                       order_total, order_currency, promotion_code, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    orders_rows,
                    page_size=len(orders_rows),
                )
            conn.commit()
            tracker.complete_job(orders_job_run_id, records_processed=orders_count, metadata={"orders_count": orders_count})
        except Exception as e:
            conn.rollback()
            tracker.fail_job(orders_job_run_id, str(e))
            raise

        # 2) Order items
        items_job_run_id = tracker.start_job(
            JOB_NAME,
            JOB_TYPE,
            TRACK_LAYER,
            "order_item",
            records_total=order_items_count,
            metadata={"order_items_count": order_items_count},
        )

        try:
            with conn.cursor() as cur:
                execute_batch(
                    cur,
                    """
                    INSERT INTO bronze.order_item
                      (order_item_id, order_id, product_id, unit_price, quantity, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    order_item_rows,
                    page_size=len(order_item_rows),
                )
            conn.commit()
            tracker.complete_job(items_job_run_id, records_processed=order_items_count, metadata={"order_items_count": order_items_count})
        except Exception as e:
            conn.rollback()
            tracker.fail_job(items_job_run_id, str(e))
            raise

        # 3) Other tables (grouped by table name for better freshness visibility)
        for table_name, n in other_counts.items():
            job_run_id = tracker.start_job(
                JOB_NAME,
                JOB_TYPE,
                TRACK_LAYER,
                table_name,
                records_total=n,
                metadata={"rows": n, "table": table_name},
            )
            try:
                rows = other_generators[table_name](n)
                with conn.cursor() as cur:
                    if table_name == "country":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.country
                              (country_id, country_name, country_code, nat_lang_code, currency_code, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "location":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.location
                              (location_id, country_id, address_line_1, address_line_2, city, state, district,
                               postal_code, location_type_code, description, shipping_notes, countries_country_id, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "warehouse":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.warehouse
                              (warehouse_id, location_id, warehouse_name, _batch_id)
                            VALUES (%s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "product":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.product
                              (product_id, product_name, description, category, weight_class, warranty_period,
                               supplier_id, status, list_price, minimum_price, price_currency, catalog_url, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "inventory":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.inventory
                              (inventory_id, product_id, warehouse_id, quantity_on_hand, quantity_available, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "person":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.person
                              (person_id, first_name, last_name, middle_names, nickname, nat_lang_code, culture_code, gender, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "restricted_info":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.restricted_info
                              (person_id, date_of_birth, date_of_death, government_id, passport_id, hire_date, seniority_code, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "customer_company":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.customer_company
                              (company_id, company_name, company_credit_limit, credit_limit_currency, _batch_id)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "customer_employee":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.customer_employee
                              (customer_employee_id, company_id, badge_number, job_title, department,
                               credit_limit, credit_limit_currency, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "customer":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.customer
                              (customer_id, person_id, customer_employee_id, accountmgr_id, income_level, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "employment_jobs":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.employment_jobs
                              (hr_job_id, countries_country_id, job_title, min_salary, max_salary, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    elif table_name == "employment":
                        execute_batch(
                            cur,
                            """
                            INSERT INTO bronze.employment
                              (employee_id, person_id, hr_job_id, manager_employee_id, start_date, end_date,
                               salary, commission_percent, employment_status, _batch_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            rows,
                            page_size=len(rows),
                        )
                    else:
                        raise ValueError(f"Unsupported table_name for insertion: {table_name}")

                conn.commit()
                tracker.complete_job(job_run_id, records_processed=n, metadata={"table": table_name, "rows": n})
            except Exception as e:
                conn.rollback()
                tracker.fail_job(job_run_id, str(e))
                raise


def main() -> None:
    log_file_path = script_dir / "random_bronze_populator.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        handlers=[
            logging.FileHandler(str(log_file_path)),
            logging.StreamHandler(),
        ],
    )
    logger = logging.getLogger(__name__)

    parser = argparse.ArgumentParser(description="Populate Bronze with random data including orders and order_item.")
    parser.add_argument("--once", action="store_true", help="Run once and exit.")
    parser.add_argument("--count", type=int, default=100, help="Total number of rows to insert into Bronze (default: 100).")
    args = parser.parse_args()

    if not args.once:
        # This script is designed for cron-style single execution.
        logger.info("No --once flag provided; exiting. Use --once to run one batch.")
        sys.exit(0)

    logger.info("Starting %s (count=%s)", JOB_NAME, args.count)
    run_once(args.count)
    logger.info("Finished %s", JOB_NAME)


if __name__ == "__main__":
    main()

