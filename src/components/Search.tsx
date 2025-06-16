import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit,
  onSnapshot,
  where,
  getDocs,
  doc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { usersCol, postsCol, userDoc } from '../utils/paths';
import { Search as SearchIcon, TrendingUp, Users, Hash, RefreshCw, MapPin, Award } from 'lucide-react';

interface UserData {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount?: number;
  location?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  sportRatings?: {
    tennis?: number;
    basketball?: number;
    soccer?: number;
    football?: number;
    baseball?: number;
    golf?: number;
    swimming?: number;
    running?: number;
  };
}

interface PostData {
  id: string;
  text: string;
  imageUrl?: string;
  userId: string;
  userDisplayName: string;
  userProfileImageUrl?: string;
  userLocation?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  userSportRatings?: {
    tennis?: number;
    basketball?: number;
    soccer?: number;
    football?: number;
    baseball?: number;
    golf?: number;
    swimming?: number;
    running?: number;
  };
  likeCount: number;
  commentCount: number;
  likes: string[];
  createdAt: any;
  score?: number;
  distance?: number;
}

interface CurrentUserProfile {
  location?: {
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  };
  sportRatings?: {
    tennis?: number;
    basketball?: number;
    soccer?: number;
    football?: number;
    baseball?: number;
    golf?: number;
    swimming?: number;
    running?: number;
  };
}

interface SearchProps {
  user: any;
  onViewProfile: (uid: string) => void;
}

// Haversine formula to calculate distance between two points on Earth
const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

