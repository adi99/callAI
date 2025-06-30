import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ConnectStore from './pages/ConnectStore';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Conversations from './pages/Conversations';
import CallHistory from './pages/CallHistory';
import CallMonitoring from './pages/CallMonitoring';
import Settings from './pages/Settings';
import OAuthCallback from './pages/OAuthCallback';

function App() {
  return (
    <Router>
      <Routes>
        {/* OAuth callback route - outside of Layout */}
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        
        {/* Main app routes - inside Layout */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/connect-store" element={<ConnectStore />} />
              <Route path="/products" element={<Products />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/conversations" element={<Conversations />} />
              <Route path="/call-history" element={<CallHistory />} />
              <Route path="/call-monitoring" element={<CallMonitoring />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;