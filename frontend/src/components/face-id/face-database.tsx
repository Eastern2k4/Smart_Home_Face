"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Plus, Trash2, Users } from "lucide-react";
import { faceApi } from "@/lib/api/face";

interface FaceInDatabase {
  id: string;
  name: string;
  addedDate: string;
}

export function FaceDatabase() {
  const [faces, setFaces] = useState<FaceInDatabase[]>([]);
  const [newFaceName, setNewFaceName] = useState("");
  const [loadingDatabase, setLoadingDatabase] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedAddFile, setSelectedAddFile] = useState<File | null>(null);
  const addFaceFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFaces();
  }, []);

  const loadFaces = async () => {
    setLoadingDatabase(true);
    try {
      const { faces: names } = await faceApi.getFaces();
      const facesData = names.map((name, idx) => ({
        id: String(idx + 1),
        name,
        addedDate: new Date().toISOString().split("T")[0],
      }));
      setFaces(facesData);
    } catch (err) {
      console.error("Failed to load faces:", err);
    } finally {
      setLoadingDatabase(false);
    }
  };

  const handleAddFace = async () => {
    if (!newFaceName.trim()) {
      alert("Please enter a name");
      return;
    }
    if (!selectedAddFile) {
      alert("Please select an image for the face");
      return;
    }

    setLoadingDatabase(true);
    try {
      await faceApi.addFace(newFaceName, selectedAddFile);
      setNewFaceName("");
      setSelectedAddFile(null);
      if (addFaceFileInputRef.current) addFaceFileInputRef.current.value = "";
      await loadFaces();
    } catch (err) {
      alert("Failed to add face");
    } finally {
      setLoadingDatabase(false);
    }
  };

  const handleDeleteFace = async (name: string) => {
    setDeleting(name);
    try {
      await faceApi.deleteFace(name);
      await loadFaces();
    } catch (err) {
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Face Database</CardTitle>
        <CardDescription>
          Manage registered faces ({faces.length})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add face controls */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Enter person's name"
              value={newFaceName}
              onChange={(e) => setNewFaceName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddFace()}
              disabled={loadingDatabase}
              className="glass-sm"
            />
            <Button
              onClick={handleAddFace}
              disabled={
                loadingDatabase || !newFaceName.trim() || !selectedAddFile
              }
              className="gap-2"
            >
              {loadingDatabase ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addFaceFileInputRef.current?.click()}
              className="flex-1"
            >
              {selectedAddFile ? "Change Image" : "Select Image"}
            </Button>
            <input
              ref={addFaceFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setSelectedAddFile(file || null);
              }}
            />
            {selectedAddFile && (
              <span className="text-xs text-muted-foreground truncate flex-1">
                {selectedAddFile.name}
              </span>
            )}
          </div>
        </div>

        {/* Face list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {faces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No faces registered yet</p>
            </div>
          ) : (
            faces.map((face) => (
              <div
                key={face.id}
                className="glass-sm p-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{face.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {face.addedDate}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteFace(face.name)}
                  disabled={deleting === face.name}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting === face.name ? (
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
