import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { userDoc } from '../utils/paths';

export default function Auth({ onLogin }: { onLogin: (u: any) => void }) {
  const [isUp, setIsUp] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUp) {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, userDoc(cred.user.uid)), {
        uid: cred.user.uid,
        email,
        displayName: name,
        createdAt: serverTimestamp(),
      });
      onLogin(cred.user);
    } else {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      onLogin(cred.user);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-10 max-w-xs space-y-4 rounded-xl bg-white p-6 shadow-lg"
    >
      {isUp && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded border p-2"
          required
        />
      )}
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        className="w-full rounded border p-2"
        required
      />
      <input
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="Password"
        type="password"
        className="w-full rounded border p-2"
        required
      />
      <button className="w-full rounded bg-indigo-600 py-2 text-white">
        {isUp ? 'Sign up' : 'Log in'}
      </button>
      <p
        onClick={() => setIsUp(!isUp)}
        className="cursor-pointer text-center text-sm text-indigo-600"
      >
        {isUp ? 'Have an account? Login' : 'New here? Sign up'}
      </p>
    </form>
  );
}
