import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol, userDoc, usersCol } from '../utils/paths';
import { Settings, Users, Grid, Heart } from 'lucide-react';
import Post from './Post';
import Modal from './Modal';

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
  createdAt: any;
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

export default function Profile({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState('posts');
  const [userPosts, setUserPosts] = useState<PostData[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bio, setBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);

  useEffect(() => {
    // Load user profile
    const loadProfile = async () => {
      const docRef = doc(db, userDoc(user.uid));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setUserProfile(data);
        setBio(data.bio || '');
      } else {
        // Create profile if it doesn't exist
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          bio: '',
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          followers: [],
          following: [],
          createdAt: serverTimestamp(),
        };
        await setDoc(docRef, newProfile);
        setUserProfile(newProfile);
      }
    };

    loadProfile();

    // Load user posts
    const q = query(
      collection(db, postsCol()), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostData));
      setUserPosts(posts);
      
      // Update posts count
      updateDoc(doc(db, userDoc(user.uid)), {
        postsCount: posts.length
      });
    });

    return unsubscribe;
  }, [user.uid, user.email, user.displayName]);

  const updateBio = async () => {
    try {
      await updateDoc(doc(db, userDoc(user.uid)), {
        bio: bio.trim()
      });
      setEditingBio(false);
      setUserProfile((prev: UserProfile | null) => 
        prev ? { ...prev, bio: bio.trim() } : null
      );
    } catch (error) {
      console.error('Error updating bio:', error);
    }
  };

  const followUser = async (targetUserId: string) => {
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, userDoc(user.uid));
        const targetRef = doc(db, userDoc(targetUserId));
        
        const userSnap = await tx.get(userRef);
        const targetSnap = await tx.get(targetRef);
        
        if (userSnap.exists() && targetSnap.exists()) {
          const userData = userSnap.data();
          const targetData = targetSnap.data();
          
          const userFollowing: string[] = userData.following || [];
          const targetFollowers: string[] = targetData.followers || [];
          
          const isFollowing = userFollowing.includes(targetUserId);
          
          if (isFollowing) {
            // Unfollow
            tx.update(userRef, {
              following: userFollowing.filter(id => id !== targetUserId),
              followingCount: Math.max(0, (userData.followingCount || 0) - 1)
            });
            tx.update(targetRef, {
              followers: targetFollowers.filter(id => id !== user.uid),
              followersCount: Math.max(0, (targetData.followersCount || 0) - 1)
            });
          } else {
            // Follow
            tx.update(userRef, {
              following: [...userFollowing, targetUserId],
              followingCount: (userData.followingCount || 0) + 1
            });
            tx.update(targetRef, {
              followers: [...targetFollowers, user.uid],
              followersCount: (targetData.followersCount || 0) + 1
            });
          }
        }
      });
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
    }
  };

  const stats = [
    { label: 'Posts', value: userProfile?.postsCount || 0 },
    { label: 'Followers', value: userProfile?.followersCount || 0, onClick: () => setShowFollowers(true) },
    { label: 'Following', value: userProfile?.followingCount || 0, onClick: () => setShowFollowing(true) },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {user.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.displayName}</h1>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <Settings className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Bio */}
        <div className="mb-4">
          {editingBio ? (
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
                <button
                  onClick={updateBio}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingBio(false);
                    setBio(userProfile?.bio || '');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-800 mb-2">
                {userProfile?.bio || 'No bio yet'}
              </p>
              <button
                onClick={() => setEditingBio(true)}
                className="text-indigo-600 text-sm hover:text-indigo-700"
              >
                {userProfile?.bio ? 'Edit bio' : 'Add bio'}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex space-x-8">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className={`text-center ${stat.onClick ? 'hover:text-indigo-600' : ''}`}
            >
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium ${
            activeTab === 'posts'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          <Grid className="h-5 w-5" />
          <span>Posts</span>
        </button>
        <button
          onClick={() => setActiveTab('liked')}
          className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium ${
            activeTab === 'liked'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          <Heart className="h-5 w-5" />
          <span>Liked</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'posts' && (
        <div className="space-y-6">
          {userPosts.length === 0 ? (
            <div className="text-center py-12">
              <Grid className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No posts yet</p>
            </div>
          ) : (
            userPosts.map((post) => (
              <Post key={post.id} post={post} user={user} />
            ))
          )}
        </div>
      )}

      {activeTab === 'liked' && (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Liked posts coming soon!</p>
        </div>
      )}

      {/* Followers Modal */}
      <Modal
        isOpen={showFollowers}
        onClose={() => setShowFollowers(false)}
        title="Followers"
      >
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Followers list coming soon!</p>
        </div>
      </Modal>

      {/* Following Modal */}
      <Modal
        isOpen={showFollowing}
        onClose={() => setShowFollowing(false)}
        title="Following"
      >
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Following list coming soon!</p>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
      >
        <div className="text-center py-8">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Settings coming soon!</p>
        </div>
      </Modal>
    </div>
  );
}