'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/authHook';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';
import { DataTableDemo } from '@/components/data-table';

export default function RepositoriesPage() {
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/repositories');
      setRepositories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRepositories();
    }
  }, [user]);

  return (
    <>
      <DataTableDemo data={repositories} />
    </>
  );
}
