"""
Bronze to Silver Layer Transformer
Transforms raw Bronze data into cleaned Silver layer data.
Updated to work with the actual schema: bronze.country, bronze.customer, bronze.product, bronze.orders, etc.
"""

import psycopg2
from psycopg2.extras import execute_batch
from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta
import logging
import hashlib
import time

logger = logging.getLogger(__name__)


class BronzeToSilverTransformer:
    """Transforms Bronze layer data to Silver layer."""
    
    def __init__(self, connection, tracker=None):
        """Initialize transformer with database connection."""
        self.connection = connection
        self.cursor = connection.cursor()
        self.tracker = tracker
    
    def table_is_empty(self, schema: str, table: str) -> bool:
        """Check if a table is empty."""
        try:
            self.cursor.execute(f"SELECT 1 FROM {schema}.{table} LIMIT 1;")
            return self.cursor.fetchone() is None
        except Exception as e:
            logger.error(f"Error checking if {schema}.{table} is empty: {e}")
            return False
    
    def transform_countries(self, batch_size: int = 1000):
        """Transform bronze.country to silver.country."""
        logger.info("Starting country transformation...")
        
        # Get countries from bronze that haven't been processed
        select_query = """
            SELECT b.country_id, b.country_name, b.country_code, b.nat_lang_code, b.currency_code
            FROM bronze.country b
            LEFT JOIN silver.country s ON b.country_id = s.country_id
            WHERE s.country_id IS NULL
            ORDER BY b.country_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_countries = self.cursor.fetchall()
        
        if not bronze_countries:
            logger.info("No new countries to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_countries)} countries...")
        
        insert_query = """
            INSERT INTO silver.country 
            (country_id, country_name, country_code, national_language_code, currency_code,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (country_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_countries:
            transformed.append((
                row[0],  # country_id
                row[1] or 'Unknown',  # country_name
                (row[2] or 'XXX')[:3],  # country_code
                row[3],  # nat_lang_code
                (row[4] or 'USD')[:10],  # currency_code
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} countries")
        return len(transformed)
    
    def transform_locations(self, batch_size: int = 1000):
        """Transform bronze.location to silver.location."""
        logger.info("Starting location transformation...")
        
        # Get locations from bronze that haven't been processed
        select_query = """
            SELECT l.location_id, l.country_id, l.address_line_1, l.address_line_2,
                   l.city, l.state, l.district, l.postal_code, l.location_type_code,
                   l.description, l.shipping_notes
            FROM bronze.location l
            LEFT JOIN silver.location s ON l.location_id = s.location_id
            WHERE s.location_id IS NULL
            ORDER BY l.location_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_locations = self.cursor.fetchall()
        
        if not bronze_locations:
            logger.info("No new locations to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_locations)} locations...")
        
        # Get country keys
        self.cursor.execute("SELECT country_id, country_key FROM silver.country;")
        country_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.location 
            (location_id, country_key, address_line_1, address_line_2, city, state_province,
             district, postal_code, location_type, description, shipping_notes, full_address,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (location_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_locations:
            country_key = country_map.get(row[1])  # country_id -> country_key
            
            # Build full address
            address_parts = [p for p in [row[2], row[3], row[4], row[5], row[7]] if p]
            full_address = ', '.join(address_parts) if address_parts else None
            
            transformed.append((
                row[0],  # location_id
                country_key,  # country_key
                row[2],  # address_line_1
                row[3],  # address_line_2
                row[4],  # city
                row[5],  # state_province
                row[6],  # district
                row[7],  # postal_code
                f"TYPE_{row[8]}" if row[8] else None,  # location_type
                row[9],  # description
                row[10],  # shipping_notes
                full_address,  # full_address
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} locations")
        return len(transformed)
    
    def transform_warehouses(self, batch_size: int = 1000):
        """Transform bronze.warehouse to silver.warehouse."""
        logger.info("Starting warehouse transformation...")
        
        select_query = """
            SELECT w.warehouse_id, w.location_id, w.warehouse_name
            FROM bronze.warehouse w
            LEFT JOIN silver.warehouse s ON w.warehouse_id = s.warehouse_id
            WHERE s.warehouse_id IS NULL
            ORDER BY w.warehouse_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_warehouses = self.cursor.fetchall()
        
        if not bronze_warehouses:
            logger.info("No new warehouses to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_warehouses)} warehouses...")
        
        # Get location keys
        self.cursor.execute("SELECT location_id, location_key FROM silver.location;")
        location_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.warehouse 
            (warehouse_id, location_key, warehouse_name, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (warehouse_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_warehouses:
            location_key = location_map.get(row[1])  # location_id -> location_key
            
            transformed.append((
                row[0],  # warehouse_id
                location_key,  # location_key
                row[2] or 'Unknown Warehouse',  # warehouse_name
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} warehouses")
        return len(transformed)
    
    def transform_products(self, batch_size: int = 1000):
        """Transform bronze.product to silver.product."""
        logger.info("Starting product transformation...")
        
        select_query = """
            SELECT b.product_id, b.product_name, b.description, b.category, b.weight_class,
                   b.warranty_period, b.supplier_id, b.status, b.list_price, b.minimum_price,
                   b.price_currency, b.catalog_url
            FROM bronze.product b
            LEFT JOIN silver.product s ON b.product_id = s.product_id
            WHERE s.product_id IS NULL
            ORDER BY b.product_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_products = self.cursor.fetchall()
        
        if not bronze_products:
            logger.info("No new products to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_products)} products...")
        
        insert_query = """
            INSERT INTO silver.product 
            (product_id, product_name, description, category_id, category_name,
             weight_class, weight_class_description, warranty_period_months, supplier_id,
             product_status, list_price, minimum_price, price_currency, catalog_url,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (product_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_products:
            weight_classes = {1: 'Light', 2: 'Medium', 3: 'Heavy', 4: 'Very Heavy', 5: 'Extra Heavy'}
            
            transformed.append((
                row[0],  # product_id
                row[1] or 'Unknown Product',  # product_name
                row[2],  # description
                row[3],  # category_id
                f"Category_{row[3]}" if row[3] else None,  # category_name
                row[4],  # weight_class
                weight_classes.get(row[4], 'Unknown') if row[4] else None,  # weight_class_description
                row[5],  # warranty_period_months
                row[6],  # supplier_id
                row[7] or 'ACTIVE',  # product_status
                row[8] or 0.0,  # list_price
                row[9] or 0.0,  # minimum_price
                (row[10] or 'USD')[:3],  # price_currency
                row[11],  # catalog_url
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} products")
        return len(transformed)
    
    def transform_inventory(self, batch_size: int = 1000):
        """Transform bronze.inventory to silver.inventory."""
        logger.info("Starting inventory transformation...")
        
        select_query = """
            SELECT i.inventory_id, i.product_id, i.warehouse_id, i.quantity_on_hand, i.quantity_available
            FROM bronze.inventory i
            LEFT JOIN silver.inventory s ON i.inventory_id = s.inventory_id
            WHERE s.inventory_id IS NULL
            ORDER BY i.inventory_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_inventory = self.cursor.fetchall()
        
        if not bronze_inventory:
            logger.info("No new inventory to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_inventory)} inventory records...")
        
        # Get product keys
        self.cursor.execute("SELECT product_id, product_key FROM silver.product;")
        product_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get warehouse keys
        self.cursor.execute("SELECT warehouse_id, warehouse_key FROM silver.warehouse;")
        warehouse_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.inventory 
            (inventory_id, product_key, warehouse_key, quantity_on_hand, quantity_available,
             last_stock_date, is_valid, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (inventory_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_inventory:
            product_key = product_map.get(row[1])  # product_id -> product_key
            warehouse_key = warehouse_map.get(row[2])  # warehouse_id -> warehouse_key
            
            # Skip if required foreign keys are missing
            if not product_key or not warehouse_key:
                continue
            
            transformed.append((
                row[0],  # inventory_id
                product_key,  # product_key
                warehouse_key,  # warehouse_key
                row[3] or 0,  # quantity_on_hand
                row[4] or 0,  # quantity_available
                datetime.now().date(),  # last_stock_date
                True,  # is_valid
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} inventory records")
        return len(transformed)
    
    def transform_persons(self, batch_size: int = 1000):
        """Transform bronze.person to silver.person."""
        logger.info("Starting person transformation...")
        
        select_query = """
            SELECT b.person_id, b.first_name, b.last_name, b.middle_names, b.nickname,
                   b.nat_lang_code, b.culture_code, b.gender
            FROM bronze.person b
            LEFT JOIN silver.person s ON b.person_id = s.person_id
            WHERE s.person_id IS NULL
            ORDER BY b.person_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_persons = self.cursor.fetchall()
        
        if not bronze_persons:
            logger.info("No new persons to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_persons)} persons...")
        
        insert_query = """
            INSERT INTO silver.person 
            (person_id, first_name, last_name, middle_names, nickname, full_name, display_name,
             national_language_code, culture_code, gender, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (person_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_persons:
            first_name = row[1] or ''
            last_name = row[2] or ''
            middle_names = row[3] or ''
            nickname = row[4] or ''
            
            # Build full name
            name_parts = [p for p in [first_name, middle_names, last_name] if p]
            full_name = ' '.join(name_parts) if name_parts else 'Unknown'
            
            # Display name (prefer nickname if available)
            display_name = nickname if nickname else full_name
            
            transformed.append((
                row[0],  # person_id
                first_name,  # first_name
                last_name,  # last_name
                middle_names if middle_names else None,  # middle_names
                nickname if nickname else None,  # nickname
                full_name,  # full_name
                display_name,  # display_name
                row[5],  # national_language_code
                row[6],  # culture_code
                row[7],  # gender
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} persons")
        return len(transformed)
    
    def transform_restricted_info(self, batch_size: int = 1000):
        """Transform bronze.restricted_info to silver.restricted_info."""
        logger.info("Starting restricted info transformation...")
        
        # Fix: Join with silver.person to get person_key, then check if it exists in silver.restricted_info
        select_query = """
            SELECT r.person_id, r.date_of_birth, r.date_of_death, r.government_id, r.passport_id,
                   r.hire_date, r.seniority_code, p.person_key
            FROM bronze.restricted_info r
            INNER JOIN silver.person p ON r.person_id = p.person_id
            LEFT JOIN silver.restricted_info s ON p.person_key = s.person_key
            WHERE s.person_key IS NULL
            ORDER BY r.person_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_restricted = self.cursor.fetchall()
        
        if not bronze_restricted:
            logger.info("No new restricted info to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_restricted)} restricted info records...")
        
        insert_query = """
            INSERT INTO silver.restricted_info 
            (person_key, date_of_birth, date_of_death, age, government_id_hash, passport_id_hash,
             hire_date, years_of_service, seniority_code, seniority_level, is_valid, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (person_key) DO NOTHING
        """
        
        transformed = []
        for row in bronze_restricted:
            # person_key is now in row[7] (8th column) from the JOIN
            person_key = row[7]
            
            # Skip if required foreign key is missing (shouldn't happen with INNER JOIN, but check anyway)
            if not person_key:
                continue
            
            date_of_birth = row[1]
            date_of_death = row[2]
            hire_date = row[5]
            
            # Calculate age
            age = None
            if date_of_birth:
                if date_of_death:
                    age = (date_of_death - date_of_birth).days // 365
                else:
                    age = (datetime.now().date() - date_of_birth).days // 365
            
            # Hash sensitive information
            government_id_hash = hashlib.sha256(str(row[3] or '').encode()).digest() if row[3] else None
            passport_id_hash = hashlib.sha256(str(row[4] or '').encode()).digest() if row[4] else None
            
            # Calculate years of service
            years_of_service = None
            if hire_date:
                years_of_service = (datetime.now().date() - hire_date).days // 365
            
            # Determine seniority level
            seniority_code = row[6]  # row[6] is seniority_code
            seniority_levels = {1: 'JUNIOR', 2: 'MID', 3: 'SENIOR', 4: 'LEAD', 5: 'EXECUTIVE'}
            seniority_level = seniority_levels.get(seniority_code, 'UNKNOWN') if seniority_code else None
            
            transformed.append((
                person_key,  # person_key (from JOIN, row[7])
                row[1],  # date_of_birth
                row[2],  # date_of_death
                age,  # age
                government_id_hash,  # government_id_hash
                passport_id_hash,  # passport_id_hash
                row[5],  # hire_date
                years_of_service,  # years_of_service
                row[6],  # seniority_code
                seniority_level,  # seniority_level
                True,  # is_valid
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} restricted info records")
        return len(transformed)
    
    def transform_person_locations(self, batch_size: int = 1000):
        """Transform bronze.person_location to silver.person_location."""
        logger.info("Starting person location transformation...")
        
        select_query = """
            SELECT pl.persons_person_id, pl.locations_location_id, pl.sub_address,
                   pl.location_usage, pl.notes
            FROM bronze.person_location pl
            LEFT JOIN silver.person_location s ON pl.persons_person_id = s.person_key 
                AND pl.locations_location_id = s.location_key
            WHERE s.person_location_key IS NULL
            ORDER BY pl.persons_person_id, pl.locations_location_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_person_locs = self.cursor.fetchall()
        
        if not bronze_person_locs:
            logger.info("No new person locations to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_person_locs)} person location records...")
        
        # Get person keys
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get location keys
        self.cursor.execute("SELECT location_id, location_key FROM silver.location;")
        location_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.person_location 
            (person_key, location_key, sub_address, location_usage, location_usage_type,
             notes, is_primary, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """
        
        transformed = []
        for row in bronze_person_locs:
            person_key = person_map.get(row[0])  # persons_person_id -> person_key
            location_key = location_map.get(row[1])  # locations_location_id -> location_key
            
            # Skip if required foreign keys are missing
            if not person_key or not location_key:
                continue
            
            # Determine location usage type
            usage = (row[3] or '').upper()
            if 'HOME' in usage:
                usage_type = 'HOME'
            elif 'WORK' in usage or 'OFFICE' in usage:
                usage_type = 'WORK'
            elif 'SHIPPING' in usage or 'SHIP' in usage:
                usage_type = 'SHIPPING'
            elif 'BILLING' in usage or 'BILL' in usage:
                usage_type = 'BILLING'
            else:
                usage_type = 'OTHER'
            
            transformed.append((
                person_key,  # person_key
                location_key,  # location_key
                row[2],  # sub_address
                row[3],  # location_usage
                usage_type,  # location_usage_type
                row[4],  # notes
                False,  # is_primary (default)
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} person location records")
        return len(transformed)
    
    def transform_phone_numbers(self, batch_size: int = 1000):
        """Transform bronze.phone_number to silver.phone_number."""
        logger.info("Starting phone number transformation...")
        
        select_query = """
            SELECT pn.phone_number_id, pn.persons_person_id, pn.locations_location_id,
                   pn.phone_number, pn.country_code, pn.phone_type_id
            FROM bronze.phone_number pn
            LEFT JOIN silver.phone_number s ON pn.phone_number_id = s.phone_id
            WHERE s.phone_id IS NULL
            ORDER BY pn.phone_number_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_phones = self.cursor.fetchall()
        
        if not bronze_phones:
            logger.info("No new phone numbers to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_phones)} phone number records...")
        
        # Get person keys
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get location keys
        self.cursor.execute("SELECT location_id, location_key FROM silver.location;")
        location_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.phone_number 
            (phone_id, person_key, location_key, phone_number, country_code, full_phone_number,
             phone_type, is_primary, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (phone_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_phones:
            person_key = person_map.get(row[1]) if row[1] else None  # persons_person_id -> person_key (optional)
            location_key = location_map.get(row[2]) if row[2] else None  # locations_location_id -> location_key (optional)
            
            # Build full phone number
            country_code = row[4] or ''
            phone_num = row[3] or ''
            full_phone = f"{country_code} {phone_num}".strip() if country_code or phone_num else None
            
            # Determine phone type
            phone_type_id = row[5]
            phone_types = {1: 'MOBILE', 2: 'HOME', 3: 'WORK', 4: 'FAX', 5: 'OTHER'}
            phone_type = phone_types.get(phone_type_id, 'OTHER') if phone_type_id else 'MOBILE'
            
            transformed.append((
                row[0],  # phone_id
                person_key,  # person_key (can be null)
                location_key,  # location_key (can be null)
                phone_num,  # phone_number
                country_code,  # country_code
                full_phone,  # full_phone_number
                phone_type,  # phone_type
                False,  # is_primary (default)
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} phone number records")
        return len(transformed)
    
    def transform_customer_companies(self, batch_size: int = 1000):
        """Transform bronze.customer_company to silver.customer_company."""
        logger.info("Starting customer company transformation...")
        
        select_query = """
            SELECT b.company_id, b.company_name, b.company_credit_limit, b.credit_limit_currency
            FROM bronze.customer_company b
            LEFT JOIN silver.customer_company s ON b.company_id = s.company_id
            WHERE s.company_id IS NULL
            ORDER BY b.company_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_companies = self.cursor.fetchall()
        
        if not bronze_companies:
            logger.info("No new customer companies to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_companies)} customer companies...")
        
        insert_query = """
            INSERT INTO silver.customer_company 
            (company_id, company_name, credit_limit, credit_limit_currency, credit_tier,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (company_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_companies:
            credit_limit = row[2] or 0.0
            # Determine credit tier
            if credit_limit >= 1000000:
                credit_tier = 'PLATINUM'
            elif credit_limit >= 500000:
                credit_tier = 'GOLD'
            elif credit_limit >= 100000:
                credit_tier = 'SILVER'
            else:
                credit_tier = 'BRONZE'
            
            transformed.append((
                row[0],  # company_id
                row[1] or 'Unknown Company',  # company_name
                credit_limit,  # credit_limit
                (row[3] or 'USD')[:3],  # credit_limit_currency
                credit_tier,  # credit_tier
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} customer companies")
        return len(transformed)
    
    def transform_customer_employees(self, batch_size: int = 1000):
        """Transform bronze.customer_employee to silver.customer_employee."""
        logger.info("Starting customer employee transformation...")
        
        select_query = """
            SELECT ce.customer_employee_id, ce.company_id, ce.badge_number, ce.job_title,
                   ce.department, ce.credit_limit, ce.credit_limit_currency
            FROM bronze.customer_employee ce
            LEFT JOIN silver.customer_employee s ON ce.customer_employee_id = s.customer_employee_id
            WHERE s.customer_employee_id IS NULL
            ORDER BY ce.customer_employee_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_employees = self.cursor.fetchall()
        
        if not bronze_employees:
            logger.info("No new customer employees to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_employees)} customer employees...")
        
        # Get company keys
        self.cursor.execute("SELECT company_id, company_key FROM silver.customer_company;")
        company_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.customer_employee 
            (customer_employee_id, company_key, badge_number, job_title, department,
             credit_limit, credit_limit_currency, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (customer_employee_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_employees:
            company_key = company_map.get(row[1])  # company_id -> company_key
            
            transformed.append((
                row[0],  # customer_employee_id
                company_key,  # company_key
                row[2],  # badge_number
                row[3],  # job_title
                row[4],  # department
                row[5] or 0.0,  # credit_limit
                (row[6] or 'USD')[:3],  # credit_limit_currency
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} customer employees")
        return len(transformed)
    
    def transform_employment_jobs(self, batch_size: int = 1000):
        """Transform bronze.employment_jobs to silver.employment_jobs."""
        logger.info("Starting employment jobs transformation...")
        
        select_query = """
            SELECT ej.hr_job_id, ej.countries_country_id, ej.job_title, ej.min_salary, ej.max_salary
            FROM bronze.employment_jobs ej
            LEFT JOIN silver.employment_jobs s ON ej.hr_job_id = s.hr_job_id
            WHERE s.hr_job_id IS NULL
            ORDER BY ej.hr_job_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_jobs = self.cursor.fetchall()
        
        if not bronze_jobs:
            logger.info("No new employment jobs to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_jobs)} employment jobs...")
        
        # Get country keys
        self.cursor.execute("SELECT country_id, country_key FROM silver.country;")
        country_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.employment_jobs 
            (hr_job_id, country_key, job_title, min_salary, max_salary,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (hr_job_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_jobs:
            country_key = country_map.get(row[1])  # country_id -> country_key
            
            transformed.append((
                row[0],  # hr_job_id
                country_key,  # country_key
                row[2] or 'Unknown Job',  # job_title
                row[3] or 0.0,  # min_salary
                row[4] or 0.0,  # max_salary
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} employment jobs")
        return len(transformed)
    
    def transform_employees(self, batch_size: int = 1000):
        """Transform bronze.employment to silver.employee."""
        logger.info("Starting employee transformation...")
        
        select_query = """
            SELECT e.employee_id, e.person_id, e.hr_job_id, e.manager_employee_id,
                   e.start_date, e.end_date, e.salary, e.commission_percent, e.employment_status
            FROM bronze.employment e
            LEFT JOIN silver.employee s ON e.employee_id = s.employee_id
            WHERE s.employee_id IS NULL
            ORDER BY e.employee_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_employees = self.cursor.fetchall()
        
        if not bronze_employees:
            logger.info("No new employees to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_employees)} employees...")
        
        # Get person keys
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get job keys
        self.cursor.execute("SELECT hr_job_id, job_key FROM silver.employment_jobs;")
        job_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get manager employee keys (for self-reference)
        self.cursor.execute("SELECT employee_id, employee_key FROM silver.employee;")
        manager_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.employee 
            (employee_id, person_key, job_key, manager_employee_key, start_date, end_date,
             tenure_days, tenure_years, is_active, salary, commission_percent, employment_status,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (employee_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_employees:
            person_key = person_map.get(row[1])  # person_id -> person_key
            job_key = job_map.get(row[2])  # hr_job_id -> job_key
            manager_key = manager_map.get(row[3]) if row[3] else None  # manager_employee_id -> key
            
            # Skip if required foreign keys are missing
            if not person_key or not job_key:
                continue
            
            start_date = row[4]
            end_date = row[5]
            
            # Calculate tenure
            if start_date:
                if end_date:
                    tenure_days = (end_date - start_date).days
                else:
                    tenure_days = (datetime.now().date() - start_date).days
                tenure_years = tenure_days // 365
            else:
                tenure_days = 0
                tenure_years = 0
            
            # Determine if active
            is_active = (end_date is None or end_date > datetime.now().date())
            
            transformed.append((
                row[0],  # employee_id
                person_key,  # person_key
                job_key,  # job_key
                manager_key,  # manager_employee_key
                start_date,  # start_date
                end_date,  # end_date
                tenure_days,  # tenure_days
                tenure_years,  # tenure_years
                is_active,  # is_active
                row[6] or 0.0,  # salary
                row[7],  # commission_percent
                (row[8] or 'ACTIVE').upper(),  # employment_status
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} employees")
        return len(transformed)
    
    def transform_customers(self, batch_size: int = 1000):
        """Transform bronze.customer to silver.customer."""
        logger.info("Starting customer transformation...")
        
        select_query = """
            SELECT c.customer_id, c.person_id, c.customer_employee_id, c.accountmgr_id, c.income_level
            FROM bronze.customer c
            LEFT JOIN silver.customer s ON c.customer_id = s.customer_id
            WHERE s.customer_id IS NULL
            ORDER BY c.customer_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_customers = self.cursor.fetchall()
        
        if not bronze_customers:
            logger.info("No new customers to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_customers)} customers...")
        
        # Get person keys
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get customer employee keys
        self.cursor.execute("SELECT customer_employee_id, customer_employee_key FROM silver.customer_employee;")
        employee_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.customer 
            (customer_id, person_key, customer_employee_key, account_manager_id, income_level,
             income_bracket, customer_type, customer_since, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (customer_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_customers:
            person_key = person_map.get(row[1])  # person_id -> person_key
            
            # Skip if required foreign key is missing
            if not person_key:
                continue
            
            customer_employee_key = employee_map.get(row[2]) if row[2] else None  # customer_employee_id -> key
            
            # Determine income bracket
            income_level = row[4] or 0
            if income_level >= 8:
                income_bracket = 'PREMIUM'
            elif income_level >= 5:
                income_bracket = 'HIGH'
            elif income_level >= 3:
                income_bracket = 'MEDIUM'
            else:
                income_bracket = 'LOW'
            
            # Determine customer type
            customer_type = 'CORPORATE' if row[2] else 'INDIVIDUAL'
            
            transformed.append((
                row[0],  # customer_id
                person_key,  # person_key
                customer_employee_key,  # customer_employee_key
                row[3],  # account_manager_id
                income_level,  # income_level
                income_bracket,  # income_bracket
                customer_type,  # customer_type
                datetime.now().date(),  # customer_since (use current date as approximation)
                True,  # is_valid
                datetime.now(),  # valid_from
                date(9999, 12, 31),  # valid_to
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} customers")
        return len(transformed)
    
    def transform_orders(self, batch_size: int = 1000):
        """Transform bronze.orders to silver.orders."""
        logger.info("Starting order transformation...")
        
        select_query = """
            SELECT o.order_id, o.customer_id, o.sales_rep_id, o.order_date, o.order_code,
                   o.order_status, o.order_total, o.order_currency, o.promotion_code
            FROM bronze.orders o
            LEFT JOIN silver.orders s ON o.order_id = s.order_id
            WHERE s.order_id IS NULL
            ORDER BY o.order_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_orders = self.cursor.fetchall()
        
        if not bronze_orders:
            logger.info("No new orders to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_orders)} orders...")
        
        # Get customer keys
        self.cursor.execute("SELECT customer_id, customer_key FROM silver.customer;")
        customer_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get employee keys (for sales_rep)
        self.cursor.execute("SELECT employee_id, employee_key FROM silver.employee;")
        employee_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.orders 
            (order_id, customer_key, sales_rep_key, order_date, order_code, order_status,
             order_status_category, order_total, order_currency, promotion_code,
             is_valid, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (order_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_orders:
            customer_key = customer_map.get(row[1])  # customer_id -> customer_key
            
            # Skip if required foreign key is missing
            if not customer_key:
                continue
            
            sales_rep_key = employee_map.get(row[2]) if row[2] else None  # sales_rep_id -> employee_key
            
            # Categorize order status
            status = (row[5] or 'PENDING').upper()
            if status in ['PENDING', 'PROCESSING']:
                status_category = 'PROCESSING'
            elif status in ['SHIPPED', 'DELIVERED', 'COMPLETED']:
                status_category = 'COMPLETED'
            elif status in ['CANCELLED', 'CANCELED']:
                status_category = 'CANCELLED'
            else:
                status_category = 'PENDING'
            
            transformed.append((
                row[0],  # order_id
                customer_key,  # customer_key
                sales_rep_key,  # sales_rep_key
                row[3],  # order_date
                row[4],  # order_code
                status,  # order_status
                status_category,  # order_status_category
                row[6] or 0.0,  # order_total
                (row[7] or 'USD')[:3],  # order_currency
                row[8],  # promotion_code
                True,  # is_valid
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} orders")
        return len(transformed)
    
    def transform_order_items(self, batch_size: int = 1000):
        """Transform bronze.order_item to silver.order_item."""
        logger.info("Starting order item transformation...")
        
        select_query = """
            SELECT oi.order_item_id, oi.order_id, oi.product_id, oi.unit_price, oi.quantity
            FROM bronze.order_item oi
            LEFT JOIN silver.order_item s ON oi.order_item_id = s.order_item_id
            WHERE s.order_item_id IS NULL
            ORDER BY oi.order_item_id
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        bronze_items = self.cursor.fetchall()
        
        if not bronze_items:
            logger.info("No new order items to transform")
            return 0
        
        logger.info(f"Transforming {len(bronze_items)} order items...")
        
        # Get order keys
        self.cursor.execute("SELECT order_id, order_key FROM silver.orders;")
        order_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get product keys
        self.cursor.execute("SELECT product_id, product_key FROM silver.product;")
        product_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        insert_query = """
            INSERT INTO silver.order_item 
            (order_item_id, order_key, product_key, unit_price, quantity, discount_amount,
             is_valid, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (order_item_id) DO NOTHING
        """
        
        transformed = []
        for row in bronze_items:
            order_key = order_map.get(row[1])  # order_id -> order_key
            product_key = product_map.get(row[2])  # product_id -> product_key
            
            if not order_key or not product_key:
                continue  # Skip if foreign keys are missing
            
            transformed.append((
                row[0],  # order_item_id
                order_key,  # order_key
                product_key,  # product_key
                row[3] or 0.0,  # unit_price
                row[4] or 0.0,  # quantity
                0.0,  # discount_amount (default)
                True,  # is_valid
                datetime.now()  # _etl_timestamp
            ))
        
        execute_batch(self.cursor, insert_query, transformed)
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} order items")
        return len(transformed)
    
    def transform_all(self, batch_size: int = 1000):
        """Transform all Bronze tables to Silver tables."""
        logger.info("=" * 80)
        logger.info("BRONZE TO SILVER TRANSFORMATION - STARTING")
        logger.info("=" * 80)
        logger.info(f"Batch Size: {batch_size:,}")
        logger.info("")
        
        totals = {}
        transformation_order = [
            ('countries', self.transform_countries, 'country'),
            ('locations', self.transform_locations, 'location'),
            ('warehouses', self.transform_warehouses, 'warehouse'),
            ('products', self.transform_products, 'product'),
            ('inventory', self.transform_inventory, 'inventory'),
            ('persons', self.transform_persons, 'person'),
            ('restricted_info', self.transform_restricted_info, 'restricted_info'),
            ('person_locations', self.transform_person_locations, 'person_location'),
            ('phone_numbers', self.transform_phone_numbers, 'phone_number'),
            ('customer_companies', self.transform_customer_companies, 'customer_company'),
            ('customer_employees', self.transform_customer_employees, 'customer_employee'),
            ('employment_jobs', self.transform_employment_jobs, 'employment_job'),
            ('employees', self.transform_employees, 'employee'),
            ('customers', self.transform_customers, 'customer'),
            ('orders', self.transform_orders, 'orders'),
            ('order_items', self.transform_order_items, 'order_item'),
        ]
        
        total_steps = len(transformation_order)
        
        for step_num, (name, transform_func, table_name) in enumerate(transformation_order, 1):
            step_start = time.time()
            logger.info("")
            logger.info("-" * 80)
            logger.info(f"STEP {step_num}/{total_steps}: Transforming {name.upper().replace('_', ' ')}")
            logger.info(f"Table: bronze.{table_name} → silver.{table_name}")
            logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info("-" * 80)
            
            # Get before count
            try:
                self.cursor.execute(f"SELECT COUNT(*) FROM bronze.{table_name};")
                bronze_count = self.cursor.fetchone()[0]
                self.cursor.execute(f"SELECT COUNT(*) FROM silver.{table_name};")
                silver_before = self.cursor.fetchone()[0]
            except:
                bronze_count = 0
                silver_before = 0
            
            logger.info(f"Bronze records available: {bronze_count:,}")
            logger.info(f"Silver records before: {silver_before:,}")
            logger.info(f"Records to transform: {bronze_count - silver_before:,}")
            logger.info("")
            
            # Start job tracking
            job_id = None
            if self.tracker:
                job_name = f"SILVER - {name.replace('_', ' ').title()} Transformation"
                job_id = self.tracker.start_job(
                    job_name,
                    "transformation",
                    "silver",
                    table_name,
                    bronze_count - silver_before
                )
                self.tracker.update_progress(job_id, 0)
            
            # Transform in batches
            batch_num = 0
            step_total = 0
            records_to_process = bronze_count - silver_before
            
            while True:
                batch_start = time.time()
                count = transform_func(batch_size)
                batch_elapsed = time.time() - batch_start
                
                if count == 0:
                    break
                
                batch_num += 1
                step_total += count
                
                # Update progress
                if self.tracker and job_id and records_to_process > 0:
                    progress = min(95, int((step_total / records_to_process) * 100))
                    self.tracker.update_progress(job_id, progress, step_total)
                
                logger.info(f"  Batch {batch_num}: Transformed {count:,} records in {batch_elapsed:.2f}s "
                          f"({count/batch_elapsed:.0f} records/sec)")
            
            # Get after count
            try:
                self.cursor.execute(f"SELECT COUNT(*) FROM silver.{table_name};")
                silver_after = self.cursor.fetchone()[0]
            except:
                silver_after = silver_before
            
            step_elapsed = time.time() - step_start
            totals[name] = step_total
            
            # Complete job tracking
            if self.tracker and job_id:
                self.tracker.update_progress(job_id, 100, step_total)
                self.tracker.complete_job(job_id, step_total)
            
            logger.info("")
            logger.info(f"✓ {name.replace('_', ' ').title()} Transformation Complete")
            logger.info(f"  Records transformed: {step_total:,}")
            logger.info(f"  Silver records after: {silver_after:,}")
            logger.info(f"  Time taken: {step_elapsed:.2f}s ({step_elapsed/60:.2f} min)")
            if step_total > 0:
                logger.info(f"  Average speed: {step_total/step_elapsed:.0f} records/sec")
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("BRONZE TO SILVER TRANSFORMATION COMPLETE!")
        logger.info("=" * 80)
        logger.info("Final Summary:")
        for key, value in sorted(totals.items()):
            logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
        logger.info("=" * 80)
        
        return totals
