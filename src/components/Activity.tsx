import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol, userDoc } from '../utils/paths';
import { Heart, Users } from 'lucide-react';
import Post from './Post';

interface PostData {
  id: string;
  text: string;
  imageUrl?: string;
  userId: string;
  userDisplayName: string;
  likeCount: number;
  commentCount: number;
  likes: string[];
  createdAt: any;
}

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

interface ActivityProps {
  user: any;
  onViewProfile: (uid: string) => void;
}

export default function Activity({ user, onViewProfile }: ActivityProps) {
  const [followingPosts, setFollowingPosts] = useState<PostData[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current user's profile to access following list
  useEffect(() => {
    if (!user?.uid) return;
    
    const userDocRef = doc(db, userDoc(user.uid));
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profileData: UserProfile = {
          uid: data.uid || user.uid,
          email: data.email || '',
          displayName: data.displayName || 'Unknown User',
          bio: data.bio || '',
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          postsCount: data.postsCount || 0,
          followers: data.followers || [],
          following: data.following || [],
          likedPosts: data.likedPosts || [],
          createdAt: data.createdAt
        };
        setUserProfile(profileData);
      }
    });
    
    return unsubscribe;
  }, [user?.uid]);

  // Get posts from users that the current user is following
  useEffect(() => {
    if (!userProfile || !userProfile.following || userProfile.following.length === 0) {
      setFollowingPosts([]);
      setLoading(false);
      return;
    }

    // Create query to get posts from followed users
    const q = query(
      collection(db, postsCol()),
      where('userId', 'in', userProfile.following),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const posts = snap.docs.map((d) => ({ 
        id: d.id, 
        ...d.data() 
      } as PostData));
      setFollowingPosts(posts);
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile?.following]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading activity feed...</p>
      </div>
    );
  }

  if (!userProfile?.following || userProfile.following.length === 0) {
    return (
      <div className="text-center py-20">
        <Users className="mx-auto mb-4 h-16 w-16 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Yet</h3>
        <p className="text-gray-600 mb-4">Follow other users to see their posts here!</p>
        <p className="text-sm text-gray-500">
          Go to the Search tab to find and follow other sports enthusiasts.
        </p>
      </div>
    );
  }

  if (followingPosts.length === 0) {
    return (
      <div className="text-center py-20">
        <Heart className="mx-auto mb-4 h-16 w-16 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Recent Posts</h3>
        <p className="text-gray-600 mb-2">
          None of the {userProfile.following.length} people you follow have posted recently.
        </p>
        <p className="text-sm text-gray-500">
          Check back later for new content!
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Activity Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center space-x-3">
          <Heart className="h-6 w-6 text-indigo-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Activity Feed</h2>
            <p className="text-sm text-gray-600">
              Latest posts from {userProfile.following.length} people you follow
            </p>
          </div>
        </div>
      </div>

      {/* Posts from Following */}
      <div className="space-y-6">
        {followingPosts.map((post) => (
          <Post 
            key={post.id} 
            post={post} 
            user={user} 
            onViewProfile={onViewProfile} 
          />
        ))}
      </div>
    </div>
  );
}