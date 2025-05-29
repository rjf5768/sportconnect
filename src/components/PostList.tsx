import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { postsCol } from '../utils/paths';
import Post from './Post';

export default function PostList({ user }: { user: any }) {
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    const q = query(collection(db, postsCol()), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
  }, []);

  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <Post key={p.id} post={p} user={user} />
      ))}
    </div>
  );
}
