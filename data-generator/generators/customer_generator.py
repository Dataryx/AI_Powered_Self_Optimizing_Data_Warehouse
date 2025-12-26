"""
Customer Data Generator
Generates realistic customer data.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
from .base_generator import BaseGenerator


class CustomerGenerator(BaseGenerator):
    """Generator for customer data."""
    
    def __init__(self, config, seed: int = None):
        """Initialize customer generator."""
        super().__init__(config, seed)
        self.customer_ids = set()
    
    def generate(self, count: int) -> List[Dict[str, Any]]:
        """Generate customer records."""
        customers = []
        start_date = datetime.now() - timedelta(days=self.config.days_of_data)
        
        for i in range(count):
            customer_id = f"CUST{str(i+1).zfill(8)}"
            
            # Ensure unique customer ID
            while customer_id in self.customer_ids:
                customer_id = f"CUST{str(random.randint(10000000, 99999999))}"
            self.customer_ids.add(customer_id)
            
            first_name = self.fake.first_name()
            last_name = self.fake.last_name()
            registration_date = self.fake.date_time_between(
                start_date=start_date,
                end_date='now'
            )
            
            customer = {
                'customer_id': customer_id,
                'email': self.fake.unique.email(),
                'customer_name': f"{first_name} {last_name}",
                'first_name': first_name,
                'last_name': last_name,
                'phone': self.fake.phone_number()[:50],
                'address': {
                    'street': self.fake.street_address(),
                    'city': self.fake.city(),
                    'state': self.fake.state(),
                    'country': self.fake.country(),
                    'postal_code': self.fake.zipcode()
                },
                'registration_date': registration_date,
                'date_of_birth': self.fake.date_of_birth(minimum_age=18, maximum_age=80),
                'gender': random.choice(['Male', 'Female', 'Other', None]),
                'source_system': self.get_source_system(),
                'ingestion_timestamp': datetime.now(),
                'raw_data': {}  # Will be populated with complete record
            }
            
            # Store complete record in raw_data
            customer['raw_data'] = customer.copy()
            
            customers.append(customer)
        
        return customers
