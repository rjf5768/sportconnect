import React, { useState } from 'react';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { postDoc } from '../utils/paths';

export default function Post({ post, user }: { post: any; user: any }) {
  const [busy, setBusy] = useState(false);
  const liked = user && post.likes?.includes(user.uid);

  const toggleLike = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, postDoc(post.id));
        const snap = await tx.get(ref);
        const data = snap.data()!;
        const arr: string[] = data.likes || [];
        const n = arr.includes(user.uid)
          ? arr.filter((id) => id !== user.uid)
          : [...arr, user.uid];
        tx.update(ref, { likes: n, likeCount: n.length });
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <p className="font-semibold">{post.userDisplayName}</p>
      <p className="my-2 whitespace-pre-wrap">{post.text}</p>
      <button
        onClick={toggleLike}
        className={`text-sm ${liked ? 'text-indigo-600' : 'text-gray-600'}`}
      >
        ❤️ {post.likeCount ?? 0}
      </button>
    </div>
  );
}
