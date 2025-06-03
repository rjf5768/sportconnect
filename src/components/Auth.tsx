import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { userDoc } from '../utils/paths';


interface Props {
  onLogin: (u: any) => void;
}

export default function Auth({ onLogin }: Props) {
  const [isUp, setIsUp] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (isUp) {
        if (!name.trim()) {
          setError('Display name required');
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, userDoc(cred.user.uid)), {
          uid: cred.user.uid,
          email,
          displayName: name.trim(),
          createdAt: serverTimestamp(),
        });
        onLogin(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, pw);
        onLogin(cred.user);
      }
    } catch (err: any) {
      setError(err.code ?? err.message);
      console.error(err);
    } finally {
      setBusy(false);
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
          placeholder="Display name"
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
        placeholder="Password (6+ chars)"
        type="password"
        className="w-full rounded border p-2"
        required
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={busy}
        className="w-full rounded bg-indigo-600 py-2 text-white disabled:opacity-50"
      >
        {busy ? 'Please wait…' : isUp ? 'Sign Up' : 'Log In'}
      </button>

      <p
        onClick={() => {
          setIsUp(!isUp);
          setError('');
        }}
        className="cursor-pointer text-center text-sm text-indigo-600"
      >
        {isUp ? 'Have an account? Log in' : 'New here? Sign up'}
      </p>
    </form>
  );
}