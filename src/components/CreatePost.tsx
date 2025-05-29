import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol } from '../utils/paths';

export default function CreatePost({ user }: { user: any }) {
  const [txt, setTxt] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txt.trim()) return;
    await addDoc(collection(db, postsCol()), {
      text: txt.trim(),
      userId: user.uid,
      userDisplayName: user.displayName,
      likeCount: 0,
      commentCount: 0,
      createdAt: serverTimestamp(),
    });
    setTxt('');
  };

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl bg-white p-4 shadow">
      <textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder="Share something about sports…"
        className="w-full rounded border p-2"
        rows={3}
      />
      <button className="mt-2 rounded bg-indigo-600 px-4 py-1 text-white">
        Post
      </button>
    </form>
  );
}
