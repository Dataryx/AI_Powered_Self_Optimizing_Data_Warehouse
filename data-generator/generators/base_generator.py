"""
Base Generator Class
Base class for all data generators.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
import random
from faker import Faker


class BaseGenerator(ABC):
    """Base class for all data generators."""
    
    def __init__(self, config, seed: int = None):
        """Initialize generator with configuration and optional seed."""
        self.config = config
        self.fake = Faker()
        if seed:
            random.seed(seed)
            Faker.seed(seed)
    
    @abstractmethod
    def generate(self, count: int) -> List[Dict[str, Any]]:
        """
        Generate synthetic data.
        
        Args:
            count: Number of records to generate
            
        Returns:
            List of dictionaries representing records
        """
        pass
    
    def generate_one(self) -> Dict[str, Any]:
        """Generate a single record."""
        records = self.generate(1)
        return records[0] if records else {}
    
    def get_source_system(self) -> str:
        """Get source system identifier."""
        return self.config.source_system
