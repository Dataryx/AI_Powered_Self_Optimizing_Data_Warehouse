"""
Clickstream Data Generator
Generates realistic clickstream/event data.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
from .base_generator import BaseGenerator


class ClickstreamGenerator(BaseGenerator):
    """Generator for clickstream event data."""
    
    EVENT_TYPES = ['page_view', 'click', 'add_to_cart', 'remove_from_cart', 'checkout_start', 'purchase', 'search']
    PAGE_CATEGORIES = ['home', 'product', 'category', 'cart', 'checkout', 'search', 'account', 'help']
    
    def __init__(self, config, sessions: List[Dict], products: List[Dict], customers: List[Dict] = None, seed: int = None):
        """Initialize clickstream generator."""
        super().__init__(config, seed)
        self.sessions = sessions
        self.products = products
        self.customers = customers or []
        self.event_ids = set()
    
    def generate(self) -> List[Dict[str, Any]]:
        """Generate clickstream event records."""
        events = []
        
        for session in self.sessions:
            # Generate events for this session
            num_events = random.randint(
                self.config.events_per_session_range[0],
                self.config.events_per_session_range[1]
            )
            
            session_start = session['start_time']
            session_end = session['end_time']
            duration = (session_end - session_start).total_seconds()
            
            # Distribute events across session duration
            for i in range(num_events):
                event_timestamp = session_start + timedelta(
                    seconds=random.uniform(0, duration) if duration > 0 else 0
                )
                
                event_id = len(self.event_ids) + 1
                while event_id in self.event_ids:
                    event_id = random.randint(1000000, 9999999)
                self.event_ids.add(event_id)
                
                event_type = random.choice(self.EVENT_TYPES)
                page_category = random.choice(self.PAGE_CATEGORIES)
                
                # Generate page URL based on category
                if page_category == 'product' and self.products:
                    product = random.choice(self.products)
                    page_url = f"/products/{product['product_id']}"
                elif page_category == 'category':
                    category = random.choice(['Electronics', 'Clothing', 'Home', 'Sports'])
                    page_url = f"/categories/{category.lower()}"
                else:
                    page_url = f"/{page_category}"
                
                # Referrer (50% chance)
                referrer = None
                if random.random() > 0.5:
                    referrer = random.choice([
                        'https://www.google.com',
                        'https://www.bing.com',
                        'https://www.facebook.com',
                        'https://www.twitter.com',
                        'direct'
                    ])
                
                event = {
                    'event_id': event_id,
                    'session_id': session['session_id'],
                    'user_id': session.get('user_id'),
                    'event_type': event_type,
                    'page_url': page_url,
                    'referrer': referrer,
                    'device_info': {
                        'device_type': session['device_type'],
                        'browser': session['browser'],
                        'operating_system': session['operating_system'],
                        'is_mobile': session.get('is_mobile', False),
                        'screen_resolution': f"{random.choice([1920, 1366, 1440])}x{random.choice([1080, 768, 900])}"
                    },
                    'event_timestamp': event_timestamp,
                    'source_system': self.get_source_system(),
                    'ingestion_timestamp': datetime.now(),
                    'raw_data': {}
                }
                
                event['raw_data'] = event.copy()
                events.append(event)
        
        return events
