import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your store connection...');

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const shop = urlParams.get('shop');
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          setStatus('error');
          setMessage('Connection cancelled or failed. Please try again.');
          setTimeout(() => navigate('/connect-store'), 3000);
          return;
        }

        if (!shop || !code || !state) {
          setStatus('error');
          setMessage('Invalid callback parameters. Please try connecting again.');
          setTimeout(() => navigate('/connect-store'), 3000);
          return;
        }

        // Call backend to complete the OAuth flow
        setMessage('Completing store connection...');
        const response = await apiService.completeShopifyCallback(shop, code, state);
        
        if (response.success && response.data) {
          // Show success message
          setStatus('success');
          setMessage(`Successfully connected ${response.data.store.name}! Your store data will be synced shortly.`);
        } else {
          setStatus('error');
          setMessage(response.error || 'Failed to complete store connection. Please try again.');
        }
        
        // Redirect to connect store page after a short delay
        setTimeout(() => {
          navigate('/connect-store');
        }, 3000);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('An error occurred while processing your connection. Please try again.');
        setTimeout(() => navigate('/connect-store'), 3000);
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-6">
            {status === 'processing' && (
              <RefreshCw className="h-16 w-16 text-blue-600 animate-spin mx-auto" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-16 w-16 text-red-600 mx-auto" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {status === 'processing' && 'Connecting Store...'}
            {status === 'success' && 'Connection Successful!'}
            {status === 'error' && 'Connection Failed'}
          </h1>
          
          <p className="text-gray-600 mb-6">{message}</p>
          
          {status === 'processing' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                Please wait while we complete the connection to your store. This may take a few moments.
              </p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">
                You'll be redirected to the store connections page shortly.
              </p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">
                You'll be redirected back to try again shortly.
              </p>
            </div>
          )}
          
          <button
            onClick={() => navigate('/connect-store')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Store Connections
          </button>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback; 