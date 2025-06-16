import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { userDoc } from '../utils/paths';
import { MapPin, Award, Save, X } from 'lucide-react';

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
    latitude?: number;
    longitude?: number;
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
  const [location, setLocation] = useState({
    city: '',
    state: '',
    country: ''
  });
  
  const [sportRatings, setSportRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    if (userProfile?.location) {
      setLocation({
        city: userProfile.location.city || '',
        state: userProfile.location.state || '',
        country: userProfile.location.country || ''
      });
    }
    
    if (userProfile?.sportRatings) {
      setSportRatings(userProfile.sportRatings);
    }
  }, [userProfile]);

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
          // Use a reverse geocoding service to get location details
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          
          setLocation({
            city: data.city || data.locality || '',
            state: data.principalSubdivision || '',
            country: data.countryName || ''
          });
        } catch (error) {
          console.error('Error getting location details:', error);
          // Just use coordinates if reverse geocoding fails
          setLocation({
            city: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            state: '',
            country: ''
          });
        } finally {
          setGettingLocation(false);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your location. Please enter it manually.');
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

      // Only add location if at least city is provided
      if (location.city.trim()) {
        updateData.location = {
          city: location.city.trim(),
          state: location.state.trim(),
          country: location.country.trim()
        };
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
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={location.city}
                      onChange={(e) => setLocation(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="e.g., New York"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Province
                    </label>
                    <input
                      type="text"
                      value={location.state}
                      onChange={(e) => setLocation(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="e.g., NY"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={location.country}
                      onChange={(e) => setLocation(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="e.g., USA"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
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
            disabled={saving || !location.city.trim()}
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