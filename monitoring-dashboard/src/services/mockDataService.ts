/**
 * Mock Data Service
 * Provides fake data when API is unavailable
 */

// Generate random number between min and max
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate random date within last N days
const randomDate = (daysAgo: number = 30) => {
  const date = new Date();
  date.setDate(date.getDate() - random(0, daysAgo));
  return date.toISOString().split('T')[0];
};

// Generate warehouse summary mock data
export const getMockWarehouseSummary = () => {
  const bronzeRows = random(5000000, 10000000);
  const silverRows = random(2000000, 5000000);
  const goldRows = random(500000, 2000000);
  
  return {
    warehouse_summary: {
      bronze: {
        table_count: random(8, 12),
        estimated_rows: bronzeRows,
        total_size: `${(bronzeRows / 1000000).toFixed(1)} MB`,
      },
      silver: {
        table_count: random(14, 16),
        estimated_rows: silverRows,
        total_size: `${(silverRows / 1000000).toFixed(1)} MB`,
      },
      gold: {
        table_count: random(12, 14),
        estimated_rows: goldRows,
        total_size: `${(goldRows / 1000000).toFixed(1)} MB`,
      },
    },
    database: 'PostgreSQL 15.0',
  };
};

// Generate sales stats mock data
export const getMockSalesStats = () => {
  const totalSales = random(50000, 150000);
  const revenue = totalSales * random(50, 200);
  const avgSale = revenue / totalSales;
  
  // Generate daily sales for last 30 days
  const dailySales = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const daySales = random(1000, 5000);
    const dayRevenue = daySales * random(50, 200);
    return {
      date: date.toISOString().split('T')[0],
      sales: daySales,
      revenue: dayRevenue,
    };
  });
  
  // Generate top products
  const productNames = [
    'Premium Widget Pro',
    'Enterprise Solution X',
    'Business Toolkit Plus',
    'Advanced Analytics Suite',
    'Professional Service Package',
    'Deluxe Product Bundle',
    'Standard Enterprise License',
    'Premium Support Plan',
    'Custom Integration Service',
    'Enterprise Data Platform',
  ];
  
  const topProducts = Array.from({ length: 10 }, (_, i) => ({
    product_name: productNames[i] || `Product ${i + 1}`,
    total_sales: random(500, 5000),
    revenue: random(25000, 250000),
    percentage: random(5, 25),
  }));
  
  return {
    total_sales: {
      count: totalSales,
      revenue: revenue,
      avg_sale: avgSale,
    },
    daily_sales: dailySales,
    top_products: topProducts,
  };
};

// Generate customer stats mock data
export const getMockCustomerStats = () => {
  return {
    total_customers: random(100000, 200000),
    active_customers: random(50000, 100000),
    new_customers_this_month: random(1000, 5000),
    churned_customers: random(500, 2000),
  };
};

// Generate ETL jobs mock data
export const getMockETLJobs = () => {
  const statuses = ['running', 'completed', 'failed', 'pending'];
  const jobTypes = ['bronze_to_silver', 'silver_to_gold', 'data_quality', 'aggregation'];
  
  return Array.from({ length: 20 }, (_, i) => {
    const status = statuses[random(0, statuses.length - 1)];
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - random(0, 24));
    
    return {
      job_id: `job_${random(1000, 9999)}`,
      job_type: jobTypes[random(0, jobTypes.length - 1)],
      status: status,
      start_time: startTime.toISOString(),
      end_time: status === 'running' ? null : new Date(startTime.getTime() + random(60000, 3600000)).toISOString(),
      records_processed: random(1000, 100000),
      error_message: status === 'failed' ? 'Connection timeout' : null,
    };
  });
};

// Generate monitoring metrics mock data
export const getMockMonitoringMetrics = () => {
  return {
    throughput: {
      records_per_second: random(100, 1000),
      bytes_per_second: random(1000000, 10000000),
    },
    data_freshness: {
      bronze: random(1, 5), // minutes
      silver: random(5, 15),
      gold: random(15, 60),
    },
    data_quality: {
      completeness: random(85, 99),
      accuracy: random(90, 99),
      consistency: random(88, 98),
    },
  };
};

