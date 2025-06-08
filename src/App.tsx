
import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import Auth from './components/Auth';
import CreatePost from './components/CreatePost';
import PostList from './components/PostList';
import Profile from './components/Profile';
import Search from './components/Search';
import { Home, Search as SearchIcon, PlusSquare, Heart, User } from 'lucide-react';
import './styles/index.css';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  if (!ready) return <p className="p-10 text-center">Loading…</p>;

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'search', icon: SearchIcon, label: 'Search' },
    { id: 'create', icon: PlusSquare, label: 'Create' },
    { id: 'activity', icon: Heart, label: 'Activity' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <header className="sticky top-0 bg-white px-4 py-3 shadow-sm z-50">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent">
            SportConnect
          </h1>
          {user && (
            <button
              onClick={() => signOut(auth)}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="pb-20">
        {!user ? (
          <Auth onLogin={(u) => setUser(u)} />
        ) : (
          <div className="max-w-4xl mx-auto px-4 py-6">
            {activeTab === 'home' && (
              <>
                <CreatePost user={user} />
                <PostList user={user} />
              </>
            )}
            {activeTab === 'search' && <Search user={user} />}
            {activeTab === 'create' && <CreatePost user={user} standalone />}
            {activeTab === 'activity' && (
              <div className="text-center py-20">
                <Heart className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="text-gray-600">Activity feed coming soon!</p>
              </div>
            )}
            {activeTab === 'profile' && <Profile user={user} />}
          </div>
        )}
      </main>

      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
          <div className="flex justify-around max-w-md mx-auto">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors ${
                  activeTab === id
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
