import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  documentId
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { usersCol } from '../utils/paths';
import { X, Users } from 'lucide-react';

interface UserData {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  bio?: string;
  profileImageUrl?: string;
  followersCount?: number;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  userIds: string[];
  onViewProfile: (uid: string) => void;
}

export default function FollowersModal({ isOpen, onClose, title, userIds, onViewProfile }: FollowersModalProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userIds.length > 0) {
      loadUsers();
    } else {
      setUsers([]);
      setLoading(false);
    }
  }, [isOpen, userIds]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Firebase has a limit of 10 items for 'in' queries, so we need to batch
      const batches = [];
      for (let i = 0; i < userIds.length; i += 10) {
        batches.push(userIds.slice(i, i + 10));
      }

      const allUsers: UserData[] = [];
      for (const batch of batches) {
        const q = query(
          collection(db, usersCol()),
          where(documentId(), 'in', batch)
        );
        const querySnapshot = await getDocs(q);
        const batchUsers = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as UserData));
        allUsers.push(...batchUsers);
      }

      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (uid: string) => {
    onViewProfile(uid);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleUserClick(user.uid)}
                >
                  <div className="flex items-center space-x-3">
                    {user.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt={user.displayName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                        {user.displayName?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{user.displayName}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      {user.bio && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{user.bio}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {user.followersCount || 0} followers
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}