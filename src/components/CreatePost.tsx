import React, { useState, useRef, useEffect } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../services/firebase';
import { postsCol } from '../utils/paths';
import { Image, Smile, MapPin, X } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';

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
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [emojiPickerRef]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= maxChars) {
      setTxt(text);
      setCharCount(text.length);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setTxt(prevTxt => {
      const newText = prevTxt + emojiData.emoji;
      if (newText.length <= maxChars) {
        setCharCount(newText.length);
        return newText;
      }
      return prevTxt;
    });
    setShowEmojiPicker(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!txt.trim() && !imageFile) || isSubmitting) return;
    
    setIsSubmitting(true);
    let imageUrl = '';

    try {
      if (imageFile) {
        const storage = getStorage();
        const imageRef = ref(storage, `posts/${user.uid}/${Date.now()}-${imageFile.name}`);
        const snapshot = await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, postsCol()), {
        text: txt.trim(),
        imageUrl: imageUrl,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        likeCount: 0,
        commentCount: 0,
        likes: [],
        createdAt: serverTimestamp(),
      });

      setTxt('');
      setCharCount(0);
      removeImage();
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

  const createPostUI = (isStandalone: boolean) => (
    <div className={isStandalone ? "bg-white rounded-xl shadow-sm border border-gray-100 p-6" : "mb-6 rounded-xl bg-white p-4 shadow-sm border border-gray-100"}>
      {isStandalone && (
        <div className="flex items-center space-x-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            {user.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{user.displayName}</p>
            <p className="text-sm text-gray-500">Create a new post</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className={isStandalone ? "space-y-4" : ""}>
        <div className={`flex space-x-3 ${!isStandalone ? '' : 'flex-col'}`}>
          {!isStandalone && (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {user.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1">
            <div className="relative">
              <textarea
                value={txt}
                onChange={handleTextChange}
                placeholder={isStandalone ? "What's happening in sports?" : "Share something about sports…"}
                className={`w-full resize-none border-none p-0 placeholder-gray-500 focus:outline-none focus:ring-0 ${isStandalone ? 'text-lg' : ''}`}
                rows={isStandalone ? 6 : 3}
                style={isStandalone ? { minHeight: '120px' } : {}}
              />
              {txt && (
                <button
                  type="button"
                  onClick={() => { setTxt(''); setCharCount(0); }}
                  className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>
            {imagePreview && (
              <div className="relative mt-3">
                <img src={imagePreview} alt="Preview" className="w-full rounded-lg" />
                <button onClick={removeImage} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full p-1 hover:bg-opacity-80">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
          </div>
        </div>
        
        <div className={`flex items-center justify-between pt-3 border-t border-gray-100 ${isStandalone ? 'mt-0' : 'mt-3 ml-13'}`}>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"
              title="Add image"
            >
              <Image className={isStandalone ? "h-5 w-5" : "h-4 w-4"} />
            </button>
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"
                title="Add emoji"
              >
                <Smile className={isStandalone ? "h-5 w-5" : "h-4 w-4"} />
              </button>
              {showEmojiPicker && (
                <div className="absolute z-10 mt-2">
                  <EmojiPicker onEmojiClick={onEmojiClick} />
                </div>
              )}
            </div>
            {isStandalone && (
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"
                  title="Add location (coming soon)"
                >
                  <MapPin className="h-5 w-5" />
                </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className={`text-sm ${getCharCountColor()}`}>
              {charCount}/{maxChars}
            </div>
            <button
              type="submit"
              disabled={(!txt.trim() && !imageFile) || isSubmitting}
              className={`px-6 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isStandalone ? '' : 'text-sm'}`}
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return createPostUI(standalone);
}