"""
Accurate \"pending row\" counts for Bronze→Silver batching.

Bronze tables often have no primary key; row counts can exceed distinct business keys.
transform_all uses these queries so records_to_process and batch exit logic stay correct.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Step name = first element in transformation_order (see BronzeToSilverTransformer.transform_all)
PENDING_COUNT_SQL: dict[str, str] = {
    "countries": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (b.country_id) b.country_id
          FROM bronze.country b
          ORDER BY b.country_id, b._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.country s WHERE s.country_id = d.country_id)
    """,
    "locations": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (l.location_id) l.location_id
          FROM bronze.location l
          ORDER BY l.location_id, l._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.location s WHERE s.location_id = d.location_id)
    """,
    "warehouses": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (w.warehouse_id) w.warehouse_id
          FROM bronze.warehouse w
          ORDER BY w.warehouse_id, w._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.warehouse s WHERE s.warehouse_id = d.warehouse_id)
    """,
    "products": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (p.product_id) p.product_id
          FROM bronze.product p
          ORDER BY p.product_id, p._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.product s WHERE s.product_id = d.product_id)
    """,
    "inventory": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (i.inventory_id) i.inventory_id
          FROM bronze.inventory i
          ORDER BY i.inventory_id, i._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.inventory s WHERE s.inventory_id = d.inventory_id)
    """,
    "persons": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (b.person_id) b.person_id
          FROM bronze.person b
          ORDER BY b.person_id, b._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.person s WHERE s.person_id = d.person_id)
    """,
    "restricted_info": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (r.person_id) r.person_id, p.person_key
          FROM bronze.restricted_info r
          INNER JOIN silver.person p ON r.person_id = p.person_id
          ORDER BY r.person_id, r._load_timestamp DESC NULLS LAST
        ) x
        WHERE NOT EXISTS (SELECT 1 FROM silver.restricted_info s WHERE s.person_key = x.person_key)
    """,
    "person_locations": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (pl.persons_person_id, pl.locations_location_id)
            pl.persons_person_id, pl.locations_location_id
          FROM bronze.person_location pl
          ORDER BY pl.persons_person_id, pl.locations_location_id, pl._load_timestamp DESC NULLS LAST
        ) bd
        INNER JOIN silver.person p ON bd.persons_person_id = p.person_id
        INNER JOIN silver.location l ON bd.locations_location_id = l.location_id
        WHERE NOT EXISTS (
          SELECT 1 FROM silver.person_location s
          WHERE s.person_key = p.person_key AND s.location_key = l.location_key
        )
    """,
    "phone_numbers": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (pn.phone_number_id) pn.phone_number_id
          FROM bronze.phone_number pn
          ORDER BY pn.phone_number_id, pn._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.phone_number s WHERE s.phone_id = d.phone_number_id)
    """,
    "customer_companies": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (b.company_id) b.company_id
          FROM bronze.customer_company b
          ORDER BY b.company_id, b._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.customer_company s WHERE s.company_id = d.company_id)
    """,
    "customer_employees": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (ce.customer_employee_id) ce.customer_employee_id
          FROM bronze.customer_employee ce
          ORDER BY ce.customer_employee_id, ce._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (
          SELECT 1 FROM silver.customer_employee s WHERE s.customer_employee_id = d.customer_employee_id
        )
    """,
    "employment_jobs": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (ej.hr_job_id) ej.hr_job_id
          FROM bronze.employment_jobs ej
          ORDER BY ej.hr_job_id, ej._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.employment_jobs s WHERE s.hr_job_id = d.hr_job_id)
    """,
    "employees": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (e.employee_id) e.employee_id
          FROM bronze.employment e
          WHERE e.person_id IS NOT NULL
            AND e.person_id IN (SELECT person_id FROM silver.person)
          ORDER BY e.employee_id, e._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.employee s WHERE s.employee_id = d.employee_id)
    """,
    "customers": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (c.customer_id) c.customer_id
          FROM bronze.customer c
          WHERE c.person_id IS NOT NULL
            AND c.person_id IN (SELECT person_id FROM silver.person)
          ORDER BY c.customer_id, c._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.customer s WHERE s.customer_id = d.customer_id)
    """,
    "orders": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (o.order_id) o.order_id
          FROM bronze.orders o
          WHERE o.customer_id IS NOT NULL
            AND o.customer_id IN (SELECT customer_id FROM silver.customer)
          ORDER BY o.order_id, o._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (SELECT 1 FROM silver.orders s WHERE s.order_id = d.order_id)
    """,
    "order_items": """
        SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (oi.order_item_id) oi.order_item_id
          FROM bronze.order_item oi
          WHERE oi.order_id IS NOT NULL
            AND oi.product_id IS NOT NULL
            AND oi.order_id IN (SELECT order_id FROM silver.orders)
            AND oi.product_id IN (SELECT product_id FROM silver.product)
          ORDER BY oi.order_item_id, oi._load_timestamp DESC NULLS LAST
        ) d
        WHERE NOT EXISTS (
          SELECT 1 FROM silver.order_item s WHERE s.order_item_id = d.order_item_id
        )
    """,
}


def fetch_pending_count(cursor, step_name: str) -> Optional[int]:
    """Return pending natural-key rows for a step, or None if query fails."""
    sql = PENDING_COUNT_SQL.get(step_name)
    if not sql:
        return None
    try:
        cursor.execute(sql)
        return int(cursor.fetchone()[0])
    except Exception as e:
        logger.warning("Pending count failed for %s: %s", step_name, e)
        try:
            cursor.connection.rollback()
        except Exception:
            pass
        return None
