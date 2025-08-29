/**
 * Revenue chart component using Recharts
 */
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient, type MetricDaily } from '../api/apiClient';

export function RevenueChart() {
  const [metrics, setMetrics] = useState<MetricDaily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('📊 RevenueChart: Fetching daily metrics...');
        
        // Get last 30 days of metrics
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
        
        const data = await apiClient.getMetricsDaily({
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0]
        });
        
        setMetrics(data);
        
        // Print first metric row to console for verification
        if (data.length > 0) {
          console.log('📈 First metric row:', data[0]);
        }
        
        console.log(`✅ RevenueChart: Loaded ${data.length} daily metrics`);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metrics';
        setError(errorMessage);
        console.error('❌ RevenueChart error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value / 100); // Convert from cents
  };

  // Format percentage for display
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Prepare chart data
  const chartData = metrics.map(metric => ({
    date: metric.date,
    grossRevenue: metric.gross_revenue / 100, // Convert from cents to dollars
    netRevenue: metric.net_revenue / 100,
    authRate: metric.auth_rate * 100, // Convert to percentage
    newCustomers: metric.new_customers,
  }));

  if (loading) {
    return (
      <div className="chart-loading">
        <h2>📊 Revenue Metrics</h2>
        <p>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-error">
        <h2>📊 Revenue Metrics</h2>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <p>Check console for details</p>
      </div>
    );
  }

  return (
    <div className="revenue-chart">
      <h2>📊 Revenue Metrics ({metrics.length} days)</h2>
      
      {metrics.length === 0 ? (
        <p>No metrics data found.</p>
      ) : (
        <>
          {/* Summary stats */}
          <div className="metrics-summary">
            <div className="metric-card">
              <h3>Total Gross Revenue</h3>
              <p className="metric-value">
                {formatCurrency(metrics.reduce((sum, m) => sum + m.gross_revenue, 0))}
              </p>
            </div>
            <div className="metric-card">
              <h3>Total Net Revenue</h3>
              <p className="metric-value">
                {formatCurrency(metrics.reduce((sum, m) => sum + m.net_revenue, 0))}
              </p>
            </div>
            <div className="metric-card">
              <h3>Avg Auth Rate</h3>
              <p className="metric-value">
                {formatPercent(metrics.reduce((sum, m) => sum + m.auth_rate, 0) / metrics.length)}
              </p>
            </div>
            <div className="metric-card">
              <h3>Total New Customers</h3>
              <p className="metric-value">
                {metrics.reduce((sum, m) => sum + m.new_customers, 0)}
              </p>
            </div>
          </div>

          {/* Revenue chart */}
          <div className="chart-container">
            <h3>Daily Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickFormatter={formatCurrency}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'grossRevenue' || name === 'netRevenue') {
                      return [formatCurrency(value as number), name];
                    }
                    return [value, name];
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="grossRevenue" 
                  stroke="#8884d8" 
                  name="Gross Revenue"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="netRevenue" 
                  stroke="#82ca9d" 
                  name="Net Revenue"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
