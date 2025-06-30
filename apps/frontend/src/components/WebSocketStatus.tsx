import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface WebSocketStatusProps {
  isConnected: boolean;
  lastUpdate?: Date | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
  isConnected,
  lastUpdate,
  showLabel = true,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isConnected ? (
        <>
          <Wifi className={`${sizeClasses[size]} text-green-500`} />
          {showLabel && (
            <span className={`${textSizeClasses[size]} text-green-600 font-medium`}>
              Real-time Connected
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className={`${sizeClasses[size]} text-red-500`} />
          {showLabel && (
            <span className={`${textSizeClasses[size]} text-red-600 font-medium`}>
              Disconnected
            </span>
          )}
        </>
      )}
      
      {lastUpdate && (
        <span className={`${textSizeClasses[size]} text-gray-500 ml-1`}>
          ({lastUpdate.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
};

export default WebSocketStatus; 