import React, { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { userDoc, postsCol, commentsCol } from '../utils/paths';
import { MapPin, Award, Save, X, Search, Trash2, AlertTriangle } from 'lucide-react';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  followers: string[];
  following: string[];
  likedPosts: string[];
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
  createdAt: any;
}

interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userProfile: UserProfile;
}

const SPORTS = [
  { key: 'tennis', label: 'Tennis (UTR Rating)', max: 16, step: 0.1 },
  { key: 'basketball', label: 'Basketball (1-10)', max: 10, step: 0.1 },
  { key: 'soccer', label: 'Soccer (1-10)', max: 10, step: 0.1 },
  { key: 'football', label: 'Football (1-10)', max: 10, step: 0.1 },
  { key: 'baseball', label: 'Baseball (1-10)', max: 10, step: 0.1 },
  { key: 'golf', label: 'Golf Handicap', max: 54, step: 0.1 },
  { key: 'swimming', label: 'Swimming (1-10)', max: 10, step: 0.1 },
  { key: 'running', label: 'Running (1-10)', max: 10, step: 0.1 },
];

export default function Settings({ isOpen, onClose, user, userProfile }: SettingsProps) {
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    city: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
    formattedAddress: string;
  } | null>(null);
  
  const [sportRatings, setSportRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (userProfile?.location) {
      setSelectedLocation(userProfile.location);
      setLocationSearch(userProfile.location.formattedAddress || 
        `${userProfile.location.city}, ${userProfile.location.state}, ${userProfile.location.country}`);
    }
    
    if (userProfile?.sportRatings) {
      setSportRatings(userProfile.sportRatings);
    }
  }, [userProfile]);

  // Search locations with debouncing
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (locationSearch.length > 2) {
        searchLocations(locationSearch);
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [locationSearch]);

  const searchLocations = async (query: string) => {
    if (query.length < 3) return;
    
    setSearchingLocations(true);
    try {
      // Using Nominatim (OpenStreetMap) geocoding API - free and reliable
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      
      // Filter to get cities/towns only and format results
      const suggestions: LocationSuggestion[] = data
        .filter((item: any) => 
          item.type === 'city' || 
          item.type === 'town' || 
          item.type === 'village' || 
          item.class === 'place' ||
          (item.address && (item.address.city || item.address.town || item.address.village))
        )
        .slice(0, 5);
      
      setLocationSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Error searching locations:', error);
    } finally {
      setSearchingLocations(false);
    }
  };

  const selectLocation = (suggestion: LocationSuggestion) => {
    const city = suggestion.address.city || suggestion.address.town || suggestion.address.village || '';
    const state = suggestion.address.state || '';
    const country = suggestion.address.country || '';
    
    const location = {
      city,
      state,
      country,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
      formattedAddress: suggestion.display_name
    };
    
    setSelectedLocation(location);
    setLocationSearch(suggestion.display_name);
    setShowSuggestions(false);
  };

  const handleSportRatingChange = (sport: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setSportRatings(prev => ({
        ...prev,
        [sport]: numValue
      }));
    } else if (value === '') {
      setSportRatings(prev => {
        const newRatings = { ...prev };
        delete newRatings[sport];
        return newRatings;
      });
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocode to get address details
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          const state = data.address?.state || '';
          const country = data.address?.country || '';
          
          const location = {
            city,
            state,
            country,
            latitude,
            longitude,
            formattedAddress: data.display_name || `${city}, ${state}, ${country}`
          };
          
          setSelectedLocation(location);
          setLocationSearch(location.formattedAddress);
        } catch (error) {
          console.error('Error getting location details:', error);
          // Fallback: just use coordinates
          const location = {
            city: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            state: '',
            country: '',
            latitude,
            longitude,
            formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          };
          setSelectedLocation(location);
          setLocationSearch(location.formattedAddress);
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please search for your city manually.');
        setGettingLocation(false);
      }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      const updateData: any = {
        sportRatings: sportRatings
      };

      // Only add location if one is selected
      if (selectedLocation) {
        updateData.location = {
          city: selectedLocation.city,
          state: selectedLocation.state,
          country: selectedLocation.country,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          formattedAddress: selectedLocation.formattedAddress
        };
      }

      const userDocRef = doc(db, userDoc(user.uid));
      
      try {
        await updateDoc(userDocRef, updateData);
      } catch (error: any) {
        // If document doesn't exist, create it
        if (error.code === 'not-found') {
          const fullUserData = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Unknown User',
            bio: userProfile?.bio || '',
            profileImageUrl: userProfile?.profileImageUrl || '',
            followersCount: userProfile?.followersCount || 0,
            followingCount: userProfile?.followingCount || 0,
            postsCount: userProfile?.postsCount || 0,
            followers: userProfile?.followers || [],
            following: userProfile?.following || [],
            likedPosts: userProfile?.likedPosts || [],
            ...updateData,
            createdAt: new Date(),
          };
          await setDoc(userDocRef, fullUserData);
        } else {
          throw error;
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type "DELETE" to confirm account deletion.');
      return;
    }

    setDeleteLoading(true);

    try {
      const batch = writeBatch(db);
      
      // 1. Delete all user's posts
      const postsQuery = query(collection(db, postsCol()), where('userId', '==', user.uid));
      const postsSnapshot = await getDocs(postsQuery);
      
      for (const postDoc of postsSnapshot.docs) {
        // Delete all comments for each post
        const commentsQuery = query(collection(db, commentsCol(postDoc.id)));
        const commentsSnapshot = await getDocs(commentsQuery);
        
        commentsSnapshot.docs.forEach(commentDoc => {
          batch.delete(commentDoc.ref);
        });
        
        // Delete the post
        batch.delete(postDoc.ref);
      }
      
      // 2. Remove user from other users' followers/following lists
      const allUsersQuery = query(collection(db, 'artifacts/sportconnect/public/data/users'));
      const allUsersSnapshot = await getDocs(allUsersQuery);
      
      allUsersSnapshot.docs.forEach(userDocSnap => {
        const userData = userDocSnap.data();
        let needsUpdate = false;
        const updates: any = {};
        
        // Remove from followers list
        if (userData.followers && userData.followers.includes(user.uid)) {
          updates.followers = userData.followers.filter((id: string) => id !== user.uid);
          updates.followersCount = Math.max(0, (userData.followersCount || 0) - 1);
          needsUpdate = true;
        }
        
        // Remove from following list
        if (userData.following && userData.following.includes(user.uid)) {
          updates.following = userData.following.filter((id: string) => id !== user.uid);
          updates.followingCount = Math.max(0, (userData.followingCount || 0) - 1);
          needsUpdate = true;
        }
        
        // Remove from liked posts
        if (userData.likedPosts && Array.isArray(userData.likedPosts)) {
          // Remove any posts by this user from other users' liked posts
          const postsToRemove = postsSnapshot.docs.map(doc => doc.id);
          const filteredLikedPosts = userData.likedPosts.filter((postId: string) => !postsToRemove.includes(postId));
          
          if (filteredLikedPosts.length !== userData.likedPosts.length) {
            updates.likedPosts = filteredLikedPosts;
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          batch.update(userDocSnap.ref, updates);
        }
      });
      
      // 3. Delete user profile document
      batch.delete(doc(db, userDoc(user.uid)));
      
      // Commit all deletions
      await batch.commit();
      
      // 4. Delete Firebase Auth user (this should be last)
      await deleteUser(auth.currentUser!);
      
      alert('Your account has been successfully deleted.');
      
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('There was an error deleting your account. Please try again or contact support.');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-8">
            {/* Location Section */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <MapPin className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Set your location for accurate distance-based recommendations. We use coordinates for precise calculations.
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={getCurrentLocation}
                  disabled={gettingLocation}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {gettingLocation ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Getting Location...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4" />
                      <span>Use Current Location</span>
                    </>
                  )}
                </button>
                
                <div className="text-center text-gray-500 text-sm">or</div>
                
                {/* Location Search */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      placeholder="Search for your city..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    {searchingLocations && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Location Suggestions */}
                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {locationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.place_id}
                          onClick={() => selectLocation(suggestion)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {suggestion.address.city || suggestion.address.town || suggestion.address.village}
                                {suggestion.address.state && `, ${suggestion.address.state}`}
                              </p>
                              <p className="text-xs text-gray-500">{suggestion.address.country}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Selected Location Display */}
                {selectedLocation && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">Selected Location:</p>
                        <p className="text-sm text-green-700">{selectedLocation.formattedAddress}</p>
                        <p className="text-xs text-green-600">
                          Coordinates: {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sport Ratings Section */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Award className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900">Sport Ratings</h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-6">
                Enter your skill level for different sports. This helps us recommend relevant content and connect you with players of similar skill levels.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SPORTS.map((sport) => (
                  <div key={sport.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {sport.label}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={sport.max}
                      step={sport.step}
                      value={sportRatings[sport.key] || ''}
                      onChange={(e) => handleSportRatingChange(sport.key, e.target.value)}
                      placeholder={`0-${sport.max}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Delete Account Section */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex items-center space-x-2 mb-4">
                <Trash2 className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-red-900 mb-2">Delete Account</h4>
                    <p className="text-sm text-red-700 mb-4">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <ul className="text-sm text-red-600 mb-4 list-disc list-inside space-y-1">
                      <li>All your posts and comments will be deleted</li>
                      <li>You will be removed from other users' followers/following lists</li>
                      <li>Your profile and all settings will be permanently removed</li>
                      <li>This action cannot be reversed</li>
                    </ul>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-4">
                  Are you absolutely sure you want to delete your account? This will:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 mb-4">
                  <li>Permanently delete all your posts and comments</li>
                  <li>Remove you from other users' followers/following lists</li>
                  <li>Delete your profile and all personal data</li>
                  <li>Sign you out immediately</li>
                </ul>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Warning:</strong> This action is permanent and cannot be reversed.
                  </p>
                </div>
                
                <p className="text-sm text-gray-700 mb-2">
                  To confirm, please type <strong>DELETE</strong> in the box below:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {deleteLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}