import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol } from '../utils/paths';
import { Image, Smile, MapPin, X } from 'lucide-react';

interface Props {
  user: any;
  standalone?: boolean;
  onPostCreated?: () => void;
}

export default function CreatePost({ user, standalone = false, onPostCreated }: Props) {
  const [txt, setTxt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const maxChars = 280;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setTxt(text);
      setCharCount(text.length);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txt.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, postsCol()), {
        text: txt.trim(),
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        likeCount: 0,
        commentCount: 0,
        likes: [],
        createdAt: serverTimestamp(),
      });
      setTxt('');
      setCharCount(0);
      if (onPostCreated) onPostCreated();
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCharCountColor = () => {
    if (charCount > maxChars * 0.9) return 'text-red-500';
    if (charCount > maxChars * 0.7) return 'text-yellow-500';
    return 'text-gray-500';
  };

  if (standalone) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {user.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{user.displayName}</p>
              <p className="text-sm text-gray-500">Create a new post</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <textarea
                value={txt}
                onChange={handleTextChange}
                placeholder="What's happening in sports?"
                className="w-full resize-none border-none p-0 text-lg placeholder-gray-500 focus:outline-none focus:ring-0"
                rows={6}
                style={{ minHeight: '120px' }}
              />
              {txt && (
                <button
                  type="button"
                  onClick={() => {
                    setTxt('');
                    setCharCount(0);
                  }}
                  className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Add image (coming soon)"
                >
                  <Image className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Add emoji (coming soon)"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Add location (coming soon)"
                >
                  <MapPin className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <div className={`text-sm ${getCharCountColor()}`}>
                  {charCount}/{maxChars}
                </div>
                <button
                  type="submit"
                  disabled={!txt.trim() || isSubmitting}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <div className="flex space-x-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
          {user.displayName?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1">
          <textarea
            value={txt}
            onChange={handleTextChange}
            placeholder="Share something about sports…"
            className="w-full resize-none border-none p-0 placeholder-gray-500 focus:outline-none focus:ring-0"
            rows={3}
          />
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                title="Add image (coming soon)"
              >
                <Image className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                title="Add emoji (coming soon)"
              >
                <Smile className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`text-xs ${getCharCountColor()}`}>
                {charCount}/{maxChars}
              </div>
              <button
                type="submit"
                disabled={!txt.trim() || isSubmitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}