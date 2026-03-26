#!/usr/bin/env python3
"""
Populate the Bronze layer with realistic Amazon-style marketplace data.

- Emphasizes readable products (titles, descriptions, catalog URLs, prices).
- Fills all bronze table columns with sensible values.
- Total row count across bronze tables never exceeds --max-rows (default 5_000_000).
- Default: never TRUNCATE. Each run reads MAX(id) per table and appends the next block of keys only
  (no primary-key reuse, no duplicate rows from re-running the script).
- Foreign keys for this load point at rows created in the same run (or existing keys that are
  guaranteed present), so reruns stay valid even if older bronze keys are not contiguous from 1.

Requires: PostgreSQL with bronze schema per data-warehouse/schemas/complete_warehouse.sql (FKs on).

Usage:
  python etl/scripts/populate_bronze_amazon_marketplace.py
  python etl/scripts/populate_bronze_amazon_marketplace.py --max-rows 2000000
  python etl/scripts/populate_bronze_amazon_marketplace.py --truncate   # optional full reset only
"""

from __future__ import annotations

import argparse
import logging
import random
import string
import sys
from dataclasses import dataclass, replace
from datetime import date, timedelta
from pathlib import Path
import time
from typing import Any, List, Tuple

from psycopg2.extras import execute_batch

script_dir = Path(__file__).parent
project_root = script_dir.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml_optimization.utils.db_utils import get_db_connection  # noqa: E402

logger = logging.getLogger(__name__)

# --- Readable Amazon-like vocabulary -------------------------------------------------
CURRENCIES = (
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "JPY",
    "AUD",
    "MXN",
    "BRL",
    "INR",
)

CATEGORIES = {
    1: "Electronics",
    2: "Home & Kitchen",
    3: "Books",
    4: "Sports & Outdoors",
    5: "Clothing & Shoes",
    6: "Toys & Games",
    7: "Beauty & Personal Care",
    8: "Automotive",
    9: "Office Supplies",
    10: "Grocery & Gourmet",
}

BRANDS = (
    "Amazon Basics", "Anker", "Samsung", "Sony", "Instant Pot", "Keurig", "JBL",
    "KitchenAid", "Coleman", "Under Armour", "LEGO", "CeraVe", "Michelin",
    "Sharpie", "Starbucks", "Apple", "Logitech", "Roku", "Blink", "Ring",
    "Dewalt", "Yeti", "OXO", "Brita", "Bose", "Garmin", "Stanley", "Hydro Flask",
)

PRODUCT_TYPES = {
    1: ("Wireless Earbuds", "Bluetooth Speaker", "USB-C Hub", "4K Monitor", "Tablet Stand"),
    2: ("Coffee Maker", "Nonstick Skillet", "Storage Bin Set", "LED Desk Lamp", "Dish Rack"),
    3: ("Hardcover Edition", "Paperback Box Set", "Audible Companion", "Cookbook", "Journal"),
    4: ("Running Shoes", "Yoga Mat", "Tent 4-Person", "Hiking Backpack", "Dumbbell Set"),
    5: ("Cotton Tee", "Fleece Jacket", "Sneakers", "Jean Slim Fit", "Winter Coat"),
    6: ("Building Block Set", "Board Game", "RC Car", "Action Figure", "Puzzle 1000pc"),
    7: ("Moisturizing Cream", "Shampoo Set", "Sunscreen SPF 50", "Electric Toothbrush", "Serum"),
    8: ("Floor Mats", "Phone Mount", "Jump Starter", "Oil Filter Pack", "LED Headlight"),
    9: ("Ballpoint Pens 12pk", "Desk Organizer", "Notebook 5pk", "Stapler Heavy Duty", "Labels"),
    10: ("Whole Bean Coffee", "Trail Mix", "Olive Oil", "Protein Bars", "Sparkling Water 12pk"),
}

STATUS_OK = ("Active", "In Stock", "Available")

FIRST_NAMES = (
    "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "William",
    "Mia", "James", "Charlotte", "Benjamin", "Amelia", "Lucas", "Harper", "Henry", "Evelyn",
)

LAST_NAMES = (
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
)

US_CITIES = (
    ("Phoenix", "AZ"), ("Austin", "TX"), ("Seattle", "WA"), ("Denver", "CO"), ("Miami", "FL"),
    ("Atlanta", "GA"), ("Portland", "OR"), ("Dallas", "TX"), ("Chicago", "IL"), ("Boston", "MA"),
)

