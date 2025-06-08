import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  documentId
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol } from '../utils/paths';
import { Heart } from 'lucide-react';
import Post from './Post';

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

export default function LikedPosts({ user, likedPostIds }: { user: any, likedPostIds: string[] }) {
  const [likedPosts, setLikedPosts] = useState<PostData[]>([]);
  const [loadingLikedPosts, setLoadingLikedPosts] = useState(true);

  useEffect(() => {
    if (likedPostIds.length > 0) {
      loadLikedPosts(likedPostIds);
    } else {
      setLikedPosts([]);
      setLoadingLikedPosts(false);
    }
  }, [likedPostIds]);

  const loadLikedPosts = async (postIds: string[]) => {
    setLoadingLikedPosts(true);
    try {
      const batches = [];
      for (let i = 0; i < postIds.length; i += 10) {
        batches.push(postIds.slice(i, i + 10));
      }

      const allPosts: PostData[] = [];
      for (const batch of batches) {
        const q = query(
          collection(db, postsCol()),
          where(documentId(), 'in', batch)
        );
        const querySnapshot = await getDocs(q);
        const batchPosts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PostData));
        allPosts.push(...batchPosts);
      }

      allPosts.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        const aTime = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bTime = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bTime.getTime() - aTime.getTime();
      });

      setLikedPosts(allPosts);
    } catch (error) {
      console.error('Error loading liked posts:', error);
    } finally {
      setLoadingLikedPosts(false);
    }
  };

  if (loadingLikedPosts) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading liked posts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {likedPosts.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No liked posts yet</p>
          <p className="text-sm text-gray-500 mt-2">Posts you like will appear here</p>
        </div>
      ) : (
        likedPosts.map((post) => (
          <Post key={post.id} post={post} user={user} />
        ))
      )}
    </div>
  );
}