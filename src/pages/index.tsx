'use client';

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface User {
  id: number;
  email: string;
  plexUsername?: string;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-6xl font-bold text-white mb-4">Maintainarr</h1>
        <p className="text-xl text-gray-400 mb-8">Welcome, {user.plexUsername || user.email}!</p>
      </div>
    </div>
  );
}
