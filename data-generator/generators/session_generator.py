"""
Session Data Generator
Generates realistic user session data.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
from .base_generator import BaseGenerator


class SessionGenerator(BaseGenerator):
    """Generator for user session data."""
    
    DEVICE_TYPES = ['desktop', 'mobile', 'tablet']
    BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Opera']
    OPERATING_SYSTEMS = ['Windows', 'macOS', 'Linux', 'iOS', 'Android']
    
    def __init__(self, config, customers: List[Dict], seed: int = None):
        """Initialize session generator."""
        super().__init__(config, seed)
        self.customers = customers
        self.session_ids = set()
    
    def generate(self, count: int = None) -> List[Dict[str, Any]]:
        """Generate session records."""
        if count is None:
            count = self.config.sessions_per_day * self.config.days_of_data
        
        sessions = []
        start_date = datetime.now() - timedelta(days=self.config.days_of_data)
        
        for i in range(count):
            session_id = f"SESS{str(i+1).zfill(12)}"
            while session_id in self.session_ids:
                session_id = f"SESS{str(random.randint(100000000000, 999999999999))}"
            self.session_ids.add(session_id)
            
            # 60% of sessions have logged-in users
            user_id = None
            if random.random() < 0.6 and self.customers:
                customer = random.choice(self.customers)
                user_id = customer['customer_id']
            
            start_time = self.fake.date_time_between(
                start_date=start_date,
                end_date='now'
            )
            
            # Session duration: 30 seconds to 2 hours
            duration_seconds = random.randint(30, 7200)
            end_time = start_time + timedelta(seconds=duration_seconds)
            
            device_type = random.choice(self.DEVICE_TYPES)
            is_mobile = device_type in ['mobile', 'tablet']
            
            session = {
                'session_id': session_id,
                'user_id': user_id,
                'start_time': start_time,
                'end_time': end_time,
                'duration_seconds': duration_seconds,
                'device_type': device_type,
                'browser': random.choice(self.BROWSERS),
                'operating_system': random.choice(self.OPERATING_SYSTEMS),
                'location': {
                    'country': self.fake.country(),
                    'city': self.fake.city(),
                    'latitude': float(self.fake.latitude()),
                    'longitude': float(self.fake.longitude())
                },
                'ip_address': self.fake.ipv4(),
                'is_mobile': is_mobile,
                'source_system': self.get_source_system(),
                'ingestion_timestamp': datetime.now(),
                'raw_data': {}
            }
            
            session['raw_data'] = session.copy()
            sessions.append(session)
        
        return sessions