// Generate storage utilization mock data
export const getMockStorageUtilization = () => {
  const total = random(500, 2000); // GB
  const used = random(300, total);
  const available = total - used;
  
  return {
    total_storage_gb: total,
    used_storage_gb: used,
    available_storage_gb: available,
    utilization_percent: (used / total) * 100,
    bronze_size_gb: random(100, 500),
    silver_size_gb: random(150, 600),
    gold_size_gb: random(50, 200),
  };
};

// Generate alerts mock data
export const getMockAlerts = () => {
  const severities = ['critical', 'warning', 'info'];
  const types = ['performance', 'storage', 'data_quality', 'etl_failure'];
  
  return Array.from({ length: 15 }, (_, i) => {
    const severity = severities[random(0, severities.length - 1)];
    const timestamp = new Date();
    timestamp.setMinutes(timestamp.getMinutes() - random(0, 1440));
    
    return {
      alert_id: `alert_${random(1000, 9999)}`,
      type: types[random(0, types.length - 1)],
      severity: severity,
      message: `Sample alert message ${i + 1}`,
      timestamp: timestamp.toISOString(),
      acknowledged: random(0, 1) === 1,
    };
  });
};

// Generate optimization recommendations mock data
export const getMockOptimizations = () => {
  const types = ['index', 'partition', 'cache', 'query_optimization'];
  const statuses = ['pending', 'applied', 'dismissed'];
  
  return Array.from({ length: 10 }, (_, i) => {
    const type = types[random(0, types.length - 1)];
    const status = statuses[random(0, statuses.length - 1)];
    
    return {
      recommendation_id: `rec_${random(1000, 9999)}`,
      type: type,
      status: status,
      title: `Optimize ${type} for better performance`,
      description: `This recommendation suggests optimizing ${type} to improve query performance by ${random(10, 50)}%`,
      estimated_improvement: random(10, 50),
      cost: random(100, 1000),
      benefit: random(500, 5000),
      created_at: randomDate(30),
    };
  });
};

// Generate query performance mock data
export const getMockQueryPerformance = () => {
  return Array.from({ length: 50 }, (_, i) => {
    const queryTime = random(10, 5000); // milliseconds
    return {
      query_id: `query_${random(10000, 99999)}`,
      query_text: `SELECT * FROM table_${random(1, 10)} WHERE id = ${random(1, 1000)}`,
      execution_time_ms: queryTime,
      rows_returned: random(10, 10000),
      timestamp: new Date(Date.now() - random(0, 3600000)).toISOString(),
    };
  });
};

// Generate growth trends mock data
export const getMockGrowthTrends = (days: number = 30) => {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    
    return {
      date: date.toISOString().split('T')[0],
      storage_gb: random(500, 2000),
      records: random(1000000, 10000000),
      tables: random(30, 50),
    };
  });
};

// Main mock data service
export const mockDataService = {
  getWarehouseSummary: () => Promise.resolve(getMockWarehouseSummary()),
  getSalesStats: () => Promise.resolve(getMockSalesStats()),
  getCustomerStats: () => Promise.resolve(getMockCustomerStats()),
  getETLJobs: () => Promise.resolve(getMockETLJobs()),
  getMonitoringMetrics: () => Promise.resolve(getMockMonitoringMetrics()),
  getStorageUtilization: () => Promise.resolve(getMockStorageUtilization()),
  getAlerts: () => Promise.resolve(getMockAlerts()),
  getOptimizations: () => Promise.resolve(getMockOptimizations()),
  getQueryPerformance: () => Promise.resolve(getMockQueryPerformance()),
  getGrowthTrends: (days: number = 30) => Promise.resolve(getMockGrowthTrends(days)),
};


