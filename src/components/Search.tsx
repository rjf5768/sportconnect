import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit,
  onSnapshot,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { usersCol, postsCol } from '../utils/paths';
import { Search as SearchIcon, TrendingUp, Users, Hash } from 'lucide-react';

interface UserData {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  bio?: string;
  followersCount?: number;
}

interface PostData {
  id: string;
  text: string;
  userId: string;
  userDisplayName: string;
  likeCount: number;
  commentCount: number;
  likes: string[];
  createdAt: any;
}

export default function Search({ user }: { user: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [recentPosts, setRecentPosts] = useState<PostData[]>([]);
  const [trendingTopics] = useState([
    'Football', 'Basketball', 'Soccer', 'Tennis', 'Baseball', 'Hockey'
  ]);
  const [activeTab, setActiveTab] = useState('explore');

  useEffect(() => {
    // Load recent posts for explore tab
    const q = query(
      collection(db, postsCol()),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    return onSnapshot(q, (snap) => {
      setRecentPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostData)));
    });
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, user.uid]);

  const searchUsers = async () => {
    try {
      const q = query(collection(db, usersCol()));
      const querySnapshot = await getDocs(q);
      
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserData))
        .filter(userData => 
          userData.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          userData.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .filter(userData => userData.uid !== user.uid); // Exclude current user
      
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const formatTimeAgo = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Search Results */}
      {searchTerm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Users</h2>
          </div>
          {searchResults.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {searchResults.map((userData) => (
                <div key={userData.id} className="p-4 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {userData.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{userData.displayName}</p>
                      <p className="text-sm text-gray-600">{userData.email}</p>
                      {userData.bio && (
                        <p className="text-sm text-gray-500 mt-1">{userData.bio}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {userData.followersCount || 0} followers
                      </div>
                      <button className="mt-1 px-4 py-1 bg-indigo-600 text-white text-sm rounded-full hover:bg-indigo-700 transition-colors">
                        Follow
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {!searchTerm && (
        <>
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('explore')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'explore'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'trending'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Trending
            </button>
          </div>

          {/* Explore Tab */}
          {activeTab === 'explore' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Posts</h2>
              {recentPosts.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <p className="text-gray-600">No posts to explore yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {recentPosts.slice(0, 10).map((post) => (
                    <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                          {post.userDisplayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{post.userDisplayName}</p>
                          <p className="text-xs text-gray-500">{formatTimeAgo(post.createdAt)}</p>
                        </div>
                      </div>
                      <p className="text-gray-800 text-sm line-clamp-3">{post.text}</p>
                      <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                        <span>❤️ {post.likeCount || 0}</span>
                        <span>💬 {post.commentCount || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trending Tab */}
          {activeTab === 'trending' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Trending Topics
              </h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {trendingTopics.map((topic, index) => (
                  <div key={topic} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Hash className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900">#{topic}</p>
                          <p className="text-sm text-gray-500">{Math.floor(Math.random() * 1000) + 100} posts</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">#{index + 1}</div>
                        <div className="text-xs text-gray-500">Trending</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}