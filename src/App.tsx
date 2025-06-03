import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import Auth from './components/Auth';
import CreatePost from './components/CreatePost';
import PostList from './components/PostList';
import './styles/index.css';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  if (!ready) return <p className="p-10 text-center">Loading…</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <header className="sticky top-0 bg-white px-4 py-3 shadow">
        <h1 className="inline bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent">
          SportConnect
        </h1>
        {user && (
          <button
            onClick={() => signOut(auth)}
            className="float-right rounded bg-indigo-600 px-3 py-1 text-sm text-white"
          >
            Logout
          </button>
        )}
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {!user ? (
          <Auth onLogin={(u) => setUser(u)} />
        ) : (
          <>
            <CreatePost user={user} />
            <PostList user={user} />
          </>
        )}
      </main>
    </div>
  );
}
