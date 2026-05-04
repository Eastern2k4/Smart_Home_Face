'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Users, Loader } from 'lucide-react';
import { addFaceToDatabase, removeFaceFromDatabase, getFaceDatabase, FaceInDatabase } from '@/lib/api-mocks';

export function FaceDatabaseBlock() {
  const [faces, setFaces] = useState<FaceInDatabase[]>([]);
  const [newFaceName, setNewFaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadFaces();
  }, []);

  const loadFaces = async () => {
    setLoading(true);
    try {
      const data = await getFaceDatabase();
      setFaces(data);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFace = async () => {
    if (!newFaceName.trim()) return;

    setLoading(true);
    try {
      const newFace = await addFaceToDatabase(newFaceName);
      setFaces([...faces, newFace]);
      setNewFaceName('');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFace = async (id: string) => {
    setDeleting(id);
    try {
      const success = await removeFaceFromDatabase(id);
      if (success) {
        setFaces(faces.filter(f => f.id !== id));
      }
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Face Database</CardTitle>
        <CardDescription>Manage registered faces</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter person's name"
            value={newFaceName}
            onChange={(e) => setNewFaceName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddFace()}
            disabled={loading}
            className="glass-sm"
          />
          <Button onClick={handleAddFace} disabled={loading || !newFaceName.trim()} className="gap-2">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {faces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No faces registered yet</p>
            </div>
          ) : (
            faces.map((face) => (
              <div key={face.id} className="glass-sm p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{face.name}</p>
                  <p className="text-xs text-muted-foreground">{face.addedDate}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteFace(face.id)}
                  disabled={deleting === face.id}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting === face.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
