/**
 * Main demo app component
 */
import { useEffect } from 'react';
import { CustomersList } from './components/CustomersList';
import { RevenueChart } from './components/RevenueChart';
import './App.css';

function App() {
  useEffect(() => {
    // Enable injection for demo
    (globalThis as any).__INJECT_FIXTURES = true;
    
    console.log('🚀 Demo App: Injection enabled');
    console.log('🎯 Demo App: Ready to test end-to-end pipeline');
    
    // Log environment info
    console.log('Environment:', {
      isDevelopment: process.env.NODE_ENV === 'development',
      injectionEnabled: (globalThis as any).__INJECT_FIXTURES,
      apiBase: '/api'
    });
  }, []);

  return (
    <div className="App">
      <header className="app-header">
        <h1>🧪 Dataset Injection Demo</h1>
        <p>End-to-end demonstration of synthetic data injection from React → Fixture Server</p>
        <div className="injection-status">
          <span className="injection-indicator">🎯</span>
          <span>Fixture Injection: ENABLED</span>
        </div>
      </header>

      <main className="app-main">
        <div className="demo-section">
          <CustomersList />
        </div>
        
        <div className="demo-section">
          <RevenueChart />
        </div>
      </main>

      <footer className="app-footer">
        <p>Check browser console for injection logs and API data</p>
        <p>Backend powered by Dataset Injector fixture server</p>
      </footer>
    </div>
  );
}

export default App;
