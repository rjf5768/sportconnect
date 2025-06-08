import React, { useState, useEffect } from 'react';
import { 
  doc, 
  runTransaction, 
  collection, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  query,
  serverTimestamp,
  updateDoc,
  increment,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { postDoc, commentsCol, userDoc } from '../utils/paths';
import { Heart, MessageCircle, Send, MoreHorizontal } from 'lucide-react';
import Modal from './Modal';

interface Comment {
  id: string;
  text: string;
  userId: string;
  userDisplayName: string;
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

interface PostProps {
  post: PostData;
  user: any;
}

export default function Post({ post, user }: PostProps) {
  const [currentPostData, setCurrentPostData] = useState(post);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  useEffect(() => {
    setCurrentPostData(post);
  }, [post]);

  const liked = user && (currentPostData.likes || []).includes(user.uid);

  useEffect(() => {
    if (showComments) {
      const q = query(
        collection(db, commentsCol(post.id)), 
        orderBy('createdAt', 'asc')
      );
      return onSnapshot(q, (snap) =>
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)))
      );
    }
  }, [showComments, post.id]);

  const toggleLike = async () => {
    if (!user || busy) return;
    setBusy(true);

    const originalPostState = currentPostData;

    // Optimistic UI update
    const newLikesArray = liked
      ? (currentPostData.likes || []).filter(id => id !== user.uid)
      : [...(currentPostData.likes || []), user.uid];

    setCurrentPostData({
      ...currentPostData,
      likes: newLikesArray,
      likeCount: newLikesArray.length,
    });
    
    try {
      const postRef = doc(db, postDoc(post.id));
      const userRef = doc(db, userDoc(user.uid));
      
      await runTransaction(db, async (tx) => {
        const postSnap = await tx.get(postRef);
        const userSnap = await tx.get(userRef);
        
        if (!postSnap.exists()) {
          throw new Error('Post does not exist');
        }
        
        const postDataFromDb = postSnap.data();
        const userData = userSnap.exists() ? userSnap.data() : {};
        
        const currentLikes: string[] = postDataFromDb.likes || [];
        const userLikedPosts: string[] = userData.likedPosts || [];
        const isCurrentlyLiked = currentLikes.includes(user.uid);
        
        const newLikes = isCurrentlyLiked
          ? currentLikes.filter((id) => id !== user.uid)
          : [...currentLikes, user.uid];
        
        const newUserLikedPosts = isCurrentlyLiked
          ? userLikedPosts.filter((id) => id !== post.id)
          : [...userLikedPosts, post.id];
        
        // Update post likes
        tx.update(postRef, { 
          likes: newLikes, 
          likeCount: newLikes.length 
        });
        
        // Update user's liked posts
        if (userSnap.exists()) {
          tx.update(userRef, {
            likedPosts: newUserLikedPosts
          });
        } else {
          // Create user document if it doesn't exist
          tx.set(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            likedPosts: newUserLikedPosts,
            bio: '',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            followers: [],
            following: [],
            createdAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error toggling like:', error);
      setCurrentPostData(originalPostState);
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || submittingComment) return;
    
    setSubmittingComment(true);
    try {
      // Use a batch write to ensure atomicity
      const batch = writeBatch(db);
      
      // Add the comment
      const commentRef = doc(collection(db, commentsCol(post.id)));
      batch.set(commentRef, {
        text: newComment.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
      });
      
      // Update the comment count
      const postRef = doc(db, postDoc(post.id));
      batch.update(postRef, {
        commentCount: increment(1)
      });
      
      // Commit the batch
      await batch.commit();
      
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTimeAgo = (timestamp: any) => {
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
    <>
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden mb-6">
        {/* Post Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {currentPostData.userDisplayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{currentPostData.userDisplayName}</p>
              <p className="text-xs text-gray-500">{formatTimeAgo(currentPostData.createdAt)}</p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-50 rounded-full">
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Post Content */}
        <div className="px-4 pb-3">
          <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{currentPostData.text}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
          <div className="flex items-center space-x-6">
            <button
              onClick={toggleLike}
              disabled={busy}
              className={`flex items-center space-x-2 transition-colors ${
                liked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
              } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Heart 
                className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} 
              />
              <span className="text-sm font-medium">
                {currentPostData.likeCount || 0}
              </span>
            </button>
            
            <button
              onClick={() => setShowComments(true)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <MessageCircle className="h-6 w-6" />
              <span className="text-sm font-medium">
                {currentPostData.commentCount || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Like count display */}
        {(currentPostData.likeCount || 0) > 0 && (
          <div className="px-4 pb-2">
            <p className="text-sm font-semibold text-gray-900">
              {currentPostData.likeCount} {currentPostData.likeCount === 1 ? 'like' : 'likes'}
            </p>
          </div>
        )}
      </div>

      {/* Comments Modal */}
      <Modal 
        isOpen={showComments} 
        onClose={() => setShowComments(false)}
        title="Comments"
      >
        <div className="max-h-96 overflow-y-auto mb-4">
          {comments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No comments yet</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                    {comment.userDisplayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="font-semibold text-sm text-gray-900">
                        {comment.userDisplayName}
                      </p>
                      <p className="text-gray-800">{comment.text}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-3">
                      {formatTimeAgo(comment.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Comment Form */}
        <form onSubmit={addComment} className="flex space-x-3 border-t pt-4">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
            {user.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 flex space-x-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={submittingComment}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submittingComment}
              className="p-2 text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}