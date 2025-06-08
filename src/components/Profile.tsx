import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol, userDoc } from '../utils/paths';
import { Settings, Grid, Heart } from 'lucide-react';
import Post from './Post';
import Modal from './Modal';
import LikedPosts from './LikedPosts';

// This interface defines the structure for a user's profile data
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  followers: string[];
  following: string[];
  likedPosts: string[];
  createdAt: any;
}

// This interface defines the structure for a post's data
interface PostData {
  id: string;
  text: string;
  userId: string;
  userDisplayName: string;
  likeCount: number;
  commentCount: number;
  likes: string[];
  createdAt: any;
  imageUrl?: string;
}

// The props for the Profile component
interface ProfileProps {
  currentUser: any; // The currently logged-in user from Firebase Auth
  profileId: string;   // The UID of the profile being viewed
}

export default function Profile({ currentUser, profileId }: ProfileProps) {
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState<PostData[]>([]);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [bio, setBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  
  const isOwnProfile = currentUser.uid === profileId;

  // Effect to listen for changes to the profile being viewed
  useEffect(() => {
    if (!profileId) return;
    const docRef = doc(db, userDoc(profileId));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setViewedProfile(data);
        if (isOwnProfile) {
          setBio(data.bio || '');
        }
      } else {
        setViewedProfile(null); // Handle case where profile doesn't exist
      }
    });
    return unsubscribe;
  }, [profileId, isOwnProfile]);
  
  // Effect to listen for changes to the currently logged-in user's profile data (for follow status)
  useEffect(() => {
    if (!currentUser.uid) return;
    const docRef = doc(db, userDoc(currentUser.uid));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserProfile(docSnap.data() as UserProfile);
      }
    });
    return unsubscribe;
  }, [currentUser.uid]);

  // Effect to load the posts of the user whose profile is being viewed
  useEffect(() => {
    if (!profileId) return;
    const q = query(
      collection(db, postsCol()), 
      where('userId', '==', profileId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setUserPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostData)));
    });

    return unsubscribe;
  }, [profileId]);

  const updateBio = async () => {
    if (!isOwnProfile) return;
    try {
      await updateDoc(doc(db, userDoc(currentUser.uid)), { bio: bio.trim() });
      setEditingBio(false);
    } catch (error) {
      console.error('Error updating bio:', error);
    }
  };

  const followUser = async (targetUserId: string) => {
    if (isOwnProfile || !currentUserProfile) return;
  
    const userRef = doc(db, userDoc(currentUser.uid));
    const amFollowing = currentUserProfile.following?.includes(targetUserId);
  
    try {
      if (amFollowing) {
        // Unfollow logic: Only update the current user's document
        await updateDoc(userRef, {
          following: (currentUserProfile.following || []).filter(id => id !== targetUserId),
          followingCount: Math.max(0, (currentUserProfile.followingCount || 0) - 1)
        });
      } else {
        // Follow logic: Only update the current user's document
        await updateDoc(userRef, {
          following: [...(currentUserProfile.following || []), targetUserId],
          followingCount: (currentUserProfile.followingCount || 0) + 1
        });
      }
      // Note: This simplified approach won't update the other user's follower count.
      // A Cloud Function is the recommended way to handle that.
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
    }
  };
  
  // A loading state while the viewed profile is being fetched
  if (!viewedProfile) {
    return <p className="p-10 text-center">Loading profile...</p>;
  }
  
  // Determine if the current user is following the viewed profile
  const isFollowing = currentUserProfile?.following?.includes(profileId);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {viewedProfile.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{viewedProfile.displayName}</h1>
              <p className="text-gray-600">{viewedProfile.email}</p>
            </div>
          </div>
          {isOwnProfile ? (
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-full">
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          ) : (
            <button 
              onClick={() => followUser(profileId)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                isFollowing 
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
        
        {/* Bio Section */}
        <div className="mb-4">
          {isOwnProfile && editingBio ? (
            <div className="space-y-2">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a bio..."
                className="w-full p-2 border border-gray-200 rounded-lg resize-none"
                rows={3}
                maxLength={150}
              />
              <div className="flex space-x-2">
                <button onClick={updateBio} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Save</button>
                <button onClick={() => { setEditingBio(false); setBio(viewedProfile.bio || ''); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-800 mb-2">{viewedProfile.bio || 'No bio yet'}</p>
              {isOwnProfile && <button onClick={() => setEditingBio(true)} className="text-indigo-600 text-sm hover:text-indigo-700">{viewedProfile.bio ? 'Edit bio' : 'Add bio'}</button>}
            </div>
          )}
        </div>
        
        {/* Stats Section */}
        <div className="flex space-x-8">
          <div className="text-center"><div className="text-xl font-bold text-gray-900">{userPosts.length}</div><div className="text-sm text-gray-600">Posts</div></div>
          <div className="text-center"><div className="text-xl font-bold text-gray-900">{viewedProfile.followersCount || 0}</div><div className="text-sm text-gray-600">Followers</div></div>
          <div className="text-center"><div className="text-xl font-bold text-gray-900">{viewedProfile.followingCount || 0}</div><div className="text-sm text-gray-600">Following</div></div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setActiveTab('posts')} className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium ${activeTab === 'posts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}><Grid className="h-5 w-5" /><span>Posts</span></button>
        <button onClick={() => setActiveTab('liked')} className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium ${activeTab === 'liked' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}><Heart className="h-5 w-5" /><span>Liked ({(viewedProfile.likedPosts || []).length})</span></button>
      </div>

      {/* Tab Content */}
      {activeTab === 'posts' && (
        <div className="space-y-6">
          {userPosts.length === 0 
            ? <div className="text-center py-12"><Grid className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">This user hasn't posted yet.</p></div>
            : userPosts.map((post) => <Post key={post.id} post={post} user={currentUser} onViewProfile={() => {}} />)
          }
        </div>
      )}

      {activeTab === 'liked' && <LikedPosts user={currentUser} likedPostIds={viewedProfile.likedPosts || []} />}

      {/* Settings Modal (only for own profile) */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Settings">
        <div className="text-center py-8"><Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">Settings coming soon!</p></div>
      </Modal>
    </div>
  );
}