COUNTRY_NAMES = (
    ("United States", "USA", 1033, "USD"),
    ("Canada", "CAN", 1033, "CAD"),
    ("United Kingdom", "GBR", 2057, "GBP"),
    ("Germany", "DEU", 1031, "EUR"),
    ("France", "FRA", 1036, "EUR"),
    ("Japan", "JPN", 1041, "JPY"),
    ("Australia", "AUS", 3081, "AUD"),
    ("Italy", "ITA", 1040, "EUR"),
    ("Spain", "ESP", 3082, "EUR"),
    ("Mexico", "MEX", 2058, "MXN"),
    ("Brazil", "BRA", 1046, "BRL"),
    ("India", "IND", 1081, "INR"),
)


def _clip(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _fake_asin() -> str:
    body = "".join(random.choices(string.ascii_uppercase + string.digits, k=9))
    return f"B0{body}"


def build_product_row(product_id: int, batch_id: int) -> Tuple[Any, ...]:
    cat = random.randint(1, 10)
    brand = random.choice(BRANDS)
    ptype = random.choice(PRODUCT_TYPES[cat])
    variant = random.choice(("2024 Model", "Gen 2", "Pro", "Lite", "Plus", "XL", "Pack of 2", "")).strip()
    color = random.choice(("Black", "White", "Navy", "Silver", "Graphite", ""))
    parts = [brand, ptype]
    if variant:
        parts.append(variant)
    if color:
        parts.append(color)
    title = _clip(" ".join(parts), 100)
    desc = (
        f"{title}. Ships from Amazon. Category: {CATEGORIES[cat]}. "
        f"Satisfaction guaranteed. Prime eligible where available."
    )
    list_p = round(random.uniform(9.99, 899.99), 2)
    min_p = round(min(list_p * 0.7, list_p - 0.01), 2)
    if min_p < 0:
        min_p = round(list_p * 0.85, 2)
    url = _clip(f"https://www.amazon.com/dp/{_fake_asin()}/ref=bronze_catalog?pid={product_id}", 256)
    return (
        product_id,
        title,
        desc,
        cat,
        random.randint(1, 5),
        random.choice((12, 24, 36)),
        random.randint(1, 9999),
        random.choice(STATUS_OK),
        list_p,
        min_p,
        random.choice(CURRENCIES),
        url,
        "AMAZON_MARKETPLACE",
        batch_id,
    )


@dataclass
class RowBudget:
    countries: int
    locations: int
    warehouses: int
    employment_jobs: int
    persons: int
    restricted: int
    person_locations: int
    phones: int
    companies: int
    customer_employees: int
    customers: int
    employees: int
    products: int
    inventory: int
    orders: int
    order_items: int

    def total(self) -> int:
        return (
            self.countries
            + self.locations
            + self.warehouses
            + self.employment_jobs
            + self.persons
            + self.restricted
            + self.person_locations
            + self.phones
            + self.companies
            + self.customer_employees
            + self.customers
            + self.employees
            + self.products
            + self.inventory
            + self.orders
            + self.order_items
        )


def compute_budget(max_rows: int) -> RowBudget:
    """Split max_rows: fixed reference chain + remainder to products / orders / inventory."""
    countries = min(40, max_rows // 100_000 + 8)
    locations = min(max_rows // 8000, 8000)
    locations = max(locations, countries * 2)
    warehouses = min(80, max(20, locations // 50))
    employment_jobs = min(120, max(40, countries * 2))

    persons = min(max_rows // 25, 350_000)
    persons = max(persons, 50_000)

    restricted = min(persons - 1, int(max_rows * 0.035))
    restricted = max(restricted, min(10_000, persons // 2))

    person_locations = min(int(max_rows * 0.045), persons * 2)
    phones = min(int(max_rows * 0.055), persons * 2)

    companies = min(5000, max(800, countries * 25))
    customer_employees = min(30_000, max(5000, companies * 3))
    employees = min(25_000, max(8000, int(max_rows * 0.006) + 5000))
    employees = min(employees, max(0, persons - 5000))
    # Customers use person_id 1..customers; employees use high person_id range — keep disjoint.
    employee_first_pid = max(1, persons - employees - 1) + 1
    max_customers_by_person = max(0, employee_first_pid - 1)
    cust_target = min(int(max_rows * 0.035), max(0, persons - 2000))
    customers = min(
        persons,
        max_customers_by_person,
        max(min(20_000, max_customers_by_person), cust_target) if max_customers_by_person else 0,
    )

    fixed = (
        countries
        + locations
        + warehouses
        + employment_jobs
        + persons
        + restricted
        + person_locations
        + phones
        + companies
        + customer_employees
        + customers
        + employees
    )
    remaining = max_rows - fixed
    if remaining < 100_000:
        # shrink persons slightly to make room
        shrink = min(persons // 10, 100_000 - remaining)
        persons -= shrink
        restricted = min(restricted, persons - 1)
        fixed = (
            countries
            + locations
            + warehouses
            + employment_jobs
            + persons
            + restricted
            + person_locations
            + phones
            + companies
            + customer_employees
            + customers
            + employees
        )
        remaining = max_rows - fixed

    # products ~42%, order_items ~35%, inventory ~14%, orders ~9% of remainder
    products = int(remaining * 0.42)
    order_items = int(remaining * 0.35)
    inventory = int(remaining * 0.14)
    orders = remaining - products - order_items - inventory
    if orders < 1:
        orders = 1

    b = RowBudget(
        countries=countries,
        locations=locations,
        warehouses=warehouses,
        employment_jobs=employment_jobs,
        persons=persons,
        restricted=restricted,
        person_locations=person_locations,
        phones=phones,
        companies=companies,
        customer_employees=customer_employees,
        customers=customers,
        employees=employees,
        products=products,
        inventory=inventory,
        orders=orders,
        order_items=order_items,
    )
    while b.total() > max_rows and b.products > 10_000:
        b = replace(b, products=b.products - min(5000, max(1, b.products // 25)))
    while b.total() > max_rows and b.order_items > 10_000:
        b = replace(b, order_items=b.order_items - min(5000, max(1, b.order_items // 25)))
    return b


@dataclass
class MaxIds:
    country: int = 0
    location: int = 0
    warehouse: int = 0
    hr_job: int = 0
    person: int = 0
    phone: int = 0
    company: int = 0
    customer_employee: int = 0
    customer: int = 0
    employee: int = 0
    product: int = 0
    inventory: int = 0
    order_: int = 0  # order is reserved
    order_item: int = 0


def fetch_max_ids(cur) -> MaxIds:
    def m(table: str, col: str) -> int:
        cur.execute("SELECT COALESCE(MAX({0}), 0) FROM {1}".format(col, table))
        return int(cur.fetchone()[0])

    return MaxIds(
        country=m("bronze.country", "country_id"),
        location=m("bronze.location", "location_id"),
        warehouse=m("bronze.warehouse", "warehouse_id"),
        hr_job=m("bronze.employment_jobs", "hr_job_id"),
        person=m("bronze.person", "person_id"),
        phone=m("bronze.phone_number", "phone_number_id"),
        company=m("bronze.customer_company", "company_id"),
        customer_employee=m("bronze.customer_employee", "customer_employee_id"),
        customer=m("bronze.customer", "customer_id"),
        employee=m("bronze.employment", "employee_id"),
        product=m("bronze.product", "product_id"),
        inventory=m("bronze.inventory", "inventory_id"),
        order_=m("bronze.orders", "order_id"),
        order_item=m("bronze.order_item", "order_item_id"),
    )


def truncate_bronze(cur) -> None:
    cur.execute(
        """
        TRUNCATE TABLE
            bronze.order_item,
            bronze.orders,
            bronze.customer,
            bronze.customer_employee,
            bronze.customer_company,
            bronze.employment,
            bronze.employment_jobs,
            bronze.phone_number,
            bronze.person_location,
            bronze.restricted_info,
            bronze.person,
            bronze.inventory,
            bronze.product,
            bronze.warehouse,
            bronze.location,
            bronze.country
        RESTART IDENTITY CASCADE
        """
    )


def insert_countries(cur, n: int, batch_id: int, country0: int) -> None:
    rows = []
    for i in range(1, n + 1):
        t = COUNTRY_NAMES[(i - 1) % len(COUNTRY_NAMES)]
        name, code, lang, cur_code = t
        rows.append((country0 + i, name, code, lang, cur_code, "AMAZON_MARKETPLACE", batch_id))
    execute_batch(
        cur,
        """
        INSERT INTO bronze.country (
            country_id, country_name, country_code, nat_lang_code, currency_code,
            _source_system, _batch_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
        page_size=500,
    )


def insert_locations(
    cur, n: int, batch_id: int, loc0: int, country0: int, countries_new: int
) -> None:
    rows = []
    cn = max(1, countries_new)
    for i in range(1, n + 1):
        city, st = US_CITIES[i % len(US_CITIES)]
        cid = country0 + 1 + ((i - 1) % cn)
        rows.append(
            (
                loc0 + i,
                cid,
                cid,
                _clip(f"{loc0 + i} Amazon Way", 100),
                "",
                city,
                st,
                "",
                f"{10000 + (i % 89999):05d}",
                1 + (i % 5),
                _clip(f"FC access road #{i}", 256),
                _clip("Dock high, receiving Mon–Sun", 512),
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.location (
            location_id, country_id, countries_country_id,
            address_line_1, address_line_2, city, state, district, postal_code,
            location_type_code, description, shipping_notes,
            _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=2000,
    )


def insert_warehouses(
    cur, n: int, batch_id: int, wh0: int, loc0: int, new_location_count: int
) -> None:
    rows = []
    nc = max(1, new_location_count)
    for i in range(1, n + 1):
        lid = loc0 + 1 + ((i * 17) % nc)
        code = f"AMZN-FC-{wh0 + i:04d}-{string.ascii_uppercase[i % 26]}"
        rows.append((wh0 + i, lid, _clip(f"Amazon Fulfillment Center {code}", 100), "AMAZON_MARKETPLACE", batch_id))
    execute_batch(
        cur,
        """
        INSERT INTO bronze.warehouse (warehouse_id, location_id, warehouse_name, _source_system, _batch_id)
        VALUES (%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=500,
    )


def insert_employment_jobs(
    cur, n: int, batch_id: int, job0: int, country0: int, countries_new: int
) -> None:
    titles = (
        "FC Associate", "Operations Manager", "Inventory Control", "HR Specialist",
        "Shift Lead", "Quality Auditor", "Picker Trainer", "IT Support Analyst",
    )
    rows = []
    cn = max(1, countries_new)
    for i in range(1, n + 1):
        cid = country0 + 1 + ((i - 1) % cn)
        rows.append(
            (
                job0 + i,
                cid,
                _clip(f"{random.choice(titles)} – Level {(i % 4) + 1}", 100),
                35_000 + (i % 40) * 1_000,
                120_000 + (i % 80) * 500,
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.employment_jobs (
            hr_job_id, countries_country_id, job_title, min_salary, max_salary,
            _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=500,
    )


def insert_persons(cur, n: int, batch_id: int, person0: int) -> None:
    batch: List[Tuple[Any, ...]] = []
    page = 5000
    for i in range(1, n + 1):
        fn = FIRST_NAMES[i % len(FIRST_NAMES)]
        ln = LAST_NAMES[i % len(LAST_NAMES)]
        batch.append(
            (
                person0 + i,
                fn,
                ln,
                _clip("" if i % 3 else "Marie", 100),
                _clip("" if i % 4 else f"{fn[:3]}y", 50),
                1033,
                1033,
                random.choice(("M", "F", "Non-binary", "Prefer not to say")),
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
        if len(batch) >= page:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.person (
                    person_id, first_name, last_name, middle_names, nickname,
                    nat_lang_code, culture_code, gender, _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                batch,
                page_size=page,
            )
            batch = []
    if batch:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.person (
                person_id, first_name, last_name, middle_names, nickname,
                nat_lang_code, culture_code, gender, _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            batch,
            page_size=len(batch),
        )


def insert_restricted(cur, r: int, batch_id: int, person0: int) -> None:
    rows = []
    for k in range(1, r + 1):
        pid = person0 + k
        dob = date(1970, 1, 1) + timedelta(days=k % 12_000)
        rows.append(
            (
                pid,
                dob,
                None,
                _clip(f"SSN-ALT-{pid:08d}", 50),
                _clip(f"PPT-{pid:09d}", 50),
                dob + timedelta(days=365 * (18 + k % 20)),
                min(5, 1 + k % 5),
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
        if len(rows) >= 3000:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.restricted_info (
                    person_id, date_of_birth, date_of_death, government_id, passport_id,
                    hire_date, seniority_code, _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                rows,
                page_size=3000,
            )
            rows = []
    if rows:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.restricted_info (
                person_id, date_of_birth, date_of_death, government_id, passport_id,
                hire_date, seniority_code, _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            rows,
            page_size=len(rows),
        )


def insert_person_locations(
    cur,
    n: int,
    batch_id: int,
    person0: int,
    new_person_count: int,
    loc0: int,
    new_location_count: int,
) -> None:
    seen = set()
    rows = []
    i = 0
    npc = max(1, new_person_count)
    nl = max(1, new_location_count)
    while len(rows) < n and i < n * 3:
        i += 1
        pid = person0 + 1 + random.randint(0, npc - 1)
        lid = loc0 + 1 + random.randint(0, nl - 1)
        if (pid, lid) in seen:
            continue
        seen.add((pid, lid))
        usage = random.choice(("HOME", "WORK", "SHIPPING", "BILLING"))
        rows.append(
            (
                pid,
                lid,
                _clip(f"Apt {pid % 500}", 100),
                usage,
                _clip(f"Verified {usage.lower()} address; updated {date.today().isoformat()}", 5000)[:2000],
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.person_location (
            persons_person_id, locations_location_id, sub_address, location_usage, notes,
            _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (persons_person_id, locations_location_id) DO NOTHING
        """,
        rows,
        page_size=3000,
    )


def insert_phones(
    cur,
    n: int,
    batch_id: int,
    phone0: int,
    person0: int,
    new_person_count: int,
    loc0: int,
    new_location_count: int,
) -> None:
    rows = []
    npc = max(1, new_person_count)
    nl = max(1, new_location_count)
    for i in range(1, n + 1):
        pid = person0 + 1 + ((i - 1) % npc)
        lid = None if i % 3 == 0 else loc0 + 1 + ((i * 11) % nl)
        nxx = 200 + (i % 799)
        sub = 1000 + (i % 8999)
        ptype = 1 + (i % 5)
        rows.append(
            (
                phone0 + i,
                pid,
                lid,
                f"555{nxx:03d}{sub:04d}",
                "+1",
                ptype,
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
        if len(rows) >= 5000:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.phone_number (
                    phone_number_id, persons_person_id, locations_location_id,
                    phone_number, country_code, phone_type_id, _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                rows,
                page_size=5000,
            )
            rows = []
    if rows:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.phone_number (
                phone_number_id, persons_person_id, locations_location_id,
                phone_number, country_code, phone_type_id, _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            rows,
            page_size=len(rows),
        )


def insert_companies(cur, n: int, batch_id: int, company0: int) -> None:
    rows = []
    for i in range(1, n + 1):
        rows.append(
            (
                company0 + i,
                _clip(f"Marketplace Seller LLC {company0 + i} – Fulfillment Partner", 100),
                round(50_000 + (i % 100) * 10_000.0, 2),
                random.choice(CURRENCIES),
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.customer_company (
            company_id, company_name, company_credit_limit, credit_limit_currency,
            _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=2000,
    )


def insert_customer_employees(
    cur, n: int, batch_id: int, ce0: int, company0: int, companies_new: int
) -> None:
    rows = []
    depts = ("Account Mgmt", "Procurement", "Logistics", "Finance", "Support")
    cm = max(1, companies_new)
    for i in range(1, n + 1):
        cid = company0 + 1 + ((i - 1) % cm)
        rows.append(
            (
                ce0 + i,
                cid,
                f"AMZ-BADGE-{ce0 + i:06d}",
                _clip(f"{random.choice(depts)} Liaison", 100),
                random.choice(depts),
                round(5000 + (i % 50) * 1000.0, 2),
                "USD",
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.customer_employee (
            customer_employee_id, company_id, badge_number, job_title, department,
            credit_limit, credit_limit_currency, _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=3000,
    )


def insert_customers(
    cur,
    n: int,
    batch_id: int,
    cust0: int,
    person0: int,
    new_person_count: int,
    ce0: int,
    ce_new: int,
) -> None:
    rows = []
    for i in range(1, n + 1):
        pid = person0 + i
        if i % 4 == 0 or ce_new < 1:
            ce = None
        else:
            ce = ce0 + 1 + (i % ce_new)
        rows.append(
            (
                cust0 + i,
                pid,
                ce,
                5000 + (i % 500),
                min(10, 1 + (i % 10)),
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.customer (
            customer_id, person_id, customer_employee_id, accountmgr_id, income_level,
            _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=5000,
    )


def insert_employment(
    cur,
    n: int,
    batch_id: int,
    emp0: int,
    person0: int,
    new_person_count: int,
    job0: int,
    job_new: int,
) -> None:
    """New employees use high person IDs in this batch (same layout as first load, offset)."""
    rows = []
    base_rel = max(1, new_person_count - n - 1)
    jn = max(1, job_new)
    for i in range(1, n + 1):
        pid = person0 + base_rel + i
        if pid > person0 + new_person_count:
            pid = person0 + 1 + (i % max(1, new_person_count))
        jid = job0 + 1 + ((i - 1) % jn)
        start = date.today() - timedelta(days=100 + (i % 2000))
        rows.append(
            (
                emp0 + i,
                pid,
                jid,
                None,
                start,
                None if i % 11 else start + timedelta(days=200),
                round(38_000 + (i % 100) * 800.0, 2),
                round((i % 8) * 0.25, 2),
                "ACTIVE" if i % 11 else "ON_LEAVE",
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
    execute_batch(
        cur,
        """
        INSERT INTO bronze.employment (
            employee_id, person_id, hr_job_id, manager_employee_id, start_date, end_date,
            salary, commission_percent, employment_status, _source_system, _batch_id
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        rows,
        page_size=5000,
    )


def insert_products(
    cur, n: int, batch_id: int, product0: int, batch_size: int = 8000
) -> None:
    buf: List[Tuple[Any, ...]] = []
    for k in range(1, n + 1):
        product_id = product0 + k
        buf.append(build_product_row(product_id, batch_id))
        if len(buf) >= batch_size:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.product (
                    product_id, product_name, description, category, weight_class, warranty_period,
                    supplier_id, status, list_price, minimum_price, price_currency, catalog_url,
                    _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                buf,
                page_size=batch_size,
            )
            buf = []
            if k % 200_000 == 0:
                logger.info("  products: %s / %s", k, n)
    if buf:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.product (
                product_id, product_name, description, category, weight_class, warranty_period,
                supplier_id, status, list_price, minimum_price, price_currency, catalog_url,
                _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            buf,
            page_size=len(buf),
        )


def insert_inventory(
    cur,
    n: int,
    batch_id: int,
    inv0: int,
    product0: int,
    new_product_count: int,
    wh0: int,
    new_warehouse_count: int,
) -> None:
    buf = []
    seen = set()
    attempts = 0
    inv_seq = 0
    npc = max(1, new_product_count)
    nw = max(1, new_warehouse_count)
    while len(buf) < n and attempts < n * 5:
        attempts += 1
        pid = product0 + 1 + random.randint(0, npc - 1)
        wid = wh0 + 1 + random.randint(0, nw - 1)
        if (pid, wid) in seen:
            continue
        seen.add((pid, wid))
        inv_seq += 1
        on_hand = random.randint(0, 5000)
        buf.append(
            (
                inv0 + inv_seq,
                pid,
                wid,
                on_hand,
                max(0, on_hand - random.randint(0, min(50, on_hand))),
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
        if len(buf) >= 8000:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.inventory (
                    inventory_id, product_id, warehouse_id, quantity_on_hand, quantity_available,
                    _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                buf,
                page_size=8000,
            )
            buf = []
    if buf:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.inventory (
                inventory_id, product_id, warehouse_id, quantity_on_hand, quantity_available,
                _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s)
            """,
            buf,
            page_size=len(buf),
        )


def insert_orders(
    cur,
    n: int,
    batch_id: int,
    order0: int,
    cust0: int,
    new_customer_count: int,
    emp0: int,
    new_employee_count: int,
) -> None:
    buf = []
    statuses = ("PENDING", "SHIPPED", "DELIVERED", "CANCELLED")
    promos = ("", "", "PRIME10", "SAVE5", "FRESH20", "FALL2025")
    if new_customer_count < 1:
        raise ValueError("new_customer_count must be >= 1")
    ncc = new_customer_count
    nec = new_employee_count
    for k in range(1, n + 1):
        oid = order0 + k
        cid = cust0 + 1 + (k % ncc)
        if nec < 1:
            rep = None
        else:
            rep = emp0 + 1 + (k % nec)
        od = date.today() - timedelta(days=k % 900)
        buf.append(
            (
                oid,
                cid,
                rep,
                od,
                _clip(f"AMZ-{oid:010d}", 20),
                random.choice(statuses),
                0.0,
                "USD",
                random.choice(promos) or None,
                "AMAZON_MARKETPLACE",
                batch_id,
            )
        )
        if len(buf) >= 5000:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.orders (
                    order_id, customer_id, sales_rep_id, order_date, order_code, order_status,
                    order_total, order_currency, promotion_code, _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                buf,
                page_size=5000,
            )
            buf = []
    if buf:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.orders (
                order_id, customer_id, sales_rep_id, order_date, order_code, order_status,
                order_total, order_currency, promotion_code, _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            buf,
            page_size=len(buf),
        )


def insert_order_items(
    cur,
    n: int,
    batch_id: int,
    oi0: int,
    order0: int,
    new_order_count: int,
    product0: int,
    new_product_count: int,
) -> None:
    if new_order_count < 1:
        raise ValueError("new_order_count must be >= 1")
    buf = []
    npc = max(1, new_product_count)
    for k in range(1, n + 1):
        oiid = oi0 + k
        oid = order0 + 1 + ((k - 1) % new_order_count)
        pid = product0 + 1 + random.randint(0, npc - 1)
        price = round(random.uniform(4.99, 299.99), 2)
        qty = round(random.uniform(1, 5), 2)
        buf.append((oiid, oid, pid, price, qty, "AMAZON_MARKETPLACE", batch_id))
        if len(buf) >= 12_000:
            execute_batch(
                cur,
                """
                INSERT INTO bronze.order_item (
                    order_item_id, order_id, product_id, unit_price, quantity,
                    _source_system, _batch_id
                ) VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                buf,
                page_size=12_000,
            )
            buf = []
            if k % 400_000 == 0:
                logger.info("  order_item: %s / %s", k, n)
    if buf:
        execute_batch(
            cur,
            """
            INSERT INTO bronze.order_item (
                order_item_id, order_id, product_id, unit_price, quantity,
                _source_system, _batch_id
            ) VALUES (%s,%s,%s,%s,%s,%s,%s)
            """,
            buf,
            page_size=len(buf),
        )


def update_order_totals(cur) -> None:
    cur.execute(
        """
        UPDATE bronze.orders o
        SET order_total = sub.t
        FROM (
            SELECT order_id, COALESCE(SUM(unit_price * quantity), 0)::decimal(15,2) AS t
            FROM bronze.order_item
            GROUP BY order_id
        ) sub
        WHERE o.order_id = sub.order_id
        """
    )


def count_bronze_rows(cur) -> int:
    cur.execute(
        """
        SELECT COALESCE(SUM(n), 0) FROM (
            SELECT COUNT(*) AS n FROM bronze.country
            UNION ALL SELECT COUNT(*) FROM bronze.location
            UNION ALL SELECT COUNT(*) FROM bronze.warehouse
            UNION ALL SELECT COUNT(*) FROM bronze.product
            UNION ALL SELECT COUNT(*) FROM bronze.inventory
            UNION ALL SELECT COUNT(*) FROM bronze.person
            UNION ALL SELECT COUNT(*) FROM bronze.restricted_info
            UNION ALL SELECT COUNT(*) FROM bronze.person_location
            UNION ALL SELECT COUNT(*) FROM bronze.phone_number
            UNION ALL SELECT COUNT(*) FROM bronze.customer_company
            UNION ALL SELECT COUNT(*) FROM bronze.customer_employee
            UNION ALL SELECT COUNT(*) FROM bronze.customer
            UNION ALL SELECT COUNT(*) FROM bronze.employment_jobs
            UNION ALL SELECT COUNT(*) FROM bronze.employment
            UNION ALL SELECT COUNT(*) FROM bronze.orders
            UNION ALL SELECT COUNT(*) FROM bronze.order_item
        ) q
        """
    )
    return int(cur.fetchone()[0])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-rows", type=int, default=5_000_000, help="Hard cap on total bronze rows (default 5M)")
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="TRUNCATE all bronze tables first (full replace). Default: append using next free IDs.",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if args.max_rows < 50_000:
        logger.error("--max-rows too small; use at least 50000")
        return 2

    with get_db_connection() as conn:
        conn.autocommit = False
        cur = conn.cursor()
        try:
            if args.truncate:
                logger.info("Truncating bronze tables…")
                truncate_bronze(cur)
                conn.commit()
                cur = conn.cursor()

            existing = count_bronze_rows(cur)
            budget_room = args.max_rows - existing
            if budget_room < 50_000:
                logger.error(
                    "Not enough room under --max-rows=%s: bronze already has %s rows "
                    "(need at least 50,000 free for one batch).",
                    f"{args.max_rows:,}",
                    f"{existing:,}",
                )
                return 2

            b = compute_budget(budget_room)
            if b.total() > budget_room:
                logger.error("Budget compute error: %s > %s", b.total(), budget_room)
                return 2
            if b.customers < 1 or b.persons < 1:
                logger.error("Budget too tight: need customers and persons >= 1")
                return 2

            mx = fetch_max_ids(cur)
            logger.info(
                "Append ID offsets: country=%s location=%s product=%s order=%s …",
                mx.country,
                mx.location,
                mx.product,
                mx.order_,
            )
            logger.info(
                "This run adds ~%s rows (bronze now %s; cap %s).",
                f"{b.total():,}",
                f"{existing:,}",
                f"{args.max_rows:,}",
            )
            batch_id = abs(hash((time.time(), b.total(), mx.product))) % 2_000_000_000

            logger.info("Loading countries (%s)…", b.countries)
            insert_countries(cur, b.countries, batch_id, mx.country)
            logger.info("Loading locations (%s)…", b.locations)
            insert_locations(cur, b.locations, batch_id, mx.location, mx.country, b.countries)
            logger.info("Loading warehouses (%s)…", b.warehouses)
            insert_warehouses(cur, b.warehouses, batch_id, mx.warehouse, mx.location, b.locations)
            logger.info("Loading employment_jobs (%s)…", b.employment_jobs)
            insert_employment_jobs(cur, b.employment_jobs, batch_id, mx.hr_job, mx.country, b.countries)
            logger.info("Loading persons (%s)…", b.persons)
            insert_persons(cur, b.persons, batch_id, mx.person)
            logger.info("Loading restricted_info (%s)…", b.restricted)
            insert_restricted(cur, b.restricted, batch_id, mx.person)
            logger.info("Loading person_location (%s)…", b.person_locations)
            insert_person_locations(
                cur,
                b.person_locations,
                batch_id,
                mx.person,
                b.persons,
                mx.location,
                b.locations,
            )
            logger.info("Loading phone_number (%s)…", b.phones)
            insert_phones(
                cur,
                b.phones,
                batch_id,
                mx.phone,
                mx.person,
                b.persons,
                mx.location,
                b.locations,
            )
            logger.info("Loading customer_company (%s)…", b.companies)
            insert_companies(cur, b.companies, batch_id, mx.company)
            logger.info("Loading customer_employee (%s)…", b.customer_employees)
            insert_customer_employees(
                cur, b.customer_employees, batch_id, mx.customer_employee, mx.company, b.companies
            )
            logger.info("Loading customers (%s)…", b.customers)
            insert_customers(
                cur,
                b.customers,
                batch_id,
                mx.customer,
                mx.person,
                b.persons,
                mx.customer_employee,
                b.customer_employees,
            )
            logger.info("Loading employment (%s)…", b.employees)
            insert_employment(
                cur,
                b.employees,
                batch_id,
                mx.employee,
                mx.person,
                b.persons,
                mx.hr_job,
                b.employment_jobs,
            )
            logger.info("Loading products (%s)…", b.products)
            insert_products(cur, b.products, batch_id, mx.product)
            logger.info("Loading inventory (%s)…", b.inventory)
            insert_inventory(
                cur,
                b.inventory,
                batch_id,
                mx.inventory,
                mx.product,
                b.products,
                mx.warehouse,
                b.warehouses,
            )
            logger.info("Loading orders (%s)…", b.orders)
            insert_orders(
                cur,
                b.orders,
                batch_id,
                mx.order_,
                mx.customer,
                b.customers,
                mx.employee,
                b.employees,
            )
            logger.info("Loading order_item (%s)…", b.order_items)
            insert_order_items(
                cur,
                b.order_items,
                batch_id,
                mx.order_item,
                mx.order_,
                b.orders,
                mx.product,
                b.products,
            )
            logger.info("Recomputing order totals from line items…")
            update_order_totals(cur)

            conn.commit()

            cur.execute("SELECT COUNT(*) FROM bronze.product")
            logger.info("bronze.product rows: %s", f"{cur.fetchone()[0]:,}")
            total = count_bronze_rows(cur)
            logger.info("bronze TOTAL rows (all tables): %s (cap %s)", f"{total:,}", f"{args.max_rows:,}")
            if total > args.max_rows:
                logger.warning("Total exceeds cap slightly due to uniqueness retries; adjust --max-rows if needed.")
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
