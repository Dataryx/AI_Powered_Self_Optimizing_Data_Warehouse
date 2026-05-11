# Master Prompt — Bronze Layer ERD (DDL-Exact)

Use the block below **verbatim** (or paste into Midjourney, DALL·E, Figma AI, Napkin, dbdiagram.io instructions, etc.).  
**Source of truth:** `data-warehouse/schemas/complete_warehouse.sql` — **16 tables**, **21 foreign keys**. Do not add relationships for columns without `FOREIGN KEY` (e.g. **`bronze.customer.accountmgr_id`** has **no FK** — omit any arrow).

---

```text
TASK: Render a formal Crow’s-Foot Entity–Relationship Diagram for PostgreSQL schema `bronze` only.

ACCURACY RULES:
- Exactly 16 entity boxes — table names as listed below.
- Exactly 21 relationship lines — one per FOREIGN KEY below; label each line with the CHILD column name (snake_case).
- Crow’s Foot on the MANY / FK side; single bar (one) on the ONE / referenced PK side.
- PK columns: underline or tag “PK” in each entity box.
- FK columns: tag “FK” and arrow originates from that attribute toward the parent PK.
- Nullable FK columns: use dashed optional cardinality on the child side where helpful (PostgreSQL allows NULL on these unless NOT NULL).
- Do NOT draw: customer.accountmgr_id → anything (no FK in DDL).
- Style: white background, 16:9, academic, sans-serif, blue/indigo strokes, no 3D, no clipart, no duplicate copies of the same table.

=== ENTITIES AND PRIMARY KEYS ===

bronze.country
  PK: country_id

bronze.location
  PK: location_id

bronze.warehouse
  PK: warehouse_id

bronze.product
  PK: product_id

bronze.inventory
  PK: inventory_id

bronze.person
  PK: person_id

bronze.restricted_info
  PK: person_id   (same column is FK → person: treat as ONE-TO-ONE with person)

bronze.person_location
  PK: (persons_person_id, locations_location_id)  composite

bronze.phone_number
  PK: phone_number_id

bronze.customer_company
  PK: company_id

bronze.customer_employee
  PK: customer_employee_id

bronze.customer
  PK: customer_id

bronze.employment_jobs
  PK: hr_job_id

bronze.employment
  PK: employee_id

bronze.orders
  PK: order_id

bronze.order_item
  PK: order_item_id

=== FOREIGN KEYS (21) — CHILD.COLUMN → PARENT.TABLE(PK) ===
Draw arrow FROM child entity TO parent entity; cardinality FROM PARENT TO CHILD:

1)  bronze.location.country_id              → bronze.country(country_id)
    CARDINALITY: country ONE — location MANY  (label FK: country_id)

2)  bronze.location.countries_country_id    → bronze.country(country_id)
    CARDINALITY: country ONE — location MANY  (second FK to same parent; label FK: countries_country_id; visually distinct label from #1)

3)  bronze.warehouse.location_id            → bronze.location(location_id)
    CARDINALITY: location ONE — warehouse MANY

4)  bronze.inventory.product_id             → bronze.product(product_id)
    CARDINALITY: product ONE — inventory MANY

5)  bronze.inventory.warehouse_id           → bronze.warehouse(warehouse_id)
    CARDINALITY: warehouse ONE — inventory MANY

6)  bronze.restricted_info.person_id       → bronze.person(person_id)
    CARDINALITY: person ONE — restricted_info ONE  (1:1; PK of child equals FK)

7)  bronze.person_location.persons_person_id    → bronze.person(person_id)
    CARDINALITY: person ONE — person_location MANY

8)  bronze.person_location.locations_location_id → bronze.location(location_id)
    CARDINALITY: location ONE — person_location MANY
    (Together, person_location is an associative / bridge entity for M:N person↔location resolved through two 1:N legs.)

9)  bronze.phone_number.persons_person_id       → bronze.person(person_id)
    CARDINALITY: person ONE — phone_number MANY  (nullable FK → optional participation)

10) bronze.phone_number.locations_location_id    → bronze.location(location_id)
    CARDINALITY: location ONE — phone_number MANY  (nullable FK)

11) bronze.customer_employee.company_id     → bronze.customer_company(company_id)
    CARDINALITY: customer_company ONE — customer_employee MANY

12) bronze.customer.person_id             → bronze.person(person_id)
    CARDINALITY: person ONE — customer MANY

13) bronze.customer.customer_employee_id   → bronze.customer_employee(customer_employee_id)
    CARDINALITY: customer_employee ONE — customer MANY

14) bronze.employment_jobs.countries_country_id → bronze.country(country_id)
    CARDINALITY: country ONE — employment_jobs MANY

15) bronze.employment.person_id           → bronze.person(person_id)
    CARDINALITY: person ONE — employment MANY

16) bronze.employment.hr_job_id           → bronze.employment_jobs(hr_job_id)
    CARDINALITY: employment_jobs ONE — employment MANY

17) bronze.employment.manager_employee_id → bronze.employment(employee_id)
    CARDINALITY: employment (manager) ONE — employment (report) MANY  (self-referencing hierarchy)

18) bronze.orders.customer_id             → bronze.customer(customer_id)
    CARDINALITY: customer ONE — orders MANY

19) bronze.orders.sales_rep_id            → bronze.employment(employee_id)
    CARDINALITY: employment ONE — orders MANY  (internal sales rep; NOT customer_employee)

20) bronze.order_item.order_id            → bronze.orders(order_id)
    CARDINALITY: orders ONE — order_item MANY

21) bronze.order_item.product_id          → bronze.product(product_id)
    CARDINALITY: product ONE — order_item MANY

=== LAYOUT HINT (reduce crossing edges) ===
Group: (country, location, warehouse) | (product, inventory) | (person, restricted_info, person_location, phone_number) | (customer_company, customer_employee, customer) | (employment_jobs, employment) | (orders, order_item). Place `country` once; `location` bridges geography and person_phone/person_location.

TITLE: Bronze Layer ERD — PostgreSQL (complete_warehouse.sql)
CAPTION: 16 tables, 21 foreign keys; lineage columns (_source_system, _load_timestamp, _batch_id) omitted from diagram.
```

---

## Quick verification checklist

| Check | OK |
|-------|-----|
| Two edges from `location` to `country` (`country_id` + `countries_country_id`) | ✓ |
| `inventory.warehouse_id` from `warehouse`, not `product` | ✓ |
| `orders.sales_rep_id` → `employment`, not `customer_employee` | ✓ |
| `restricted_info` drawn as **1:1** with `person` | ✓ |
| No arrow for `customer.accountmgr_id` | ✓ |
| Self-FK on `employment` for `manager_employee_id` | ✓ |
