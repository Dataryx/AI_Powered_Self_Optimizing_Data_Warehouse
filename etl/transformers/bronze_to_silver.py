"""Bronze -> Silver transformer. Moves and cleans raw data into the Silver layer."""

import psycopg2
from psycopg2.extras import execute_batch
from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta
import logging
import hashlib
import time

logger = logging.getLogger(__name__)

from etl.transformers.incremental_pending import fetch_pending_count

# Silver table name -> Bronze table name (when they differ)
BRONZE_TABLE_FOR_SILVER = {
    "employee": "employment",  # silver.employee is populated from bronze.employment
}


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
            FROM (
                SELECT DISTINCT ON (b2.country_id)
                    b2.country_id, b2.country_name, b2.country_code, b2.nat_lang_code, b2.currency_code
                FROM bronze.country b2
                ORDER BY b2.country_id, b2._load_timestamp DESC NULLS LAST
            ) b
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
            FROM (
                SELECT DISTINCT ON (l2.location_id)
                    l2.location_id, l2.country_id, l2.address_line_1, l2.address_line_2,
                    l2.city, l2.state, l2.district, l2.postal_code, l2.location_type_code,
                    l2.description, l2.shipping_notes
                FROM bronze.location l2
                ORDER BY l2.location_id, l2._load_timestamp DESC NULLS LAST
            ) l
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
            FROM (
                SELECT DISTINCT ON (w2.warehouse_id)
                    w2.warehouse_id, w2.location_id, w2.warehouse_name
                FROM bronze.warehouse w2
                ORDER BY w2.warehouse_id, w2._load_timestamp DESC NULLS LAST
            ) w
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
            FROM (
                SELECT DISTINCT ON (b2.product_id)
                    b2.product_id, b2.product_name, b2.description, b2.category, b2.weight_class,
                    b2.warranty_period, b2.supplier_id, b2.status, b2.list_price, b2.minimum_price,
                    b2.price_currency, b2.catalog_url
                FROM bronze.product b2
                ORDER BY b2.product_id, b2._load_timestamp DESC NULLS LAST
            ) b
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
            FROM (
                SELECT DISTINCT ON (i2.inventory_id)
                    i2.inventory_id, i2.product_id, i2.warehouse_id, i2.quantity_on_hand, i2.quantity_available
                FROM bronze.inventory i2
                ORDER BY i2.inventory_id, i2._load_timestamp DESC NULLS LAST
            ) i
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
            FROM (
                SELECT DISTINCT ON (b2.person_id)
                    b2.person_id, b2.first_name, b2.last_name, b2.middle_names, b2.nickname,
                    b2.nat_lang_code, b2.culture_code, b2.gender
                FROM bronze.person b2
                ORDER BY b2.person_id, b2._load_timestamp DESC NULLS LAST
            ) b
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
        
        select_query = """
            SELECT r.person_id, r.date_of_birth, r.date_of_death, r.government_id, r.passport_id,
                   r.hire_date, r.seniority_code, p.person_key
            FROM (
                SELECT DISTINCT ON (r2.person_id)
                    r2.person_id, r2.date_of_birth, r2.date_of_death, r2.government_id, r2.passport_id,
                    r2.hire_date, r2.seniority_code
                FROM bronze.restricted_info r2
                ORDER BY r2.person_id, r2._load_timestamp DESC NULLS LAST
            ) r
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
        
        # Get person keys mapping first
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Get location keys mapping first
        self.cursor.execute("SELECT location_id, location_key FROM silver.location;")
        location_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        
        # Now select bronze records that don't exist in silver
        # Join through person and location tables to get the correct keys for comparison
        select_query = """
            SELECT pl.persons_person_id, pl.locations_location_id, pl.sub_address,
                   pl.location_usage, pl.notes
            FROM (
                SELECT DISTINCT ON (pl2.persons_person_id, pl2.locations_location_id)
                    pl2.persons_person_id, pl2.locations_location_id, pl2.sub_address,
                    pl2.location_usage, pl2.notes
                FROM bronze.person_location pl2
                ORDER BY pl2.persons_person_id, pl2.locations_location_id, pl2._load_timestamp DESC NULLS LAST
            ) pl
            INNER JOIN silver.person p ON pl.persons_person_id = p.person_id
            INNER JOIN silver.location l ON pl.locations_location_id = l.location_id
            LEFT JOIN silver.person_location s ON p.person_key = s.person_key
                AND l.location_key = s.location_key
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
        
        insert_query = """
            INSERT INTO silver.person_location 
            (person_key, location_key, sub_address, location_usage, location_usage_type,
             notes, is_primary, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        transformed = []
        skipped_duplicates = 0
        for row in bronze_person_locs:
            person_key = person_map.get(row[0])  # persons_person_id -> person_key
            location_key = location_map.get(row[1])  # locations_location_id -> location_key
            
            # Skip if required foreign keys are missing
            if not person_key or not location_key:
                continue
            
            # Additional safety check: verify this combination doesn't already exist
            # (This is redundant with ON CONFLICT but provides better logging)
            self.cursor.execute("""
                SELECT 1 FROM silver.person_location 
                WHERE person_key = %s AND location_key = %s
                LIMIT 1
            """, (person_key, location_key))
            if self.cursor.fetchone():
                skipped_duplicates += 1
                continue  # Skip if already exists
            
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
        
        if transformed:
            execute_batch(self.cursor, insert_query, transformed)
            self.connection.commit()
            logger.info(f"Successfully transformed {len(transformed)} person location records")
            if skipped_duplicates > 0:
                logger.info(f"Skipped {skipped_duplicates} duplicate records")
        else:
            logger.info("No new person location records to insert after filtering")
            if skipped_duplicates > 0:
                logger.info(f"All {skipped_duplicates} records were duplicates")
        
        return len(transformed)
    
    def transform_phone_numbers(self, batch_size: int = 1000):
        """Transform bronze.phone_number to silver.phone_number."""
        logger.info("Starting phone number transformation...")
        
        select_query = """
            SELECT pn.phone_number_id, pn.persons_person_id, pn.locations_location_id,
                   pn.phone_number, pn.country_code, pn.phone_type_id
            FROM (
                SELECT DISTINCT ON (pn2.phone_number_id)
                    pn2.phone_number_id, pn2.persons_person_id, pn2.locations_location_id,
                    pn2.phone_number, pn2.country_code, pn2.phone_type_id
                FROM bronze.phone_number pn2
                ORDER BY pn2.phone_number_id, pn2._load_timestamp DESC NULLS LAST
            ) pn
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
            FROM (
                SELECT DISTINCT ON (b2.company_id)
                    b2.company_id, b2.company_name, b2.company_credit_limit, b2.credit_limit_currency
                FROM bronze.customer_company b2
                ORDER BY b2.company_id, b2._load_timestamp DESC NULLS LAST
            ) b
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
            FROM (
                SELECT DISTINCT ON (ce2.customer_employee_id)
                    ce2.customer_employee_id, ce2.company_id, ce2.badge_number, ce2.job_title,
                    ce2.department, ce2.credit_limit, ce2.credit_limit_currency
                FROM bronze.customer_employee ce2
                ORDER BY ce2.customer_employee_id, ce2._load_timestamp DESC NULLS LAST
            ) ce
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
        
        try:
            self.connection.rollback()
        except Exception:
            pass
        
        try:
            self.cursor.execute("SELECT COUNT(*) FROM silver.employment_jobs")
            silver_count = self.cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not check silver.employment_jobs count: {e}")
            silver_count = 0
        
        logger.info(
            "  silver.employment_jobs current count: %s",
            f"{silver_count:,}" if silver_count is not None else "unknown",
        )
        
        select_query = """
            SELECT ej.hr_job_id, ej.countries_country_id, ej.job_title, ej.min_salary, ej.max_salary
            FROM (
                SELECT DISTINCT ON (j.hr_job_id)
                    j.hr_job_id, j.countries_country_id, j.job_title, j.min_salary, j.max_salary
                FROM bronze.employment_jobs j
                ORDER BY j.hr_job_id, j._load_timestamp DESC NULLS LAST
            ) ej
            LEFT JOIN silver.employment_jobs s ON ej.hr_job_id = s.hr_job_id
            WHERE s.hr_job_id IS NULL
            ORDER BY ej.hr_job_id
            LIMIT %s
        """
        
        try:
            self.cursor.execute(select_query, (batch_size,))
            bronze_jobs = self.cursor.fetchall()
        except Exception as e:
            logger.error(f"  [ERROR] Failed to execute SELECT query: {e}")
            self.connection.rollback()
            raise
        
        logger.info(f"  Selected {len(bronze_jobs)} records from bronze for processing")
        
        if not bronze_jobs:
            pending = fetch_pending_count(self.cursor, "employment_jobs")
            if pending is None or pending == 0:
                self.cursor.execute("SELECT COUNT(*) FROM bronze.employment_jobs")
                bronze_total = self.cursor.fetchone()[0]
                self.cursor.execute(
                    "SELECT COUNT(DISTINCT hr_job_id) FROM bronze.employment_jobs WHERE hr_job_id IS NOT NULL"
                )
                bronze_distinct = self.cursor.fetchone()[0]
                if bronze_total > 0:
                    logger.info(
                        "  No new hr_job_id to load (%s bronze rows, %s distinct hr_job_id; all in silver).",
                        f"{bronze_total:,}",
                        f"{bronze_distinct:,}",
                    )
                    if bronze_total != bronze_distinct:
                        logger.info(
                            "  bronze.employment_jobs row count > distinct hr_job_id (duplicate rows in bronze)."
                        )
            elif pending > 0:
                logger.error(
                    "  [ERROR] %s employment_jobs pending by key but SELECT returned 0.",
                    f"{pending:,}",
                )
            logger.info("No new employment jobs to transform")
            return 0
        
        # Log sample of selected records
        if bronze_jobs:
            logger.info(f"  Sample first record: hr_job_id={bronze_jobs[0][0]}, country_id={bronze_jobs[0][1]}")
        
        logger.info(f"Transforming {len(bronze_jobs)} employment jobs...")
        
        # Get country keys
        self.cursor.execute("SELECT country_id, country_key FROM silver.country;")
        country_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(country_map)} countries in silver.country")
        
        # Check for missing country_ids
        unique_country_ids = set(row[1] for row in bronze_jobs if row[1] is not None)
        missing_countries = unique_country_ids - set(country_map.keys())
        if missing_countries:
            logger.warning(f"  [WARN] {len(missing_countries)} country_ids from bronze don't exist in silver.country")
            logger.warning(f"  Missing country_ids: {sorted(list(missing_countries))[:10]}{'...' if len(missing_countries) > 10 else ''}")
        
        insert_query = """
            INSERT INTO silver.employment_jobs 
            (hr_job_id, country_key, job_title, min_salary, max_salary,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (hr_job_id) DO NOTHING
        """
        
        transformed = []
        skipped = 0
        for row in bronze_jobs:
            country_key = country_map.get(row[1])  # country_id -> country_key
            
            # Note: country_key can be None, we still insert the record
            # But log a warning if many are missing
            if not country_key and row[1]:
                skipped += 1
            
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
        
        if skipped > 0:
            logger.warning(f"Note: {skipped} employment jobs have NULL country_key (country may not be populated)")
        
        if transformed:
            try:
                logger.info(f"  Attempting to insert {len(transformed)} employment jobs...")
                execute_batch(self.cursor, insert_query, transformed, page_size=len(transformed))
                rows_inserted = self.cursor.rowcount
                self.connection.commit()
                
                # Verify insertion - ON CONFLICT DO NOTHING returns 0 rowcount even on success
                # So we check the actual table count instead
                self.cursor.execute("SELECT COUNT(*) FROM silver.employment_jobs")
                new_count = self.cursor.fetchone()[0]
                actual_inserted = new_count - silver_count if silver_count is not None else new_count
                
                logger.info(f"  Cursor rowcount: {rows_inserted} (may be 0 due to ON CONFLICT)")
                logger.info(f"  Actual records inserted: {actual_inserted:,}")
                logger.info(f"  Total records in silver.employment_jobs after insert: {new_count:,}")
                
                if actual_inserted == 0 and len(transformed) > 0:
                    logger.error(f"  [ERROR] No rows inserted despite {len(transformed)} records prepared!")
                    logger.error(f"  [ERROR] This may indicate ON CONFLICT is preventing all inserts")
                    # Check if records already exist
                    sample_ids = [row[0] for row in transformed[:5]]
                    self.cursor.execute("""
                        SELECT hr_job_id FROM silver.employment_jobs 
                        WHERE hr_job_id = ANY(%s)
                    """, (sample_ids,))
                    existing = self.cursor.fetchall()
                    if existing:
                        logger.error(f"  [ERROR] Sample IDs already exist in table: {[r[0] for r in existing]}")
                        logger.error(f"  [ERROR] All records may already exist - check if table was not properly truncated")
                    else:
                        logger.error(f"  [ERROR] Records don't exist but weren't inserted - check constraints/errors")
                
                logger.info(f"Successfully transformed {actual_inserted} employment jobs")
                return max(0, actual_inserted)
            except Exception as e:
                self.connection.rollback()
                logger.error(f"[ERROR] Failed to insert employment jobs: {e}")
                logger.error(f"[ERROR] Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                raise
        else:
            if skipped > 0 and len(transformed) == 0:
                logger.error(f"[ERROR] No employment jobs inserted - all records were skipped")
                logger.error(f"[ERROR] Check that silver.country is populated (country_key can be NULL, so this shouldn't block)")
            else:
                logger.warning("[WARN] No employment jobs to insert (all skipped or already exist)")
        
        return len(transformed)
    
    def transform_employees(self, batch_size: int = 1000):
        """Transform bronze.employment to silver.employee."""
        logger.info("Starting employee transformation...")
        
        # Ensure clean transaction state
        try:
            self.connection.rollback()
        except:
            pass
        
        # Check if table is empty first
        try:
            self.cursor.execute("SELECT COUNT(*) FROM silver.employee")
            silver_count = self.cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not check silver.employee count: {e}")
            silver_count = None
        
        logger.info(f"  silver.employee current count: {silver_count if silver_count is not None else 'unknown'}")
        
        if silver_count is None or silver_count == 0:
            logger.info(
                "  Loading deduped bronze.employment (latest row per employee_id by _load_timestamp) "
                "with valid person_id in silver.person"
            )
        else:
            logger.info(f"  Incremental load: new employee_id only (bronze deduped per business key)")
        
        select_query = """
            SELECT e.employee_id, e.person_id, e.hr_job_id, e.manager_employee_id,
                   e.start_date, e.end_date, e.salary, e.commission_percent, e.employment_status
            FROM (
                SELECT DISTINCT ON (e2.employee_id)
                    e2.employee_id, e2.person_id, e2.hr_job_id, e2.manager_employee_id,
                    e2.start_date, e2.end_date, e2.salary, e2.commission_percent, e2.employment_status
                FROM bronze.employment e2
                WHERE e2.person_id IS NOT NULL
                  AND e2.person_id IN (SELECT person_id FROM silver.person)
                ORDER BY e2.employee_id, e2._load_timestamp DESC NULLS LAST
            ) e
            LEFT JOIN silver.employee s ON e.employee_id = s.employee_id
            WHERE s.employee_id IS NULL
            ORDER BY e.employee_id
            LIMIT %s
        """
        
        try:
            self.cursor.execute(select_query, (batch_size,))
            bronze_employees = self.cursor.fetchall()
        except Exception as e:
            logger.error(f"  [ERROR] Failed to execute SELECT query: {e}")
            self.connection.rollback()
            raise
        
        logger.info(f"  Selected {len(bronze_employees)} records from bronze for processing")
        
        if not bronze_employees:
            pending = fetch_pending_count(self.cursor, "employees")
            if pending is None or pending == 0:
                self.cursor.execute("SELECT COUNT(*) FROM bronze.employment")
                bronze_total = self.cursor.fetchone()[0]
                self.cursor.execute(
                    "SELECT COUNT(DISTINCT employee_id) FROM bronze.employment "
                    "WHERE employee_id IS NOT NULL"
                )
                bronze_distinct_ids = self.cursor.fetchone()[0]
                if bronze_total > 0:
                    logger.info(
                        "  No new employee_ids to load (%s bronze rows, %s distinct employee_id; "
                        "all ids already in silver.employee).",
                        f"{bronze_total:,}",
                        f"{bronze_distinct_ids:,}",
                    )
                    if bronze_total != bronze_distinct_ids:
                        logger.info(
                            "  bronze.employment row count > distinct employee_id "
                            "(duplicate employment rows in bronze)."
                        )
            elif pending > 0:
                logger.error(
                    "  [ERROR] %s employees pending by key but SELECT returned 0.",
                    f"{pending:,}",
                )
            logger.info("No new employees to transform")
            return 0
        
        # Log sample of selected records
        if bronze_employees:
            logger.info(f"  Sample first record: employee_id={bronze_employees[0][0]}, person_id={bronze_employees[0][1]}")
        
        logger.info(f"Transforming {len(bronze_employees)} employees...")
        
        # Get person keys - ensure clean transaction
        try:
            self.connection.rollback()
        except:
            pass
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(person_map)} persons in silver.person")
        
        if len(person_map) == 0:
            logger.error("  [ERROR] silver.person is empty - cannot transform employees!")
            logger.error("  [ERROR] Person transformation must complete first")
            return 0
        
        # Check for missing person_ids
        unique_person_ids = set(row[1] for row in bronze_employees if row[1] is not None)
        missing_persons = unique_person_ids - set(person_map.keys())
        if missing_persons:
            logger.warning(f"  [WARN] {len(missing_persons)} person_ids from bronze don't exist in silver.person")
            logger.warning(f"  Missing person_ids (first 10): {sorted(list(missing_persons))[:10]}")
        
        # Get job keys
        self.cursor.execute("SELECT hr_job_id, job_key FROM silver.employment_jobs;")
        job_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(job_map)} employment_jobs in silver.employment_jobs")
        
        # Check for missing hr_job_ids
        unique_job_ids = set(row[2] for row in bronze_employees if row[2] is not None)
        missing_jobs = unique_job_ids - set(job_map.keys())
        if missing_jobs:
            logger.warning(f"  [WARN] {len(missing_jobs)} hr_job_ids from bronze don't exist in silver.employment_jobs")
            logger.warning(f"  Missing hr_job_ids (first 10): {sorted(list(missing_jobs))[:10]}")
        
        # Get manager employee keys (for self-reference)
        self.cursor.execute("SELECT employee_id, employee_key FROM silver.employee;")
        manager_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(manager_map)} existing employees in silver.employee (for manager lookup)")
        
        insert_query = """
            INSERT INTO silver.employee 
            (employee_id, person_key, job_key, manager_employee_key, start_date, end_date,
             tenure_days, tenure_years, is_active, salary, commission_percent, employment_status,
             is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (employee_id) DO NOTHING
        """
        
        transformed = []
        skipped = 0
        skipped_reasons = {'person_key': 0, 'job_key': 0}
        for row in bronze_employees:
            person_key = person_map.get(row[1])  # person_id -> person_key
            job_key = job_map.get(row[2])  # hr_job_id -> job_key
            manager_key = manager_map.get(row[3]) if row[3] else None  # manager_employee_id -> key
            
            # Skip if required foreign keys are missing
            # Note: person_key is NOT NULL in schema, so it's required
            # job_key is nullable, so we allow NULL
            if not person_key:
                skipped += 1
                skipped_reasons['person_key'] += 1
                continue
            # job_key can be NULL, so we don't skip if it's missing
            
            # start_date is NOT NULL in schema - provide default if missing
            start_date = row[4] or datetime.now().date()
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
        
        if skipped > 0:
            logger.warning(f"Skipped {skipped} employees due to missing foreign keys:")
            if skipped_reasons['person_key'] > 0:
                logger.warning(f"  - {skipped_reasons['person_key']} missing person_key")
            if skipped_reasons['job_key'] > 0:
                logger.warning(f"  - {skipped_reasons['job_key']} missing job_key (employment_jobs may be empty)")
        
        if transformed:
            try:
                logger.info(f"  Attempting to insert {len(transformed)} employees...")
                execute_batch(self.cursor, insert_query, transformed, page_size=len(transformed))
                rows_inserted = self.cursor.rowcount
                self.connection.commit()
                
                # Verify insertion - check actual table count
                self.cursor.execute("SELECT COUNT(*) FROM silver.employee")
                new_count = self.cursor.fetchone()[0]
                actual_inserted = new_count - silver_count if silver_count is not None else new_count
                
                logger.info(f"  Cursor rowcount: {rows_inserted} (may be 0 due to ON CONFLICT)")
                logger.info(f"  Actual records inserted: {actual_inserted:,}")
                logger.info(f"  Total records in silver.employee after insert: {new_count:,}")
                
                if actual_inserted == 0 and len(transformed) > 0:
                    logger.error(f"  [ERROR] No rows inserted despite {len(transformed)} records prepared!")
                    logger.error(f"  [ERROR] Check constraints, foreign keys, or if records already exist")
                
                logger.info(f"Successfully transformed {actual_inserted} employees")
                return max(0, actual_inserted)
            except Exception as e:
                self.connection.rollback()
                logger.error(f"[ERROR] Failed to insert employees: {e}")
                logger.error(f"[ERROR] Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                raise
        else:
            if skipped > 0:
                logger.error(f"[ERROR] No employees inserted - all {skipped} records were skipped due to missing person_key")
                logger.error(f"[ERROR] Check that silver.person is populated and person_id values match")
            else:
                logger.warning("[WARN] No employees to insert (all skipped or already exist)")
        
        if skipped > 0:
            logger.warning(f"  Note: {skipped} employees were skipped due to missing person_key (required)")
        return len(transformed)
    
    def transform_customers(self, batch_size: int = 1000):
        """Transform bronze.customer to silver.customer."""
        logger.info("Starting customer transformation...")
        
        # Ensure clean transaction state
        try:
            self.connection.rollback()
        except:
            pass
        
        # Check if table is empty first
        try:
            self.cursor.execute("SELECT COUNT(*) FROM silver.customer")
            silver_count = self.cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not check silver.customer count: {e}")
            silver_count = None
        
        logger.info(f"  silver.customer current count: {silver_count if silver_count is not None else 'unknown'}")
        
        if silver_count is None or silver_count == 0:
            logger.info(
                "  Loading deduped bronze.customer (latest per customer_id) with valid person_id"
            )
        else:
            logger.info(f"  Incremental: new customer_id only (bronze deduped)")
        
        select_query = """
            SELECT c.customer_id, c.person_id, c.customer_employee_id, c.accountmgr_id, c.income_level
            FROM (
                SELECT DISTINCT ON (c2.customer_id)
                    c2.customer_id, c2.person_id, c2.customer_employee_id, c2.accountmgr_id, c2.income_level
                FROM bronze.customer c2
                WHERE c2.person_id IS NOT NULL
                  AND c2.person_id IN (SELECT person_id FROM silver.person)
                ORDER BY c2.customer_id, c2._load_timestamp DESC NULLS LAST
            ) c
            LEFT JOIN silver.customer s ON c.customer_id = s.customer_id
            WHERE s.customer_id IS NULL
            ORDER BY c.customer_id
            LIMIT %s
        """
        
        try:
            self.cursor.execute(select_query, (batch_size,))
            bronze_customers = self.cursor.fetchall()
        except Exception as e:
            logger.error(f"  [ERROR] Failed to execute SELECT query: {e}")
            self.connection.rollback()
            raise
        
        logger.info(f"  Selected {len(bronze_customers)} records from bronze for processing")
        
        if not bronze_customers:
            pending = fetch_pending_count(self.cursor, "customers")
            if pending is None or pending == 0:
                self.cursor.execute("SELECT COUNT(*) FROM bronze.customer")
                bronze_total = self.cursor.fetchone()[0]
                distinct = 0
                try:
                    self.cursor.execute(
                        "SELECT COUNT(DISTINCT customer_id) FROM bronze.customer WHERE customer_id IS NOT NULL"
                    )
                    distinct = self.cursor.fetchone()[0]
                except Exception:
                    pass
                if bronze_total > 0:
                    logger.info(
                        "  No new customer_id to load (%s bronze rows, %s distinct; all in silver).",
                        f"{bronze_total:,}",
                        f"{distinct:,}",
                    )
            elif pending > 0:
                logger.error(
                    "  [ERROR] %s customers pending by key but SELECT returned 0.",
                    f"{pending:,}",
                )
            logger.info("No new customers to transform")
            return 0
        
        # Log sample of selected records
        if bronze_customers:
            logger.info(f"  Sample first record: customer_id={bronze_customers[0][0]}, person_id={bronze_customers[0][1]}")
        
        logger.info(f"Transforming {len(bronze_customers)} customers...")
        
        # Get person keys - ensure clean transaction
        try:
            self.connection.rollback()
        except:
            pass
        self.cursor.execute("SELECT person_id, person_key FROM silver.person;")
        person_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(person_map)} persons in silver.person")
        
        if len(person_map) == 0:
            logger.error("  [ERROR] silver.person is empty - cannot transform customers!")
            logger.error("  [ERROR] Person transformation must complete first")
            return 0
        
        # Check for missing person_ids
        unique_person_ids = set(row[1] for row in bronze_customers if row[1] is not None)
        missing_persons = unique_person_ids - set(person_map.keys())
        if missing_persons:
            logger.warning(f"  [WARN] {len(missing_persons)} person_ids from bronze don't exist in silver.person")
            logger.warning(f"  Missing person_ids (first 10): {sorted(list(missing_persons))[:10]}")
        
        # Get customer employee keys
        self.cursor.execute("SELECT customer_employee_id, customer_employee_key FROM silver.customer_employee;")
        employee_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(employee_map)} customer_employees in silver.customer_employee")
        
        insert_query = """
            INSERT INTO silver.customer 
            (customer_id, person_key, customer_employee_key, account_manager_id, income_level,
             income_bracket, customer_type, customer_since, is_valid, valid_from, valid_to, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (customer_id) DO NOTHING
        """
        
        transformed = []
        skipped = 0
        for row in bronze_customers:
            person_key = person_map.get(row[1])  # person_id -> person_key
            
            # Skip if required foreign key is missing
            if not person_key:
                skipped += 1
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
        
        if skipped > 0:
            logger.warning(f"Skipped {skipped} customers due to missing person_key (person_id: {row[1] if 'row' in locals() else 'N/A'})")
        
        if transformed:
            try:
                logger.info(f"  Attempting to insert {len(transformed)} customers...")
                execute_batch(self.cursor, insert_query, transformed, page_size=len(transformed))
                rows_inserted = self.cursor.rowcount
                self.connection.commit()
                
                # Verify insertion - check actual table count
                self.cursor.execute("SELECT COUNT(*) FROM silver.customer")
                new_count = self.cursor.fetchone()[0]
                actual_inserted = new_count - silver_count if silver_count is not None else new_count
                
                logger.info(f"  Cursor rowcount: {rows_inserted} (may be 0 due to ON CONFLICT)")
                logger.info(f"  Actual records inserted: {actual_inserted:,}")
                logger.info(f"  Total records in silver.customer after insert: {new_count:,}")
                
                if actual_inserted == 0 and len(transformed) > 0:
                    logger.error(f"  [ERROR] No rows inserted despite {len(transformed)} records prepared!")
                    logger.error(f"  [ERROR] Check constraints, foreign keys, or if records already exist")
                
                logger.info(f"Successfully transformed {actual_inserted} customers")
                return max(0, actual_inserted)
            except Exception as e:
                self.connection.rollback()
                logger.error(f"[ERROR] Failed to insert customers: {e}")
                logger.error(f"[ERROR] Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                raise
        else:
            if skipped > 0:
                logger.error(f"[ERROR] No customers inserted - all {skipped} records were skipped due to missing person_key")
                logger.error(f"[ERROR] Check that silver.person is populated and person_id values match")
            else:
                logger.warning("[WARN] No customers to insert (all skipped or already exist)")
        
        if skipped > 0:
            logger.warning(f"  Note: {skipped} customers were skipped due to missing person_key")
        return len(transformed)
    
    def transform_orders(self, batch_size: int = 1000):
        """Transform bronze.orders to silver.orders."""
        logger.info("Starting order transformation...")
        
        # Ensure clean transaction state
        try:
            self.connection.rollback()
        except:
            pass
        
        # Check if table is empty first
        try:
            self.cursor.execute("SELECT COUNT(*) FROM silver.orders")
            silver_count = self.cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not check silver.orders count: {e}")
            silver_count = None
        
        logger.info(f"  silver.orders current count: {silver_count if silver_count is not None else 'unknown'}")
        
        self.cursor.execute("""
            SELECT COUNT(*) FROM bronze.orders o
            WHERE o.customer_id IS NOT NULL
              AND o.customer_id IN (SELECT customer_id FROM silver.customer)
        """)
        orders_matchable = self.cursor.fetchone()[0]
        if orders_matchable == 0:
            self.cursor.execute("SELECT COUNT(*) FROM bronze.orders")
            if self.cursor.fetchone()[0] > 0:
                logger.error(
                    "  [ERROR] bronze.orders has rows but none reference silver.customer — populate customer first."
                )
                return 0
        
        if silver_count is None or silver_count == 0:
            logger.info("  Loading deduped bronze.orders (latest per order_id) with valid customer_id")
        else:
            logger.info(f"  Incremental: new order_id only")
        
        select_query = """
            SELECT o.order_id, o.customer_id, o.sales_rep_id, o.order_date, o.order_code,
                   o.order_status, o.order_total, o.order_currency, o.promotion_code
            FROM (
                SELECT DISTINCT ON (o2.order_id)
                    o2.order_id, o2.customer_id, o2.sales_rep_id, o2.order_date, o2.order_code,
                    o2.order_status, o2.order_total, o2.order_currency, o2.promotion_code
                FROM bronze.orders o2
                WHERE o2.customer_id IS NOT NULL
                  AND o2.customer_id IN (SELECT customer_id FROM silver.customer)
                ORDER BY o2.order_id, o2._load_timestamp DESC NULLS LAST
            ) o
            LEFT JOIN silver.orders s ON o.order_id = s.order_id
            WHERE s.order_id IS NULL
            ORDER BY o.order_id
            LIMIT %s
        """
        
        try:
            self.cursor.execute(select_query, (batch_size,))
            bronze_orders = self.cursor.fetchall()
        except Exception as e:
            logger.error(f"  [ERROR] Failed to execute SELECT query: {e}")
            self.connection.rollback()
            raise
        
        logger.info(f"  Selected {len(bronze_orders)} records from bronze for processing")
        
        if not bronze_orders:
            pending = fetch_pending_count(self.cursor, "orders")
            if pending is None or pending == 0:
                self.cursor.execute("SELECT COUNT(*) FROM bronze.orders")
                bronze_total = self.cursor.fetchone()[0]
                try:
                    self.cursor.execute(
                        "SELECT COUNT(DISTINCT order_id) FROM bronze.orders WHERE order_id IS NOT NULL"
                    )
                    distinct = self.cursor.fetchone()[0]
                except Exception:
                    distinct = 0
                if bronze_total > 0:
                    logger.info(
                        "  No new order_id to load (%s bronze rows, %s distinct order_id; all in silver or missing customer).",
                        f"{bronze_total:,}",
                        f"{distinct:,}",
                    )
            elif pending > 0:
                logger.error(
                    "  [ERROR] %s orders pending by key but SELECT returned 0.",
                    f"{pending:,}",
                )
            logger.info("No new orders to transform")
            return 0
        
        # Log sample of selected records
        if bronze_orders:
            logger.info(f"  Sample first record: order_id={bronze_orders[0][0]}, customer_id={bronze_orders[0][1]}")
        
        logger.info(f"Transforming {len(bronze_orders)} orders...")
        
        # Get customer keys
        self.cursor.execute("SELECT customer_id, customer_key FROM silver.customer;")
        customer_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(customer_map)} customers in silver.customer")
        
        # Check for missing customer_ids
        unique_customer_ids = set(row[1] for row in bronze_orders if row[1] is not None)
        missing_customers = unique_customer_ids - set(customer_map.keys())
        if missing_customers:
            logger.warning(f"  [WARN] {len(missing_customers)} customer_ids from bronze don't exist in silver.customer")
            logger.warning(f"  Missing customer_ids (first 10): {sorted(list(missing_customers))[:10]}")
        
        # Get employee keys (for sales_rep)
        self.cursor.execute("SELECT employee_id, employee_key FROM silver.employee;")
        employee_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(employee_map)} employees in silver.employee (for sales_rep lookup)")
        
        insert_query = """
            INSERT INTO silver.orders 
            (order_id, customer_key, sales_rep_key, order_date, order_code, order_status,
             order_status_category, order_total, order_currency, promotion_code,
             is_valid, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (order_id) DO NOTHING
        """
        
        transformed = []
        skipped = 0
        for row in bronze_orders:
            customer_key = customer_map.get(row[1])  # customer_id -> customer_key
            
            # Skip if required foreign key is missing
            if not customer_key:
                skipped += 1
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
            
            # order_date and order_status are NOT NULL in schema - provide defaults if missing
            order_date = row[3] or datetime.now().date()
            order_status = status  # Already handled with default 'PENDING'
            
            transformed.append((
                row[0],  # order_id
                customer_key,  # customer_key
                sales_rep_key,  # sales_rep_key
                order_date,  # order_date (NOT NULL - use current date if missing)
                row[4],  # order_code
                order_status,  # order_status (NOT NULL - already has default 'PENDING')
                status_category,  # order_status_category
                row[6] or 0.0,  # order_total
                (row[7] or 'USD')[:3],  # order_currency
                row[8],  # promotion_code
                True,  # is_valid
                datetime.now()  # _etl_timestamp
            ))
        
        if skipped > 0:
            logger.warning(f"Skipped {skipped} orders due to missing customer_key (customer may not be populated yet)")
        
        if transformed:
            try:
                logger.info(f"  Attempting to insert {len(transformed)} orders...")
                execute_batch(self.cursor, insert_query, transformed, page_size=len(transformed))
                rows_inserted = self.cursor.rowcount
                self.connection.commit()
                
                # Verify insertion - check actual table count
                self.cursor.execute("SELECT COUNT(*) FROM silver.orders")
                new_count = self.cursor.fetchone()[0]
                actual_inserted = new_count - silver_count if silver_count is not None else new_count
                
                logger.info(f"  Cursor rowcount: {rows_inserted} (may be 0 due to ON CONFLICT)")
                logger.info(f"  Actual records inserted: {actual_inserted:,}")
                logger.info(f"  Total records in silver.orders after insert: {new_count:,}")
                
                if actual_inserted == 0 and len(transformed) > 0:
                    logger.error(f"  [ERROR] No rows inserted despite {len(transformed)} records prepared!")
                    logger.error(f"  [ERROR] Check constraints, foreign keys, or if records already exist")
                
                logger.info(f"Successfully transformed {actual_inserted} orders")
                return max(0, actual_inserted)
            except Exception as e:
                self.connection.rollback()
                logger.error(f"[ERROR] Failed to insert orders: {e}")
                logger.error(f"[ERROR] Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                raise
        else:
            if skipped > 0:
                logger.error(f"[ERROR] No orders inserted - all {skipped} records were skipped due to missing customer_key")
                logger.error(f"[ERROR] Check that silver.customer is populated and customer_id values match")
            else:
                logger.warning("[WARN] No orders to insert (all skipped or already exist)")
        
        if skipped > 0:
            logger.warning(f"  Note: {skipped} orders were skipped due to missing customer_key")
        return len(transformed)
    
    def transform_order_items(self, batch_size: int = 1000):
        """Transform bronze.order_item to silver.order_item with improved precision."""
        logger.info("Starting order item transformation...")
        
        # Ensure clean transaction state
        try:
            self.connection.rollback()
        except:
            pass
        
        # Check if table is empty first
        try:
            self.cursor.execute("SELECT COUNT(*) FROM silver.order_item")
            silver_count = self.cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not check silver.order_item count: {e}")
            silver_count = None
        
        logger.info(f"  silver.order_item current count: {silver_count if silver_count is not None else 'unknown'}")
        
        self.cursor.execute("""
            SELECT COUNT(*) FROM bronze.order_item oi
            WHERE oi.order_id IS NOT NULL AND oi.product_id IS NOT NULL
              AND oi.order_id IN (SELECT order_id FROM silver.orders)
              AND oi.product_id IN (SELECT product_id FROM silver.product)
        """)
        items_matchable = self.cursor.fetchone()[0]
        if items_matchable == 0:
            self.cursor.execute("SELECT COUNT(*) FROM bronze.order_item")
            if self.cursor.fetchone()[0] > 0:
                logger.error(
                    "  [ERROR] bronze.order_item has rows but none join silver.orders + silver.product — run those steps first."
                )
                return 0
        
        if silver_count is None or silver_count == 0:
            logger.info("  Loading deduped bronze.order_item (latest per order_item_id) with valid FKs")
        else:
            logger.info(f"  Incremental: new order_item_id only")
        
        select_query = """
            SELECT oi.order_item_id, oi.order_id, oi.product_id, oi.unit_price, oi.quantity,
                   o.promotion_code, p.list_price
            FROM (
                SELECT DISTINCT ON (oi2.order_item_id)
                    oi2.order_item_id, oi2.order_id, oi2.product_id, oi2.unit_price, oi2.quantity
                FROM bronze.order_item oi2
                WHERE oi2.order_id IS NOT NULL AND oi2.product_id IS NOT NULL
                  AND oi2.order_id IN (SELECT order_id FROM silver.orders)
                  AND oi2.product_id IN (SELECT product_id FROM silver.product)
                ORDER BY oi2.order_item_id, oi2._load_timestamp DESC NULLS LAST
            ) oi
            INNER JOIN bronze.orders o ON oi.order_id = o.order_id
            LEFT JOIN bronze.product p ON oi.product_id = p.product_id
            LEFT JOIN silver.order_item s ON oi.order_item_id = s.order_item_id
            WHERE s.order_item_id IS NULL
            ORDER BY oi.order_item_id
            LIMIT %s
        """
        
        try:
            self.cursor.execute(select_query, (batch_size,))
            bronze_items = self.cursor.fetchall()
        except Exception as e:
            logger.error(f"  [ERROR] Failed to execute SELECT query: {e}")
            self.connection.rollback()
            raise
        
        logger.info(f"  Selected {len(bronze_items)} records from bronze for processing")
        
        if not bronze_items:
            pending = fetch_pending_count(self.cursor, "order_items")
            if pending is None or pending == 0:
                self.cursor.execute("SELECT COUNT(*) FROM bronze.order_item")
                bronze_total = self.cursor.fetchone()[0]
                try:
                    self.cursor.execute(
                        "SELECT COUNT(DISTINCT order_item_id) FROM bronze.order_item "
                        "WHERE order_item_id IS NOT NULL"
                    )
                    distinct = self.cursor.fetchone()[0]
                except Exception:
                    distinct = 0
                if bronze_total > 0:
                    logger.info(
                        "  No new order_item_id to load (%s bronze rows, %s distinct; synced or FK mismatch).",
                        f"{bronze_total:,}",
                        f"{distinct:,}",
                    )
            elif pending > 0:
                logger.error(
                    "  [ERROR] %s order_items pending by key but SELECT returned 0.",
                    f"{pending:,}",
                )
            logger.info("No new order items to transform")
            return 0
        
        # Log sample of selected records
        if bronze_items:
            logger.info(f"  Sample first record: order_item_id={bronze_items[0][0]}, order_id={bronze_items[0][1]}")
        
        logger.info(f"Transforming {len(bronze_items)} order items...")
        
        # Get order keys
        self.cursor.execute("SELECT order_id, order_key FROM silver.orders;")
        order_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(order_map)} orders in silver.orders")
        
        # Check for missing order_ids
        unique_order_ids = set(row[1] for row in bronze_items if row[1] is not None)
        missing_orders = unique_order_ids - set(order_map.keys())
        if missing_orders:
            logger.warning(f"  [WARN] {len(missing_orders)} order_ids from bronze don't exist in silver.orders")
            logger.warning(f"  Missing order_ids (first 10): {sorted(list(missing_orders))[:10]}")
        
        # Get product keys
        self.cursor.execute("SELECT product_id, product_key FROM silver.product;")
        product_map = {row[0]: row[1] for row in self.cursor.fetchall()}
        logger.info(f"  Found {len(product_map)} products in silver.product")
        
        # Check for missing product_ids
        unique_product_ids = set(row[2] for row in bronze_items if row[2] is not None)
        missing_products = unique_product_ids - set(product_map.keys())
        if missing_products:
            logger.warning(f"  [WARN] {len(missing_products)} product_ids from bronze don't exist in silver.product")
            logger.warning(f"  Missing product_ids (first 10): {sorted(list(missing_products))[:10]}")
        
        insert_query = """
            INSERT INTO silver.order_item 
            (order_item_id, order_key, product_key, unit_price, quantity, discount_amount,
             is_valid, _etl_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (order_item_id) DO NOTHING
        """
        
        transformed = []
        skipped = 0
        for row in bronze_items:
            order_key = order_map.get(row[1])  # order_id -> order_key
            product_key = product_map.get(row[2])  # product_id -> product_key
            
            if not order_key or not product_key:
                skipped += 1
                continue  # Skip if foreign keys are missing
            
            # Validate and normalize unit_price
            unit_price = float(row[3]) if row[3] is not None else 0.0
            if unit_price < 0:
                unit_price = 0.0
            unit_price = round(unit_price, 2)  # Ensure 2 decimal precision
            
            # Validate and normalize quantity
            quantity = float(row[4]) if row[4] is not None else 0.0
            if quantity < 0:
                quantity = 0.0
            quantity = round(quantity, 2)  # Ensure 2 decimal precision
            
            # Calculate discount_amount if promotion exists
            discount_amount = 0.0
            promotion_code = row[5]
            list_price = float(row[6]) if row[6] is not None else unit_price
            
            if promotion_code and promotion_code.strip():
                # Apply 10% discount for promotions (can be enhanced with actual promotion logic)
                # Discount is calculated on the line total
                line_total = unit_price * quantity
                discount_amount = round(line_total * 0.10, 2)  # 10% discount
            
            # Ensure discount doesn't exceed line total
            line_total = unit_price * quantity
            if discount_amount > line_total:
                discount_amount = round(line_total, 2)
            
            discount_amount = round(discount_amount, 2)  # Ensure 2 decimal precision
            
            transformed.append((
                row[0],  # order_item_id
                order_key,  # order_key
                product_key,  # product_key
                unit_price,  # unit_price (validated and rounded)
                quantity,  # quantity (validated and rounded)
                discount_amount,  # discount_amount (calculated)
                True,  # is_valid
                datetime.now()  # _etl_timestamp
            ))
        
        if skipped > 0:
            logger.warning(f"Skipped {skipped} order items due to missing foreign keys")
        
        if transformed:
            try:
                logger.info(f"  Attempting to insert {len(transformed)} order items...")
                execute_batch(self.cursor, insert_query, transformed, page_size=len(transformed))
                rows_inserted = self.cursor.rowcount
                self.connection.commit()
                
                # Verify insertion - check actual table count
                self.cursor.execute("SELECT COUNT(*) FROM silver.order_item")
                new_count = self.cursor.fetchone()[0]
                actual_inserted = new_count - silver_count if silver_count is not None else new_count
                
                logger.info(f"  Cursor rowcount: {rows_inserted} (may be 0 due to ON CONFLICT)")
                logger.info(f"  Actual records inserted: {actual_inserted:,}")
                logger.info(f"  Total records in silver.order_item after insert: {new_count:,}")
                
                if actual_inserted == 0 and len(transformed) > 0:
                    logger.error(f"  [ERROR] No rows inserted despite {len(transformed)} records prepared!")
                    logger.error(f"  [ERROR] Check constraints, foreign keys, or if records already exist")
                
                logger.info(f"Successfully transformed {actual_inserted} order items")
                return max(0, actual_inserted)
            except Exception as e:
                self.connection.rollback()
                logger.error(f"[ERROR] Failed to insert order items: {e}")
                logger.error(f"[ERROR] Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"[ERROR] Traceback: {traceback.format_exc()}")
                raise
        else:
            if skipped > 0:
                logger.error(f"[ERROR] No order items inserted - all {skipped} records were skipped")
                logger.error(f"[ERROR] Check that silver.orders and silver.product are populated")
                logger.error(f"[ERROR] Missing order_keys: {skipped} records")
            else:
                logger.warning("[WARN] No order items to insert (all skipped or already exist)")
        
        return len(transformed)
    
    def transform_all(self, batch_size: int = 1000):
        """Run all Bronze -> Silver transforms in dependency order."""
        logger.info("Bronze -> Silver (batch_size=%s)", batch_size)
        try:
            self.cursor.execute("SELECT COUNT(*) FROM silver.person")
            pc = self.cursor.fetchone()[0]
            self.cursor.execute("SELECT COUNT(*) FROM silver.country")
            cc = self.cursor.fetchone()[0]
            if pc == 0:
                logger.warning("silver.person is empty; person step will run first")
            if cc == 0:
                logger.warning("silver.country is empty; country step will run first")
        except Exception as e:
            logger.warning("Could not check prerequisites: %s", e)
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
            ('employment_jobs', self.transform_employment_jobs, 'employment_jobs'),
            ('employees', self.transform_employees, 'employee'),
            ('customers', self.transform_customers, 'customer'),
            ('orders', self.transform_orders, 'orders'),
            ('order_items', self.transform_order_items, 'order_item'),
        ]
        
        total_steps = len(transformation_order)
        
        for step_num, (name, transform_func, table_name) in enumerate(transformation_order, 1):
            step_start = time.time()
            bronze_table = BRONZE_TABLE_FOR_SILVER.get(table_name, table_name)
            try:
                self.cursor.execute(f"SELECT COUNT(*) FROM bronze.{bronze_table};")
                bronze_count = self.cursor.fetchone()[0]
                self.cursor.execute(f"SELECT COUNT(*) FROM silver.{table_name};")
                silver_before = self.cursor.fetchone()[0]
            except Exception as e:
                logger.warning("Counts failed for %s / %s: %s", bronze_table, table_name, e)
                bronze_count = 0
                silver_before = 0
            pending_n = fetch_pending_count(self.cursor, name)
            if pending_n is not None:
                records_to_process = pending_n
            else:
                records_to_process = max(0, bronze_count - silver_before)
                if bronze_count > 0 and silver_before == 0:
                    records_to_process = bronze_count
            
            logger.info(
                "Step %s/%s: %s (bronze=%s, silver=%s, pending=%s)",
                step_num,
                total_steps,
                name,
                f"{bronze_count:,}",
                f"{silver_before:,}",
                f"{records_to_process:,}",
            )
            
            if records_to_process <= 0:
                totals[name] = 0
                logger.info("  Skipping — no pending rows for silver.%s", table_name)
                continue
            
            # Job tracking: only "Complete ETL Pipeline" is tracked at run_etl.py level.
            # Do not create per-table jobs in monitoring.etl_jobs (only two jobs allowed).
            job_id = None

            # Transform in batches
            batch_num = 0
            step_total = 0
            consecutive_zero_batches = 0
            max_consecutive_zeros = 3  # Stop after 3 consecutive zero batches
            
            is_empty_table = (silver_before == 0 and records_to_process > 0)
            if is_empty_table:
                effective_batch_size = min(batch_size * 10, 50000)
            else:
                effective_batch_size = batch_size
            
            while True:
                batch_start = time.time()
                count = transform_func(effective_batch_size if is_empty_table else batch_size)
                batch_elapsed = time.time() - batch_start
                
                if count == 0:
                    consecutive_zero_batches += 1
                    # For empty tables, be more patient - allow more zero batches
                    max_zeros_for_empty = 5 if is_empty_table else max_consecutive_zeros
                    if consecutive_zero_batches >= max_zeros_for_empty:
                        if is_empty_table:
                            try:
                                self.cursor.execute(f"SELECT COUNT(*) FROM silver.{table_name};")
                                if self.cursor.fetchone()[0] == 0:
                                    logger.warning("silver.%s still empty; check FK lookups", table_name)
                            except Exception:
                                pass
                        break
                    # Continue to next batch in case of temporary issues
                else:
                    consecutive_zero_batches = 0  # Reset counter on successful batch
                    batch_num += 1
                    step_total += count
                    
                    logger.info("Batch %s: %s records in %.1fs", batch_num, count, batch_elapsed)
                
                if records_to_process > 0 and step_total >= records_to_process:
                    break
                
                # For empty tables, also check if we've processed a reasonable amount
                if is_empty_table and step_total >= bronze_count * 0.1:  # Process at least 10% before giving up
                    # Check actual table count
                    try:
                        self.cursor.execute(f"SELECT COUNT(*) FROM silver.{table_name};")
                        actual_count = self.cursor.fetchone()[0]
                        if actual_count == 0 and step_total > 1000:
                            logger.error(f"  [ERROR] Processed {step_total:,} records but table is still empty!")
                            logger.error(f"  [ERROR] All records are being filtered out - check foreign key constraints")
                            break
                    except:
                        pass
            
            # Get after count
            try:
                self.cursor.execute(f"SELECT COUNT(*) FROM silver.{table_name};")
                silver_after = self.cursor.fetchone()[0]
            except:
                silver_after = silver_before
            
            step_elapsed = time.time() - step_start
            totals[name] = step_total
            
            logger.info("")
            logger.info(f"[OK] {name.replace('_', ' ').title()} Transformation Complete")
            logger.info(f"  Records transformed: {step_total:,}")
            logger.info(f"  Silver records after: {silver_after:,}")
            logger.info(f"  Time taken: {step_elapsed:.2f}s ({step_elapsed/60:.2f} min)")
            if step_total > 0:
                logger.info(f"  Average speed: {step_total/step_elapsed:.0f} records/sec")
            
            # Warn if table is still empty but should have data
            if bronze_count > 0 and silver_after == 0 and step_total == 0:
                logger.error("")
                logger.error(f"  [ERROR] Table silver.{table_name} is still empty after transformation!")
                logger.error(f"  [ERROR] Bronze has {bronze_count:,} records but Silver has 0")
                logger.error(f"  [ERROR] This indicates all records were skipped - check foreign key matching")
                logger.error(f"  [ERROR] Check prerequisite tables and foreign key values")
                logger.error("")
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("BRONZE TO SILVER TRANSFORMATION COMPLETE!")
        logger.info("=" * 80)
        logger.info("Final Summary:")
        for key, value in sorted(totals.items()):
            logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
        logger.info("=" * 80)
        
        return totals
