/**
 * Customers list component that demonstrates API injection
 */
import { useState, useEffect } from 'react';
import { apiClient, type Customer } from '../api/apiClient';

export function CustomersList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 CustomersList: Fetching customers...');
        const data = await apiClient.getCustomers();
        
        setCustomers(data);
        
        // Print first 3 customers to console for verification
        console.log('📋 First 3 customers:', data.slice(0, 3));
        
        // Log injection success
        console.log(`✅ CustomersList: Loaded ${data.length} customers`);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch customers';
        setError(errorMessage);
        console.error('❌ CustomersList error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  if (loading) {
    return (
      <div className="customers-loading">
        <h2>👥 Customers</h2>
        <p>Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customers-error">
        <h2>👥 Customers</h2>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <p>Check console for details</p>
      </div>
    );
  }

  return (
    <div className="customers-list">
      <h2>👥 Customers ({customers.length})</h2>
      
      {customers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <div className="customers-grid">
          {customers.slice(0, 10).map((customer) => (
            <div key={customer.id} className="customer-card">
              <div className="customer-header">
                <strong>{customer.name || 'Unknown'}</strong>
                <span className="customer-id">{customer.id}</span>
              </div>
              <div className="customer-email">{customer.email}</div>
              <div className="customer-created">
                Created: {new Date(customer.created * 1000).toLocaleDateString()}
              </div>
              {customer.metadata && Object.keys(customer.metadata).length > 0 && (
                <div className="customer-metadata">
                  <small>
                    Metadata: {JSON.stringify(customer.metadata, null, 0)}
                  </small>
                </div>
              )}
            </div>
          ))}
          
          {customers.length > 10 && (
            <div className="customers-more">
              <p>... and {customers.length - 10} more customers</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
