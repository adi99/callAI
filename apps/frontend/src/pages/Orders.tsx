import React from 'react';
import { ShoppingCart } from 'lucide-react';

const Orders: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-green-600 rounded-full">
            <ShoppingCart className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-2">
              Track and manage customer orders handled by your AI assistant
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Orders Coming Soon</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            This section will display all orders processed through your AI assistant, 
            including status updates and customer communications.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Orders;