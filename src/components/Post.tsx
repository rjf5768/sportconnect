import React, { useState, useEffect } from 'react';
import { 
  doc, 
  runTransaction, 
  collection, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  query,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { postDoc, commentsCol } from '../utils/paths';
import { Heart, MessageCircle, Send, MoreHorizontal } from 'lucide-react';
import Modal from './Modal';

interface Comment {
  id: string;
  text: string;
  userId: string;
  userDisplayName: string;
  createdAt: any;
}

export default function Post({ post, user }: { post: any; user: any }) {
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const liked = user && post.likes?.includes(user.uid);

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
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, postDoc(post.id));
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        
        const data = snap.data();
        const currentLikes: string[] = data.likes || [];
        const isCurrentlyLiked = currentLikes.includes(user.uid);
        
        const newLikes = isCurrentlyLiked
          ? currentLikes.filter((id) => id !== user.uid)
          : [...currentLikes, user.uid];
        
        tx.update(ref, { 
          likes: newLikes, 
          likeCount: newLikes.length 
        });
      });
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || submittingComment) return;
    
    setSubmittingComment(true);
    try {
      await addDoc(collection(db, commentsCol(post.id)), {
        text: newComment.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        createdAt: serverTimestamp(),
      });
      
      // Update comment count on post
      await runTransaction(db, async (tx) => {
        const ref = doc(db, postDoc(post.id));
        const snap = await tx.get(ref);
        if (snap.exists()) {
          const currentCount = snap.data().commentCount || 0;
          tx.update(ref, { commentCount: currentCount + 1 });
        }
      });
      
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
              {post.userDisplayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{post.userDisplayName}</p>
              <p className="text-xs text-gray-500">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </div>
          <button className="p-2 hover:bg-gray-50 rounded-full">
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Post Content */}
        <div className="px-4 pb-3">
          <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{post.text}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
          <div className="flex items-center space-x-6">
            <button
              onClick={toggleLike}
              disabled={busy}
              className={`flex items-center space-x-2 transition-colors ${
                liked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
              }`}
            >
              <Heart 
                className={`h-6 w-6 ${liked ? 'fill-current' : ''}`} 
              />
              <span className="text-sm font-medium">
                {post.likeCount || 0}
              </span>
            </button>
            
            <button
              onClick={() => setShowComments(true)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <MessageCircle className="h-6 w-6" />
              <span className="text-sm font-medium">
                {post.commentCount || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Like count display */}
        {post.likeCount > 0 && (
          <div className="px-4 pb-2">
            <p className="text-sm font-semibold text-gray-900">
              {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
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