#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Populate Big Data Warehouse - Bronze Layer Only
Generates and loads large-scale e-commerce data into Bronze layer tables.
Only populates tables that have no data (empty tables).
"""

import sys
import os
import logging
from pathlib import Path
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import execute_batch
from faker import Faker
import random

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
log_file = Path(__file__).parent.parent / "warehouse_population.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Initialize Faker
fake = Faker()
Faker.seed(42)
random.seed(42)


class BigWarehousePopulator:
    """Populates Bronze layer tables with large-scale e-commerce data."""
    
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.cursor()
        self.batch_id = int(datetime.now().timestamp())
        
        # Configuration for big data warehouse
        self.config = {
            'num_countries': 50,
            'num_locations': 5000,
            'num_warehouses': 100,
            'num_products': 50000,
            'num_inventory': 5000,
            'num_persons': 200000,
            'num_customers': 150000,
            'num_employees': 5000,
            'num_orders': 5000000,
            'days_of_history': 730,
            'batch_size': 10000,
        }
        
        # Store generated IDs for foreign key relationships
        self.country_ids = []
        self.location_ids = []
        self.warehouse_ids = []
        self.product_ids = []
        self.person_ids = []
        self.customer_company_ids = []
        self.customer_employee_ids = []
        self.customer_ids = []
        self.employment_job_ids = []
        self.employee_ids = []
        self.order_ids = []
    
    def table_is_empty(self, schema: str, table: str) -> bool:
        """Check if a table is empty."""
        try:
            self.cur.execute(f"SELECT 1 FROM {schema}.{table} LIMIT 1;")
            return self.cur.fetchone() is None
        except Exception as e:
            logger.error(f"Error checking if {schema}.{table} is empty: {e}")
            return False
    
    def populate_bronze_countries(self):
        """Populate bronze.country table."""
        if not self.table_is_empty('bronze', 'country'):
            logger.info("⏭️  bronze.country already has data; skipping.")
            # Load existing country IDs
            self.cur.execute("SELECT country_id FROM bronze.country;")
            self.country_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 1: Populating Bronze Layer - Countries")
        logger.info("=" * 80)
        
        countries = []
        for i in range(1, self.config['num_countries'] + 1):
            countries.append((
                i,
                fake.country()[:50],
                fake.country_code()[:3],
                random.randint(1, 10),
                fake.currency_code()[:10],
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.country_ids.append(i)
        
        execute_batch(self.cur, """
            INSERT INTO bronze.country 
            (country_id, country_name, country_code, nat_lang_code, currency_code, 
             _source_system, _load_timestamp, _batch_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, countries)
        
        self.conn.commit()
        logger.info(f"✓ Countries created: {len(countries):,} records")
    
    def populate_bronze_locations(self):
        """Populate bronze.location table."""
        if not self.table_is_empty('bronze', 'location'):
            logger.info("⏭️  bronze.location already has data; skipping.")
            # Load existing location IDs
            self.cur.execute("SELECT location_id FROM bronze.location;")
            self.location_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 2: Populating Bronze Layer - Locations")
        logger.info("=" * 80)
        
        if not self.country_ids:
            self.cur.execute("SELECT country_id FROM bronze.country;")
            self.country_ids = [row[0] for row in self.cur.fetchall()]
        
        locations = []
        for i in range(1, self.config['num_locations'] + 1):
            locations.append((
                i,
                random.choice(self.country_ids),
                fake.street_address()[:100],
                fake.secondary_address()[:100] if random.random() > 0.5 else None,
                fake.city()[:50],
                fake.state()[:50],
                fake.city_suffix()[:50] if random.random() > 0.7 else None,
                fake.zipcode()[:20],
                random.randint(1, 5),
                fake.text()[:256] if random.random() > 0.7 else None,
                fake.text()[:512] if random.random() > 0.8 else None,
                random.choice(self.country_ids),
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.location_ids.append(i)
            
            if len(locations) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.location 
                    (location_id, country_id, address_line_1, address_line_2, city, state, 
                     district, postal_code, location_type_code, description, shipping_notes,
                     countries_country_id, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, locations)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(self.location_ids):,}/{self.config['num_locations']:,}: {len(locations):,} records")
                locations = []
        
        if locations:
            execute_batch(self.cur, """
                INSERT INTO bronze.location 
                (location_id, country_id, address_line_1, address_line_2, city, state, 
                 district, postal_code, location_type_code, description, shipping_notes,
                 countries_country_id, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, locations)
            self.conn.commit()
        
        logger.info(f"✓ Locations created: {len(self.location_ids):,} records")
    
    def populate_bronze_warehouses(self):
        """Populate bronze.warehouse table."""
        if not self.table_is_empty('bronze', 'warehouse'):
            logger.info("⏭️  bronze.warehouse already has data; skipping.")
            # Load existing warehouse IDs
            self.cur.execute("SELECT warehouse_id FROM bronze.warehouse;")
            self.warehouse_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 3: Populating Bronze Layer - Warehouses")
        logger.info("=" * 80)
        
        if not self.location_ids:
            self.cur.execute("SELECT location_id FROM bronze.location;")
            self.location_ids = [row[0] for row in self.cur.fetchall()]
        
        warehouses = []
        for i in range(1, self.config['num_warehouses'] + 1):
            warehouses.append((
                i,
                random.choice(self.location_ids),
                f"Warehouse {i} - {fake.city()}"[:100],
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.warehouse_ids.append(i)
        
        execute_batch(self.cur, """
            INSERT INTO bronze.warehouse 
            (warehouse_id, location_id, warehouse_name, _source_system, _load_timestamp, _batch_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, warehouses)
        
        self.conn.commit()
        logger.info(f"✓ Warehouses created: {len(warehouses):,} records")
    
    def populate_bronze_products(self):
        """Populate bronze.product table."""
        if not self.table_is_empty('bronze', 'product'):
            logger.info("⏭️  bronze.product already has data; skipping.")
            # Load existing product IDs
            self.cur.execute("SELECT product_id FROM bronze.product;")
            self.product_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 4: Populating Bronze Layer - Products")
        logger.info("=" * 80)
        
        products = []
        for i in range(1, self.config['num_products'] + 1):
            list_price = round(random.uniform(10.0, 10000.0), 2)
            min_price = round(list_price * random.uniform(0.5, 0.9), 2)
            
            products.append((
                i,
                fake.catch_phrase()[:100],
                fake.text()[:500] if random.random() > 0.3 else None,
                random.randint(1, 20),
                random.randint(1, 5),
                random.randint(1, 5),
                random.randint(1, 100),
                random.choice(['ACTIVE', 'INACTIVE', 'DISCONTINUED']),
                list_price,
                min_price,
                fake.currency_code()[:5],
                fake.url()[:256] if random.random() > 0.5 else None,
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.product_ids.append(i)
            
            if len(products) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.product 
                    (product_id, product_name, description, category, weight_class, 
                     warranty_period, supplier_id, status, list_price, minimum_price, 
                     price_currency, catalog_url, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, products)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(self.product_ids):,}/{self.config['num_products']:,}: {len(products):,} records")
                products = []
        
        if products:
            execute_batch(self.cur, """
                INSERT INTO bronze.product 
                (product_id, product_name, description, category, weight_class, 
                 warranty_period, supplier_id, status, list_price, minimum_price, 
                 price_currency, catalog_url, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, products)
            self.conn.commit()
        
        logger.info(f"✓ Products created: {len(self.product_ids):,} records")
    
    def populate_bronze_inventory(self):
        """Populate bronze.inventory table."""
        if not self.table_is_empty('bronze', 'inventory'):
            logger.info("⏭️  bronze.inventory already has data; skipping.")
            return
        
        logger.info("=" * 80)
        logger.info("STEP 5: Populating Bronze Layer - Inventory")
        logger.info("=" * 80)
        
        if not self.product_ids:
            self.cur.execute("SELECT product_id FROM bronze.product LIMIT %s;", (self.config['num_products'],))
            self.product_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.warehouse_ids:
            self.cur.execute("SELECT warehouse_id FROM bronze.warehouse;")
            self.warehouse_ids = [row[0] for row in self.cur.fetchall()]
        
        inventory = []
        inventory_id = 1
        # Create inventory for a subset of products
        selected_products = random.sample(self.product_ids, min(self.config['num_inventory'], len(self.product_ids)))
        
        for product_id in selected_products:
            qty_on_hand = random.randint(0, 10000)
            qty_available = max(0, qty_on_hand - random.randint(0, 100))
            
            inventory.append((
                inventory_id,
                product_id,
                random.choice(self.warehouse_ids),
                qty_on_hand,
                qty_available,
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            inventory_id += 1
        
        execute_batch(self.cur, """
            INSERT INTO bronze.inventory 
            (inventory_id, product_id, warehouse_id, quantity_on_hand, quantity_available,
             _source_system, _load_timestamp, _batch_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, inventory)
        
        self.conn.commit()
        logger.info(f"✓ Inventory created: {len(inventory):,} records")
    
    def populate_bronze_persons(self):
        """Populate bronze.person table."""
        if not self.table_is_empty('bronze', 'person'):
            logger.info("⏭️  bronze.person already has data; skipping.")
            # Load existing person IDs
            self.cur.execute("SELECT person_id FROM bronze.person;")
            self.person_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 6: Populating Bronze Layer - Persons")
        logger.info("=" * 80)
        
        persons = []
        for i in range(1, self.config['num_persons'] + 1):
            persons.append((
                i,
                fake.first_name()[:50],
                fake.last_name()[:50],
                fake.first_name()[:100] if random.random() > 0.7 else None,
                fake.user_name()[:50] if random.random() > 0.5 else None,
                random.randint(1, 10),
                random.randint(1, 10),
                random.choice(['M', 'F', 'Other']),
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.person_ids.append(i)
            
            if len(persons) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.person 
                    (person_id, first_name, last_name, middle_names, nickname, 
                     nat_lang_code, culture_code, gender, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, persons)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(self.person_ids):,}/{self.config['num_persons']:,}: {len(persons):,} records")
                persons = []
        
        if persons:
            execute_batch(self.cur, """
                INSERT INTO bronze.person 
                (person_id, first_name, last_name, middle_names, nickname, 
                 nat_lang_code, culture_code, gender, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, persons)
            self.conn.commit()
        
        logger.info(f"✓ Persons created: {len(self.person_ids):,} records")
    
    def populate_bronze_restricted_info(self):
        """Populate bronze.restricted_info table."""
        if not self.table_is_empty('bronze', 'restricted_info'):
            logger.info("⏭️  bronze.restricted_info already has data; skipping.")
            return
        
        logger.info("=" * 80)
        logger.info("STEP 7: Populating Bronze Layer - Restricted Info")
        logger.info("=" * 80)
        
        if not self.person_ids:
            self.cur.execute("SELECT person_id FROM bronze.person;")
            self.person_ids = [row[0] for row in self.cur.fetchall()]
        
        restricted_info = []
        # Only create restricted info for a subset of persons (those who are employees/customers)
        selected_persons = random.sample(self.person_ids, min(len(self.person_ids), self.config['num_persons']))
        
        for person_id in selected_persons:
            date_of_birth = fake.date_of_birth(minimum_age=18, maximum_age=80)
            
            # Ensure hire_date is always after date_of_birth and before current date
            min_hire_date = date_of_birth + timedelta(days=18 * 365)  # Must be at least 18 years after birth
            max_hire_date = datetime.now().date() - timedelta(days=365)  # Must be at least 1 year ago
            
            if min_hire_date > max_hire_date:
                # If the person is too young to have been hired, set hire_date to min_hire_date
                hire_date = min_hire_date
            else:
                hire_date = fake.date_between(min_hire_date, max_hire_date)
            
            restricted_info.append((
                person_id,
                date_of_birth,
                fake.date_of_birth(minimum_age=0, maximum_age=100) if random.random() > 0.95 else None,
                fake.ssn()[:50] if random.random() > 0.3 else None,
                fake.passport_number()[:50] if random.random() > 0.5 else None,
                hire_date,
                random.randint(1, 10),
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            
            if len(restricted_info) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.restricted_info 
                    (person_id, date_of_birth, date_of_death, government_id, passport_id,
                     hire_date, seniority_code, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, restricted_info)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(restricted_info):,}/{len(selected_persons):,}: {len(restricted_info):,} records")
                restricted_info = []
        
        if restricted_info:
            execute_batch(self.cur, """
                INSERT INTO bronze.restricted_info 
                (person_id, date_of_birth, date_of_death, government_id, passport_id,
                 hire_date, seniority_code, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, restricted_info)
            self.conn.commit()
        
        logger.info(f"✓ Restricted Info created: {len(selected_persons):,} records")
    
    def populate_bronze_person_locations(self):
        """Populate bronze.person_location table."""
        if not self.table_is_empty('bronze', 'person_location'):
            logger.info("⏭️  bronze.person_location already has data; skipping.")
            return
        
        logger.info("=" * 80)
        logger.info("STEP 8: Populating Bronze Layer - Person Locations")
        logger.info("=" * 80)
        
        if not self.person_ids:
            self.cur.execute("SELECT person_id FROM bronze.person;")
            self.person_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.location_ids:
            self.cur.execute("SELECT location_id FROM bronze.location;")
            self.location_ids = [row[0] for row in self.cur.fetchall()]
        
        person_locations = []
        # Create person-location relationships for a subset
        num_relationships = min(len(self.person_ids) * 2, 100000)  # Max 2 locations per person, or 100K
        
        for _ in range(num_relationships):
            person_locations.append((
                random.choice(self.person_ids),
                random.choice(self.location_ids),
                fake.building_number()[:100] if random.random() > 0.5 else None,
                random.choice(['HOME', 'WORK', 'BILLING', 'SHIPPING']),
                fake.text()[:500] if random.random() > 0.7 else None,
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            
            if len(person_locations) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.person_location 
                    (persons_person_id, locations_location_id, sub_address, location_usage, notes,
                     _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, person_locations)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(person_locations):,}/{num_relationships}:, {len(person_locations):,} records")
                person_locations = []
        
        if person_locations:
            execute_batch(self.cur, """
                INSERT INTO bronze.person_location 
                (persons_person_id, locations_location_id, sub_address, location_usage, notes,
                 _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, person_locations)
            self.conn.commit()
        
        logger.info(f"✓ Person Locations created: {num_relationships:,} records")
    
    def populate_bronze_phone_numbers(self):
        """Populate bronze.phone_number table."""
        if not self.table_is_empty('bronze', 'phone_number'):
            logger.info("⏭️  bronze.phone_number already has data; skipping.")
            return
        
        logger.info("=" * 80)
        logger.info("STEP 9: Populating Bronze Layer - Phone Numbers")
        logger.info("=" * 80)
        
        if not self.person_ids:
            self.cur.execute("SELECT person_id FROM bronze.person;")
            self.person_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.location_ids:
            self.cur.execute("SELECT location_id FROM bronze.location;")
            self.location_ids = [row[0] for row in self.cur.fetchall()]
        
        phone_numbers = []
        phone_number_id = 1
        # Create phone numbers for a subset of persons
        num_phones = min(len(self.person_ids) * 1.5, 300000)  # Max 1.5 phones per person, or 300K
        
        for _ in range(int(num_phones)):
            phone_numbers.append((
                phone_number_id,
                random.choice(self.person_ids),
                random.choice(self.location_ids) if random.random() > 0.3 else None,
                fake.phone_number()[:20],
                fake.country_code()[:5],
                random.randint(1, 5),
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            phone_number_id += 1
            
            if len(phone_numbers) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.phone_number 
                    (phone_number_id, persons_person_id, locations_location_id, phone_number,
                     country_code, phone_type_id, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, phone_numbers)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(phone_numbers):,}/{int(num_phones):,}: {len(phone_numbers):,} records")
                phone_numbers = []
        
        if phone_numbers:
            execute_batch(self.cur, """
                INSERT INTO bronze.phone_number 
                (phone_number_id, persons_person_id, locations_location_id, phone_number,
                 country_code, phone_type_id, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, phone_numbers)
            self.conn.commit()
        
        logger.info(f"✓ Phone Numbers created: {int(num_phones):,} records")
    
    def populate_bronze_customer_companies(self):
        """Populate bronze.customer_company table."""
        if not self.table_is_empty('bronze', 'customer_company'):
            logger.info("⏭️  bronze.customer_company already has data; skipping.")
            # Load existing company IDs
            self.cur.execute("SELECT company_id FROM bronze.customer_company;")
            self.customer_company_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 10: Populating Bronze Layer - Customer Companies")
        logger.info("=" * 80)
        
        num_companies = min(self.config['num_customers'] // 10, 15000)  # ~10% of customers are companies
        companies = []
        
        for i in range(1, num_companies + 1):
            credit_limit = round(random.uniform(1000.0, 1000000.0), 2)
            companies.append((
                i,
                fake.company()[:100],
                credit_limit,
                fake.currency_code()[:5],
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.customer_company_ids.append(i)
        
        execute_batch(self.cur, """
            INSERT INTO bronze.customer_company 
            (company_id, company_name, company_credit_limit, credit_limit_currency,
             _source_system, _load_timestamp, _batch_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, companies)
        
        self.conn.commit()
        logger.info(f"✓ Customer Companies created: {len(companies):,} records")
    
    def populate_bronze_customer_employees(self):
        """Populate bronze.customer_employee table."""
        if not self.table_is_empty('bronze', 'customer_employee'):
            logger.info("⏭️  bronze.customer_employee already has data; skipping.")
            # Load existing customer employee IDs
            self.cur.execute("SELECT customer_employee_id FROM bronze.customer_employee;")
            self.customer_employee_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 11: Populating Bronze Layer - Customer Employees")
        logger.info("=" * 80)
        
        if not self.customer_company_ids:
            self.cur.execute("SELECT company_id FROM bronze.customer_company;")
            self.customer_company_ids = [row[0] for row in self.cur.fetchall()]
        
        customer_employees = []
        customer_employee_id = 1
        # Create employees for companies (multiple employees per company)
        num_employees = min(len(self.customer_company_ids) * 30, 500000)  # ~30 employees per company
        
        for _ in range(num_employees):
            credit_limit = round(random.uniform(100.0, 50000.0), 2)
            customer_employees.append((
                customer_employee_id,
                random.choice(self.customer_company_ids),
                fake.bothify(text='??-####')[:30],
                fake.job()[:100],
                fake.bs()[:100],
                credit_limit,
                fake.currency_code()[:5],
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            customer_employee_id += 1
            self.customer_employee_ids.append(customer_employee_id - 1)
            
            if len(customer_employees) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.customer_employee 
                    (customer_employee_id, company_id, badge_number, job_title, department,
                     credit_limit, credit_limit_currency, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, customer_employees)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(customer_employees):,}/{num_employees}:, {len(customer_employees):,} records")
                customer_employees = []
        
        if customer_employees:
            execute_batch(self.cur, """
                INSERT INTO bronze.customer_employee 
                (customer_employee_id, company_id, badge_number, job_title, department,
                 credit_limit, credit_limit_currency, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, customer_employees)
            self.conn.commit()
        
        logger.info(f"✓ Customer Employees created: {num_employees:,} records")
    
    def populate_bronze_customers(self):
        """Populate bronze.customer table."""
        if not self.table_is_empty('bronze', 'customer'):
            logger.info("⏭️  bronze.customer already has data; skipping.")
            # Load existing customer IDs
            self.cur.execute("SELECT customer_id FROM bronze.customer;")
            self.customer_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 12: Populating Bronze Layer - Customers")
        logger.info("=" * 80)
        
        if not self.person_ids:
            self.cur.execute("SELECT person_id FROM bronze.person;")
            self.person_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.customer_employee_ids:
            self.cur.execute("SELECT customer_employee_id FROM bronze.customer_employee LIMIT 1;")
            result = self.cur.fetchone()
            if result:
                self.customer_employee_ids = [None]  # Allow None values
        
        customers = []
        for i in range(1, self.config['num_customers'] + 1):
            customers.append((
                i,
                random.choice(self.person_ids),
                random.choice(self.customer_employee_ids) if self.customer_employee_ids and random.random() > 0.7 else None,
                random.choice(self.person_ids) if random.random() > 0.5 else None,  # accountmgr_id
                random.randint(1, 10),
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.customer_ids.append(i)
            
            if len(customers) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.customer 
                    (customer_id, person_id, customer_employee_id, accountmgr_id, income_level,
                     _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, customers)
                self.conn.commit()
                logger.info(f"  Inserted batch: {len(self.customer_ids):,}/{self.config['num_customers']:,}: {len(customers):,} records")
                customers = []
        
        if customers:
            execute_batch(self.cur, """
                INSERT INTO bronze.customer 
                (customer_id, person_id, customer_employee_id, accountmgr_id, income_level,
                 _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, customers)
            self.conn.commit()
        
        logger.info(f"✓ Customers created: {len(self.customer_ids):,} records")
    
    def populate_bronze_employment_jobs(self):
        """Populate bronze.employment_jobs table."""
        if not self.table_is_empty('bronze', 'employment_jobs'):
            logger.info("⏭️  bronze.employment_jobs already has data; skipping.")
            # Load existing job IDs
            self.cur.execute("SELECT hr_job_id FROM bronze.employment_jobs;")
            self.employment_job_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 13: Populating Bronze Layer - Employment Jobs")
        logger.info("=" * 80)
        
        if not self.country_ids:
            self.cur.execute("SELECT country_id FROM bronze.country;")
            self.country_ids = [row[0] for row in self.cur.fetchall()]
        
        jobs = []
        num_jobs = 50  # Fixed number of job types
        for i in range(1, num_jobs + 1):
            min_salary = round(random.uniform(30000.0, 100000.0), 2)
            max_salary = round(min_salary * random.uniform(1.5, 3.0), 2)
            jobs.append((
                i,
                random.choice(self.country_ids),
                fake.job()[:100],
                min_salary,
                max_salary,
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.employment_job_ids.append(i)
        
        execute_batch(self.cur, """
            INSERT INTO bronze.employment_jobs 
            (hr_job_id, countries_country_id, job_title, min_salary, max_salary,
             _source_system, _load_timestamp, _batch_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, jobs)
        
        self.conn.commit()
        logger.info(f"✓ Employment Jobs created: {len(jobs):,} records")
    
    def populate_bronze_employees(self):
        """Populate bronze.employment table."""
        if not self.table_is_empty('bronze', 'employment'):
            logger.info("⏭️  bronze.employment already has data; skipping.")
            # Load existing employee IDs
            self.cur.execute("SELECT employee_id FROM bronze.employment;")
            self.employee_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 14: Populating Bronze Layer - Employees")
        logger.info("=" * 80)
        
        if not self.person_ids:
            self.cur.execute("SELECT person_id FROM bronze.person;")
            self.person_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.employment_job_ids:
            self.cur.execute("SELECT hr_job_id FROM bronze.employment_jobs;")
            self.employment_job_ids = [row[0] for row in self.cur.fetchall()]
        
        employees = []
        selected_persons = random.sample(self.person_ids, min(self.config['num_employees'], len(self.person_ids)))
        
        for i, person_id in enumerate(selected_persons, 1):
            start_date = fake.date_between(start_date='-10y', end_date='today')
            end_date = fake.date_between(start_date=start_date, end_date='today') if random.random() > 0.8 else None
            salary = round(random.uniform(40000.0, 150000.0), 2)
            
            employees.append((
                i,
                person_id,
                random.choice(self.employment_job_ids),
                random.choice(self.employee_ids) if self.employee_ids and random.random() > 0.7 else None,  # manager
                start_date,
                end_date,
                salary,
                round(random.uniform(0.0, 15.0), 2) if random.random() > 0.6 else None,
                random.choice(['ACTIVE', 'INACTIVE', 'TERMINATED']),
                'OLTP',
                datetime.now(),
                self.batch_id
            ))
            self.employee_ids.append(i)
        
        execute_batch(self.cur, """
            INSERT INTO bronze.employment 
            (employee_id, person_id, hr_job_id, manager_employee_id, start_date, end_date,
             salary, commission_percent, employment_status, _source_system, _load_timestamp, _batch_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, employees)
        
        self.conn.commit()
        logger.info(f"✓ Employees created: {len(employees):,} records")
    
    def populate_bronze_orders(self):
        """Populate bronze.orders table."""
        if not self.table_is_empty('bronze', 'orders'):
            logger.info("⏭️  bronze.orders already has data; skipping.")
            # Load existing order IDs
            self.cur.execute("SELECT order_id FROM bronze.orders;")
            self.order_ids = [row[0] for row in self.cur.fetchall()]
            return
        
        logger.info("=" * 80)
        logger.info("STEP 15: Populating Bronze Layer - Orders")
        logger.info("=" * 80)
        
        if not self.customer_ids:
            self.cur.execute("SELECT customer_id FROM bronze.customer;")
            self.customer_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.employee_ids:
            self.cur.execute("SELECT employee_id FROM bronze.employment;")
            self.employee_ids = [row[0] for row in self.cur.fetchall()]
        
        orders = []
        start_date = datetime.now().date() - timedelta(days=self.config['days_of_history'])
        order_id = 1
        
        # Generate orders over time
        current_date = start_date
        orders_per_day = self.config['num_orders'] // self.config['days_of_history']
        
        while current_date <= datetime.now().date() and len(orders) < self.config['num_orders']:
            daily_orders = random.randint(int(orders_per_day * 0.8), int(orders_per_day * 1.2))
            daily_orders = min(daily_orders, self.config['num_orders'] - len(orders))
            
            for _ in range(daily_orders):
                order_total = round(random.uniform(50.0, 5000.0), 2)
                orders.append((
                    order_id,
                    random.choice(self.customer_ids),
                    random.choice(self.employee_ids) if self.employee_ids and random.random() > 0.3 else None,
                    current_date,
                    fake.bothify(text='ORD-##########')[:20],
                    random.choice(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
                    order_total,
                    fake.currency_code()[:5],
                    fake.bothify(text='PROMO-#####')[:50] if random.random() > 0.7 else None,
                    'OLTP',
                    datetime.now(),
                    self.batch_id
                ))
                self.order_ids.append(order_id)
                order_id += 1
            
            if len(orders) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.orders 
                    (order_id, customer_id, sales_rep_id, order_date, order_code, order_status,
                     order_total, order_currency, promotion_code, _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, orders)
                self.conn.commit()
                logger.info(f"  Inserted orders: {len(orders):,}/{self.config['num_orders']:,}: {len(orders):,} records")
                orders = []
            
            current_date += timedelta(days=1)
        
        if orders:
            execute_batch(self.cur, """
                INSERT INTO bronze.orders 
                (order_id, customer_id, sales_rep_id, order_date, order_code, order_status,
                 order_total, order_currency, promotion_code, _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, orders)
            self.conn.commit()
        
        logger.info(f"✓ Orders created: {len(self.order_ids):,} records")
    
    def populate_bronze_order_items(self):
        """Populate bronze.order_item table."""
        if not self.table_is_empty('bronze', 'order_item'):
            logger.info("⏭️  bronze.order_item already has data; skipping.")
            return
        
        logger.info("=" * 80)
        logger.info("STEP 16: Populating Bronze Layer - Order Items")
        logger.info("=" * 80)
        
        if not self.order_ids:
            self.cur.execute("SELECT order_id FROM bronze.orders;")
            self.order_ids = [row[0] for row in self.cur.fetchall()]
        
        if not self.product_ids:
            self.cur.execute("SELECT product_id FROM bronze.product;")
            self.product_ids = [row[0] for row in self.cur.fetchall()]
        
        # Get product prices for realistic order items
        self.cur.execute("SELECT product_id, list_price FROM bronze.product;")
        product_prices = {row[0]: float(row[1]) for row in self.cur.fetchall()}
        
        order_items = []
        order_item_id = 1
        
        # Generate items for each order (1-5 items per order)
        for order_id in self.order_ids:
            num_items = random.randint(1, 5)
            for _ in range(num_items):
                product_id = random.choice(self.product_ids)
                unit_price = product_prices.get(product_id, round(random.uniform(10.0, 1000.0), 2))
                quantity = round(random.uniform(1.0, 10.0), 2)
                
                order_items.append((
                    order_item_id,
                    order_id,
                    product_id,
                    unit_price,
                    quantity,
                    'OLTP',
                    datetime.now(),
                    self.batch_id
                ))
                order_item_id += 1
            
            if len(order_items) >= self.config['batch_size']:
                execute_batch(self.cur, """
                    INSERT INTO bronze.order_item 
                    (order_item_id, order_id, product_id, unit_price, quantity,
                     _source_system, _load_timestamp, _batch_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, order_items)
                self.conn.commit()
                logger.info(f"  Inserted order items: {len(order_items):,}: {len(order_items):,} records")
                order_items = []
        
        if order_items:
            execute_batch(self.cur, """
                INSERT INTO bronze.order_item 
                (order_item_id, order_id, product_id, unit_price, quantity,
                 _source_system, _load_timestamp, _batch_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, order_items)
            self.conn.commit()
        
        logger.info(f"✓ Order Items created: {order_item_id - 1:,} records")
    
    def populate_all_bronze(self):
        """Populate all Bronze layer tables (only empty ones)."""
        logger.info("=" * 80)
        logger.info("STEP 1: Populating Bronze Layer")
        logger.info("=" * 80)
        
        try:
            self.populate_bronze_countries()
            self.populate_bronze_locations()
            self.populate_bronze_warehouses()
            self.populate_bronze_products()
            self.populate_bronze_inventory()
            self.populate_bronze_persons()
            self.populate_bronze_restricted_info()
            self.populate_bronze_person_locations()
            self.populate_bronze_phone_numbers()
            self.populate_bronze_customer_companies()
            self.populate_bronze_customer_employees()
            self.populate_bronze_customers()
            self.populate_bronze_employment_jobs()
            self.populate_bronze_employees()
            self.populate_bronze_orders()
            self.populate_bronze_order_items()
            
            logger.info("=" * 80)
            logger.info("Bronze Layer Population Complete!")
            logger.info("=" * 80)
        except Exception as e:
            logger.error(f"Error populating Bronze layer: {e}", exc_info=True)
            raise


def main():
    """Main function to populate the warehouse."""
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("BIG DATA WAREHOUSE POPULATION STARTED")
    logger.info("=" * 80)
    
    logger.info("Configuration:")
    logger.info(f"  num_countries: {50}")
    logger.info(f"  num_locations: {5000:,}")
    logger.info(f"  num_warehouses: {100}")
    logger.info(f"  num_products: {50000:,}")
    logger.info(f"  num_persons: {200000:,}")
    logger.info(f"  num_customers: {150000:,}")
    logger.info(f"  num_employees: {5000}")
    logger.info(f"  num_orders: {5000000:,}")
    logger.info(f"  days_of_history: {730}")
    logger.info(f"  batch_size: {10000:,}")
    logger.info("=" * 80)
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv('POSTGRES_HOST', 'localhost'),
            port=int(os.getenv('POSTGRES_PORT', '5432')),
            database=os.getenv('POSTGRES_DB', 'datawarehouse'),
            user=os.getenv('POSTGRES_USER', 'postgres'),
            password=os.getenv('POSTGRES_PASSWORD', 'postgres')
        )
        
        populator = BigWarehousePopulator(conn)
        populator.populate_all_bronze()
        
        conn.close()
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("POPULATION SUMMARY")
        logger.info("=" * 80)
        logger.info(f"Start Time: {start_time}")
        logger.info(f"End Time: {end_time}")
        logger.info(f"Duration: {duration}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()















