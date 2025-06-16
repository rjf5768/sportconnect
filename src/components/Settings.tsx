import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { userDoc } from '../utils/paths';
import { MapPin, Award, Save, X, Search } from 'lucide-react';

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
        updateData.location = selectedLocation;
      }

      await updateDoc(doc(db, userDoc(user.uid)), updateData);
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    } finally {
      setSaving(false);
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
    </div>
  );
}