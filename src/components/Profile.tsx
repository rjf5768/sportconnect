import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  runTransaction,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../services/firebase';
import { postsCol, userDoc } from '../utils/paths';
import { Settings, Grid, Heart, Camera, Users } from 'lucide-react';
import Post from './Post';
import Modal from './Modal';
import LikedPosts from './LikedPosts';
import FollowersModal from './FollowersModal';

// This interface defines the structure for a user's profile data
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
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [bio, setBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  
  // Profile image states
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Followers/Following modal states
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  
  const isOwnProfile = currentUser.uid === profileId;

  // Effect to listen for changes to the profile being viewed
  useEffect(() => {
    if (!profileId) return;
    
    setLoading(true);
    console.log('Loading profile for ID:', profileId);
    
    const docRef = doc(db, userDoc(profileId));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      console.log('Profile document exists:', docSnap.exists());
      console.log('Profile document data:', docSnap.data());
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ensure all required fields have default values
        const profileData: UserProfile = {
          uid: data.uid || profileId,
          email: data.email || '',
          displayName: data.displayName || 'Unknown User',
          bio: data.bio || '',
          profileImageUrl: data.profileImageUrl || '',
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          postsCount: data.postsCount || 0,
          followers: data.followers || [],
          following: data.following || [],
          likedPosts: data.likedPosts || [],
          createdAt: data.createdAt
        };
        console.log('Setting viewed profile:', profileData);
        setViewedProfile(profileData);
        if (isOwnProfile) {
          setBio(profileData.bio || '');
        }
      } else {
        console.log('Profile document does not exist for ID:', profileId);
        // If document doesn't exist, try to get info from their posts
        const postsQuery = query(
          collection(db, postsCol()), 
          where('userId', '==', profileId),
          orderBy('createdAt', 'desc')
        );
        
        const unsubscribePosts = onSnapshot(postsQuery, (postsSnap) => {
          let displayName = 'Unknown User';
          let email = '';
          
          if (!postsSnap.empty) {
            // Get display name from the most recent post
            const mostRecentPost = postsSnap.docs[0].data();
            displayName = mostRecentPost.userDisplayName || 'Unknown User';
          }
          
          // Create a minimal profile with the info we have
          setViewedProfile({
            uid: profileId,
            email: email,
            displayName: displayName,
            bio: '',
            profileImageUrl: '',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            followers: [],
            following: [],
            likedPosts: [],
            createdAt: null
          });
          
          unsubscribePosts();
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading profile:', error);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [profileId, isOwnProfile]);
  
  // Effect to listen for changes to the currently logged-in user's profile data (for follow status)
  useEffect(() => {
    if (!currentUser.uid) return;
    const docRef = doc(db, userDoc(currentUser.uid));
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profileData: UserProfile = {
          uid: data.uid || currentUser.uid,
          email: data.email || '',
          displayName: data.displayName || 'Unknown User',
          bio: data.bio || '',
          profileImageUrl: data.profileImageUrl || '',
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          postsCount: data.postsCount || 0,
          followers: data.followers || [],
          following: data.following || [],
          likedPosts: data.likedPosts || [],
          createdAt: data.createdAt
        };
        setCurrentUserProfile(profileData);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !isOwnProfile) return;
    
    const file = e.target.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }
    
    setUploadingImage(true);
    
    try {
      const storage = getStorage();
      const imageRef = ref(storage, `profile-images/${currentUser.uid}/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Update user profile with new image URL
      await updateDoc(doc(db, userDoc(currentUser.uid)), { 
        profileImageUrl: downloadURL 
      });
      
      console.log('Profile image updated successfully');
    } catch (error) {
      console.error('Error uploading profile image:', error);
      alert('There was an error uploading your image. Please try again.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const followUser = async (targetUserId: string) => {
    console.log('Follow button clicked', { isOwnProfile, currentUserProfile, targetUserId, followLoading });
    
    // Prevent multiple simultaneous follow operations
    if (followLoading) {
      console.log('Follow operation already in progress, ignoring click');
      return;
    }
    
    if (isOwnProfile) {
      console.log('Cannot follow own profile');
      return;
    }
    
    if (!currentUserProfile) {
      console.log('No current user profile, cannot follow');
      return;
    }

    setFollowLoading(true); // Disable button during operation
  
    const currentUserRef = doc(db, userDoc(currentUser.uid));
    const targetUserRef = doc(db, userDoc(targetUserId));
    const amFollowing = currentUserProfile.following?.includes(targetUserId);
    
    console.log('Am following:', amFollowing);
  
    try {
      await runTransaction(db, async (transaction) => {
        const currentUserDoc = await transaction.get(currentUserRef);
        const targetUserDoc = await transaction.get(targetUserRef);
        
        if (!currentUserDoc.exists()) {
          throw new Error("Current user document does not exist!");
        }
        
        const currentUserData = currentUserDoc.data();
        const targetUserData = targetUserDoc.exists() ? targetUserDoc.data() : null;
        
        // Double-check the current state from the database to prevent race conditions
        const currentFollowing = currentUserData.following || [];
        const isCurrentlyFollowing = currentFollowing.includes(targetUserId);
        const currentFollowingCount = currentUserData.followingCount || 0;
        
        if (isCurrentlyFollowing) {
          // Unfollow logic
          const newFollowing = currentFollowing.filter((id: string) => id !== targetUserId);
          transaction.update(currentUserRef, {
            following: newFollowing,
            followingCount: Math.max(0, currentFollowingCount - 1)
          });
          
          // Update target user's followers if their document exists
          if (targetUserData) {
            const targetFollowers = targetUserData.followers || [];
            const targetFollowersCount = targetUserData.followersCount || 0;
            const newTargetFollowers = targetFollowers.filter((id: string) => id !== currentUser.uid);
            
            transaction.update(targetUserRef, {
              followers: newTargetFollowers,
              followersCount: Math.max(0, targetFollowersCount - 1)
            });
          }
        } else {
          // Follow logic
          const newFollowing = [...currentFollowing, targetUserId];
          transaction.update(currentUserRef, {
            following: newFollowing,
            followingCount: currentFollowingCount + 1
          });
          
          // Update target user's followers
          if (targetUserData) {
            const targetFollowers = targetUserData.followers || [];
            const targetFollowersCount = targetUserData.followersCount || 0;
            const newTargetFollowers = [...targetFollowers, currentUser.uid];
            
            transaction.update(targetUserRef, {
              followers: newTargetFollowers,
              followersCount: targetFollowersCount + 1
            });
          } else {
            // Create target user document if it doesn't exist
            transaction.set(targetUserRef, {
              uid: targetUserId,
              email: '',
              displayName: viewedProfile?.displayName || 'Unknown User',
              bio: '',
              profileImageUrl: '',
              followersCount: 1,
              followingCount: 0,
              postsCount: 0,
              followers: [currentUser.uid],
              following: [],
              likedPosts: [],
              createdAt: new Date()
            });
          }
        }
      });
      
      console.log('Follow/unfollow completed successfully');
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      alert('There was an error with the follow operation. Please try again.');
    } finally {
      setFollowLoading(false); // Re-enable button
    }
  };

  const handleViewProfile = (uid: string) => {
    // This function can be used if you need to navigate to another profile from within this profile
    // For now, it's just a placeholder since we're already in the profile view
    console.log('Navigate to profile:', uid);
  };
  
  // A loading state while the viewed profile is being fetched
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (!viewedProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Profile not found</p>
      </div>
    );
  }
  
  // Determine if the current user is following the viewed profile
  const isFollowing = currentUserProfile?.following?.includes(profileId);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              {viewedProfile.profileImageUrl ? (
                <img 
                  src={viewedProfile.profileImageUrl} 
                  alt={viewedProfile.displayName}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                  {viewedProfile.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              
              {isOwnProfile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 shadow-lg transition-colors disabled:opacity-50"
                  title="Change profile picture"
                >
                  {uploadingImage ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
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
              disabled={!currentUserProfile || followLoading}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isFollowing 
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {followLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  <span>Loading...</span>
                </div>
              ) : !currentUserProfile ? (
                'Loading...'
              ) : (
                isFollowing ? 'Unfollow' : 'Follow'
              )}
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
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">{userPosts.length}</div>
            <div className="text-sm text-gray-600">Posts</div>
          </div>
          <button 
            onClick={() => setShowFollowersModal(true)}
            className="text-center hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors"
          >
            <div className="text-xl font-bold text-gray-900">{viewedProfile.followersCount || 0}</div>
            <div className="text-sm text-gray-600">Followers</div>
          </button>
          <button 
            onClick={() => setShowFollowingModal(true)}
            className="text-center hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors"
          >
            <div className="text-xl font-bold text-gray-900">{viewedProfile.followingCount || 0}</div>
            <div className="text-sm text-gray-600">Following</div>
          </button>
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
            : userPosts.map((post) => <Post key={post.id} post={post} user={currentUser} onViewProfile={handleViewProfile} />)
          }
        </div>
      )}

      {activeTab === 'liked' && <LikedPosts user={currentUser} likedPostIds={viewedProfile.likedPosts || []} onViewProfile={handleViewProfile} />}

      {/* Settings Modal (only for own profile) */}
      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="Settings">
        <div className="text-center py-8"><Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">Settings coming soon!</p></div>
      </Modal>

      {/* Followers Modal */}
      <FollowersModal 
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        title="Followers"
        userIds={viewedProfile.followers || []}
        onViewProfile={handleViewProfile}
      />

      {/* Following Modal */}
      <FollowersModal 
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        title="Following"
        userIds={viewedProfile.following || []}
        onViewProfile={handleViewProfile}
      />
    </div>
  );
}