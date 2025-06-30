import React, { useEffect, useState } from 'react';
import { MessageCircle, Clock, User, Phone, Mail, Tag, AlertCircle, RefreshCw, Filter, Search } from 'lucide-react';
import { apiService, Conversation } from '../services/api';

const Conversations: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.getConversations();
      if (response.success && response.data) {
        setConversations(response.data);
      } else {
        setError(response.error || 'Failed to load conversations');
      }
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Conversations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatConversationStatus = (status: string): { label: string; color: string } => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: 'bg-blue-100 text-blue-800' };
      case 'resolved':
        return { label: 'Resolved', color: 'bg-green-100 text-green-800' };
      case 'escalated':
        return { label: 'Escalated', color: 'bg-red-100 text-red-800' };
      case 'abandoned':
        return { label: 'Abandoned', color: 'bg-gray-100 text-gray-800' };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const formatPriority = (priority: string): { label: string; color: string } => {
    switch (priority) {
      case 'urgent':
        return { label: 'Urgent', color: 'bg-red-100 text-red-800' };
      case 'high':
        return { label: 'High', color: 'bg-orange-100 text-orange-800' };
      case 'medium':
        return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' };
      case 'low':
        return { label: 'Low', color: 'bg-gray-100 text-gray-800' };
      default:
        return { label: 'Normal', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'voice':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
      case 'whatsapp':
      case 'chat':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = !searchTerm || 
      conversation.customer_phone?.includes(searchTerm) ||
      conversation.customer_email?.includes(searchTerm) ||
      conversation.id.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || conversation.status === statusFilter;
    const matchesChannel = channelFilter === 'all' || conversation.channel === channelFilter;
    
    return matchesSearch && matchesStatus && matchesChannel;
  });

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-purple-600 rounded-full">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Conversations</h1>
            <p className="text-gray-600 mt-2">
              Review AI assistant conversations and customer interactions
            </p>
            </div>
          </div>
          
          <button
            onClick={loadConversations}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Conversations</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={loadConversations}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by phone, email, or conversation ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
            
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Channels</option>
              <option value="voice">Voice</option>
              <option value="chat">Chat</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Conversations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Conversation History ({filteredConversations.length} conversations)
          </h3>
        </div>
        
        {filteredConversations.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredConversations.map((conversation) => {
              const status = formatConversationStatus(conversation.status);
              const priority = formatPriority(conversation.priority);
              
              return (
                <div key={conversation.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                        {getChannelIcon(conversation.channel)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            Conversation #{conversation.id.substring(0, 8)}
                          </h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priority.color}`}>
                            {priority.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                          <div className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{conversation.customer_phone || conversation.customer_email || 'Unknown Customer'}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{getTimeAgo(conversation.start_time)}</span>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <span className="capitalize">{conversation.channel}</span>
                          </div>
                        </div>
                        
                        {conversation.tags && conversation.tags.length > 0 && (
                          <div className="flex items-center space-x-2 mb-2">
                            <Tag className="h-4 w-4 text-gray-400" />
                            <div className="flex space-x-1">
                              {conversation.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
                                >
                                  {tag}
                                </span>
                              ))}
                              {conversation.tags.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{conversation.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-500">
                          Started: {formatDateTime(conversation.start_time)}
                          {conversation.end_time && (
                            <span> • Ended: {formatDateTime(conversation.end_time)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="text-center py-12">
          <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Conversations Found</h3>
          <p className="text-gray-600 max-w-md mx-auto">
              {conversations.length === 0 
                ? "Conversation history will appear here once your AI assistant starts handling customer interactions."
                : "No conversations match your current search criteria. Try adjusting your filters."
              }
          </p>
        </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;