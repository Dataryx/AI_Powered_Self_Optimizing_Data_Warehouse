"""
Review Data Generator
Generates realistic product review data.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
from .base_generator import BaseGenerator


class ReviewGenerator(BaseGenerator):
    """Generator for product review data."""
    
    REVIEW_TITLES = [
        "Great product!",
        "Highly recommend",
        "Not what I expected",
        "Worth every penny",
        "Could be better",
        "Perfect for my needs",
        "Disappointed",
        "Excellent quality",
        "Good value",
        "Average product"
    ]
    
    def __init__(self, config, customers: List[Dict], products: List[Dict], orders: List[Dict], seed: int = None):
        """Initialize review generator."""
        super().__init__(config, seed)
        self.customers = customers
        self.products = products
        self.orders = orders
        self.review_ids = set()
        
        # Create mapping of customers who ordered products
        self.customer_product_pairs = {}
        for order in orders:
            customer_id = order['customer_id']
            if customer_id not in self.customer_product_pairs:
                self.customer_product_pairs[customer_id] = set()
            # Extract product IDs from order raw_data if available
            if 'raw_data' in order and 'items' in order['raw_data']:
                for item in order['raw_data']['items']:
                    self.customer_product_pairs[customer_id].add(item['product_id'])
    
    def generate(self) -> List[Dict[str, Any]]:
        """Generate review records."""
        reviews = []
        start_date = datetime.now() - timedelta(days=self.config.days_of_data)
        
        # Generate reviews for products
        for product in self.products:
            num_reviews = random.randint(
                self.config.reviews_per_product_range[0],
                self.config.reviews_per_product_range[1]
            )
            
            # Get customers who ordered this product
            potential_customers = [
                c for c in self.customers
                if c['customer_id'] in self.customer_product_pairs
                and product['product_id'] in self.customer_product_pairs[c['customer_id']]
            ]
            
            # If no customers ordered this product, select random customers
            if not potential_customers:
                potential_customers = self.customers
            
            # Select customers for reviews
            review_customers = random.sample(
                potential_customers,
                min(num_reviews, len(potential_customers))
            )
            
            for customer in review_customers:
                # Only generate review with certain probability
                if random.random() > self.config.review_probability:
                    continue
                
                review_id = f"REV{str(len(self.review_ids) + 1).zfill(10)}"
                while review_id in self.review_ids:
                    review_id = f"REV{str(random.randint(1000000000, 9999999999))}"
                self.review_ids.add(review_id)
                
                # Rating distribution: more positive reviews
                rating = random.choices(
                    [1, 2, 3, 4, 5],
                    weights=[5, 10, 15, 30, 40]
                )[0]
                
                review_date = self.fake.date_time_between(
                    start_date=start_date,
                    end_date='now'
                )
                
                # Generate review text based on rating
                if rating >= 4:
                    review_text = self.fake.paragraph(nb_sentences=random.randint(2, 5))
                elif rating == 3:
                    review_text = self.fake.paragraph(nb_sentences=random.randint(1, 3))
                else:
                    review_text = self.fake.paragraph(nb_sentences=random.randint(1, 4))
                
                review = {
                    'review_id': review_id,
                    'product_id': product['product_id'],
                    'customer_id': customer['customer_id'],
                    'rating': rating,
                    'review_text': review_text,
                    'review_title': random.choice(self.REVIEW_TITLES),
                    'review_date': review_date,
                    'helpful_count': random.randint(0, 50),
                    'verified_purchase': random.random() > 0.3,  # 70% verified
                    'source_system': self.get_source_system(),
                    'ingestion_timestamp': datetime.now(),
                    'raw_data': {}
                }
                
                review['raw_data'] = review.copy()
                reviews.append(review)
        
        return reviews