export default function Search({ user, onViewProfile }: SearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [recentPosts, setRecentPosts] = useState<PostData[]>([]);
  const [recommendedPosts, setRecommendedPosts] = useState<PostData[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile>({});
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [trendingTopics] = useState([
    'Football', 'Basketball', 'Soccer', 'Tennis', 'Baseball', 'Hockey'
  ]);
  const [activeTab, setActiveTab] = useState('explore');

  useEffect(() => {
    // Load current user's profile for recommendations
    const unsubscribeUser = onSnapshot(doc(db, userDoc(user.uid)), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentUserProfile({
          location: data.location || null,
          sportRatings: data.sportRatings || {}
        });
      }
    });

    // Load recent posts for explore tab
    const q = query(
      collection(db, postsCol()),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const unsubscribePosts = onSnapshot(q, (snap) => {
      setRecentPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostData)));
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [user.uid]);

  // Load recommendations when user profile changes
  useEffect(() => {
    if (currentUserProfile.location || Object.keys(currentUserProfile.sportRatings || {}).length > 0) {
      loadRecommendations();
    }
  }, [currentUserProfile]);

  useEffect(() => {
    if (searchTerm.trim()) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, user.uid]);

  const calculateDistance = (userLoc: any, postUserLoc: any): number => {
    if (!userLoc || !postUserLoc || !userLoc.latitude || !userLoc.longitude || !postUserLoc.latitude || !postUserLoc.longitude) {
      return Infinity;
    }
    
    return calculateHaversineDistance(
      userLoc.latitude,
      userLoc.longitude,
      postUserLoc.latitude,
      postUserLoc.longitude
    );
  };

  const calculateSportRatingDifference = (userRatings: any, postUserRatings: any): number => {
    if (!userRatings || !postUserRatings) return Infinity;
    
    const sports = ['tennis', 'basketball', 'soccer', 'football', 'baseball', 'golf', 'swimming', 'running'];
    let totalDiff = 0;
    let commonSports = 0;
    
    for (const sport of sports) {
      if (userRatings[sport] && postUserRatings[sport]) {
        totalDiff += Math.abs(userRatings[sport] - postUserRatings[sport]);
        commonSports++;
      }
    }
    
    if (commonSports === 0) return Infinity;
    return totalDiff / commonSports;
  };

  const loadRecommendations = async () => {
    setLoadingRecommendations(true);
    
    try {
      // Get all posts
      const postsQuery = query(
        collection(db, postsCol()),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostData));
      
      // Get all users for their profiles
      const usersQuery = query(collection(db, usersCol()));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.reduce((acc, doc) => {
        acc[doc.data().uid] = doc.data();
        return acc;
      }, {} as Record<string, any>);
      
      // Score posts based on location and sport ratings
      const scoredPosts = posts
        .filter(post => post.userId !== user.uid) // Exclude own posts
        .map(post => {
          const postUser = users[post.userId];
          
          // Use stored user location from post if available, otherwise user profile location
          const postUserLocation = post.userLocation || postUser?.location;
          
          const distance = calculateDistance(currentUserProfile.location, postUserLocation);
          const ratingDifference = calculateSportRatingDifference(
            currentUserProfile.sportRatings, 
            post.userSportRatings || postUser?.sportRatings
          );
          
          // Location is more important than rating (weight: 70% location, 30% rating)
          // Convert distance to a score (closer = lower score = better)
          let locationScore = 1000;
          if (distance !== Infinity) {
            // Score based on distance: 0-10km = 0-100, 10-50km = 100-300, 50-200km = 300-600, 200+km = 600-1000
            if (distance <= 10) {
              locationScore = distance * 10; // 0-100
            } else if (distance <= 50) {
              locationScore = 100 + (distance - 10) * 5; // 100-300
            } else if (distance <= 200) {
              locationScore = 300 + (distance - 50) * 2; // 300-600
            } else {
              locationScore = 600 + Math.min(distance - 200, 400); // 600-1000
            }
          }
          
          const ratingScore = ratingDifference === Infinity ? 100 : ratingDifference * 10;
          const totalScore = (locationScore * 0.7) + (ratingScore * 0.3);
          
          return {
            ...post,
            userProfileImageUrl: postUser?.profileImageUrl || '',
            score: totalScore,
            distance: distance === Infinity ? undefined : distance
          };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 15);
      
      setRecommendedPosts(scoredPosts);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

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
        .filter(userData => userData.uid !== user.uid) // Exclude current user
        .map(userData => {
          // Calculate distance for search results too
          if (currentUserProfile.location && userData.location) {
            const distance = calculateDistance(currentUserProfile.location, userData.location);
            return { ...userData, distance: distance === Infinity ? undefined : distance };
          }
          return userData;
        })
        .sort((a, b) => {
          // Sort by distance if available, otherwise alphabetically
          if (a.distance && b.distance) return a.distance - b.distance;
          if (a.distance && !b.distance) return -1;
          if (!a.distance && b.distance) return 1;
          return a.displayName.localeCompare(b.displayName);
        });
      
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

  const formatDistance = (distance?: number): string => {
    if (!distance) return '';
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m away`;
    if (distance < 10) return `${distance.toFixed(1)}km away`;
    return `${Math.round(distance)}km away`;
  };

  const getLocationText = (location: any): string => {
    if (!location) return '';
    return location.formattedAddress || `${location.city}, ${location.state}, ${location.country}`;
  };

  const getSportRatingsText = (ratings: any): string => {
    if (!ratings || Object.keys(ratings).length === 0) return '';
    const ratingsList = Object.entries(ratings)
      .map(([sport, rating]) => `${sport.charAt(0).toUpperCase() + sport.slice(1)}: ${rating}`)
      .slice(0, 2); // Show only first 2 ratings
    return ratingsList.join(', ');
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
                <div 
                  key={userData.id} 
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onViewProfile(userData.uid)}
                >
                  <div className="flex items-center space-x-3">
                    {userData.profileImageUrl ? (
                      <img 
                        src={userData.profileImageUrl} 
                        alt={userData.displayName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {userData.displayName?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-gray-900">{userData.displayName}</p>
                        {userData.distance && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            {formatDistance(userData.distance)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{userData.email}</p>
                      {userData.location && (
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {getLocationText(userData.location)}
                        </div>
                      )}
                      {userData.sportRatings && Object.keys(userData.sportRatings).length > 0 && (
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Award className="h-3 w-3 mr-1" />
                          {getSportRatingsText(userData.sportRatings)}
                        </div>
                      )}
                      {userData.bio && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{userData.bio}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {userData.followersCount || 0} followers
                      </div>
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {recommendedPosts.length > 0 ? 'Recommended for You' : 'Recent Posts'}
                </h2>
                <button
                  onClick={loadRecommendations}
                  disabled={loadingRecommendations}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRecommendations ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Show recommendation status */}
              {(!currentUserProfile.location && Object.keys(currentUserProfile.sportRatings || {}).length === 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-900">Get Better Recommendations</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Set your location and sport ratings in your profile settings to get personalized recommendations based on distance and interests!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loadingRecommendations ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading recommendations...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {(recommendedPosts.length > 0 ? recommendedPosts : recentPosts.slice(0, 10)).map((post) => (
                    <div 
                      key={post.id} 
                      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => onViewProfile(post.userId)}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        {post.userProfileImageUrl ? (
                          <img 
                            src={post.userProfileImageUrl} 
                            alt={post.userDisplayName}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                            {post.userDisplayName?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-semibold text-sm text-gray-900">{post.userDisplayName}</p>
                            {post.distance && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                {formatDistance(post.distance)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{formatTimeAgo(post.createdAt)}</p>
                        </div>
                        {post.score && post.score < 500 && (
                          <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                            Recommended
                          </div>
                        )}
                      </div>
                      <p className="text-gray-800 text-sm line-clamp-3 mb-3">{post.text}</p>
                      {post.imageUrl && (
                        <img 
                          src={post.imageUrl} 
                          alt="Post content" 
                          className="w-full h-32 object-cover rounded-lg mb-3"
                        />
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>❤️ {post.likeCount || 0}</span>
                        <span>💬 {post.commentCount || 0}</span>
                      </div>
                    </div>
                  ))}
                  
                  {recentPosts.length === 0 && recommendedPosts.length === 0 && (
                    <div className="bg-white rounded-xl p-8 text-center">
                      <p className="text-gray-600">No posts to explore yet</p>
                    </div>
                  )}
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