"""
Product Data Generator
Generates realistic product catalog data.
"""

from typing import List, Dict, Any
import random
from .base_generator import BaseGenerator


class ProductGenerator(BaseGenerator):
    """Generator for product data."""
    
    # Product categories and subcategories
    CATEGORIES = {
        'Electronics': ['Smartphones', 'Laptops', 'Tablets', 'Accessories', 'Audio'],
        'Clothing': ['Men', 'Women', 'Kids', 'Shoes', 'Accessories'],
        'Home & Garden': ['Furniture', 'Decor', 'Kitchen', 'Outdoor', 'Tools'],
        'Sports': ['Fitness', 'Outdoor Sports', 'Team Sports', 'Water Sports'],
        'Books': ['Fiction', 'Non-Fiction', 'Education', 'Children', 'Comics'],
        'Toys': ['Action Figures', 'Board Games', 'Educational', 'Outdoor'],
        'Beauty': ['Skincare', 'Makeup', 'Fragrance', 'Hair Care'],
        'Automotive': ['Parts', 'Accessories', 'Tools', 'Electronics']
    }
    
    BRANDS = {
        'Electronics': ['TechCorp', 'SmartTech', 'ElecPro', 'DigitalMax'],
        'Clothing': ['FashionStyle', 'UrbanWear', 'ClassicApparel', 'TrendyFits'],
        'Home & Garden': ['HomePro', 'GardenLife', 'DecorMax', 'CozyHome'],
        'Sports': ['SportPro', 'FitMax', 'ActiveLife', 'Champion'],
        'Books': ['BookHouse', 'ReadMore', 'LiteraryPress', 'StoryBooks'],
        'Toys': ['PlayTime', 'FunToys', 'KidZone', 'ToyWorld'],
        'Beauty': ['BeautyPro', 'Glow', 'PureBeauty', 'Elegance'],
        'Automotive': ['AutoPro', 'CarMax', 'DriveParts', 'AutoZone']
    }
    
    def __init__(self, config, seed: int = None):
        """Initialize product generator."""
        super().__init__(config, seed)
        self.product_ids = set()
        self.supplier_ids = [f"SUPP{str(i).zfill(5)}" for i in range(1, 101)]
    
    def generate(self, count: int) -> List[Dict[str, Any]]:
        """Generate product records."""
        products = []
        categories = list(self.CATEGORIES.keys())
        
        for i in range(count):
            product_id = f"PROD{str(i+1).zfill(8)}"
            
            # Ensure unique product ID
            while product_id in self.product_ids:
                product_id = f"PROD{str(random.randint(10000000, 99999999))}"
            self.product_ids.add(product_id)
            
            category = random.choice(categories)
            subcategory = random.choice(self.CATEGORIES[category])
            brand = random.choice(self.BRANDS[category])
            
            # Generate realistic pricing
            base_price = random.uniform(10.0, 1000.0)
            cost = base_price * random.uniform(0.3, 0.7)  # Cost is 30-70% of price
            
            product = {
                'product_id': product_id,
                'product_name': f"{brand} {self.fake.word().title()} {subcategory}",
                'description': self.fake.text(max_nb_chars=500),
                'category': category,
                'subcategory': subcategory,
                'price': round(base_price, 2),
                'cost': round(cost, 2),
                'currency': 'USD',
                'attributes': {
                    'brand': brand,
                    'color': self.fake.color_name() if random.random() > 0.5 else None,
                    'size': random.choice(['S', 'M', 'L', 'XL', None]) if category == 'Clothing' else None,
                    'weight': round(random.uniform(0.1, 50.0), 2),
                    'dimensions': {
                        'length': round(random.uniform(5, 200), 1),
                        'width': round(random.uniform(5, 200), 1),
                        'height': round(random.uniform(5, 200), 1)
                    }
                },
                'supplier_id': random.choice(self.supplier_ids),
                'brand': brand,
                'sku': f"SKU-{self.fake.bothify(text='???-####').upper()}",
                'source_system': self.get_source_system(),
                'ingestion_timestamp': self.fake.date_time_between(start_date='-1y', end_date='now'),
                'raw_data': {}
            }
            
            # Store complete record in raw_data
            product['raw_data'] = product.copy()
            
            products.append(product)
        
        return products
