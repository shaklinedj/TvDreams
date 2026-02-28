import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Upload, X, Image, Video, CheckCircle, FileImage, FileVideo, FolderPlus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { mockBackend, API_BASE_URL } from '@/lib/mock-backend';
import { websocketClient } from '@/lib/websocket';
import useAuthStore from '@/hooks/useAuth';
import { formatFileSize, getReadableFileSize } from '@/lib/file-utils';

interface MediaUploaderProps {
  onMediaUploaded: () => void;
  selectedFolder: string;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  preview?: string;
  thumbnail?: string;
}

export default function MediaUploader({ onMediaUploaded, selectedFolder }: MediaUploaderProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [folders, setFolders] = useState<Array<{id: number; name: string}>>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuthStore();

  // Load available folders
  useEffect(() => {
    const loadFolders = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/folders`);
        const data = await response.json();
        setFolders(data);
        
        // Pre-select the current folder if provided
        if (selectedFolder) {
          setSelectedFolders(new Set([selectedFolder]));
        }
      } catch (error) {
        console.error('Error loading folders:', error);
      }
    };
    
    loadFolders();
  }, [selectedFolder]);

  const onDrop = (acceptedFiles: File[]) => {
    handleFileSelect(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.avi', '.mov']
    },
    maxSize: 1024 * 1024 * 1024, // 1GB max
    multiple: true
  });

  const handleFileSelect = (files: File[]) => {
    if (!files || files.length === 0) return;

    const newFiles: UploadFile[] = [];
    files.forEach((file) => {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        alert(`Archivo ${file.name} no es compatible. Solo se permiten imágenes y videos.`);
        return;
      }

      // Validate file size
      const maxSize = isImage ? 10 * 1024 * 1024 : 1024 * 1024 * 1024; // 10MB for images, 1GB for videos
      if (file.size > maxSize) {
        const maxSizeReadable = getReadableFileSize(maxSize);
        alert(`Archivo ${file.name} es demasiado grande. Máximo ${maxSizeReadable}.`);
        return;
      }

      const uploadFile: UploadFile = {
        file,
        id: Date.now() + Math.random().toString(),
        progress: 0,
        status: 'pending'
      };

      // Create preview and thumbnail for images and videos
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageUrl = e.target?.result as string;
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, preview: imageUrl } : f
          ));
          
          // Generate thumbnail for images (for dashboard performance)
          const img = document.createElement('img') as HTMLImageElement;
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              
              if (!ctx) {
                console.error('❌ Could not get 2D canvas context for image thumbnail');
                return;
              }
              
              // Thumbnail size for images
              const maxWidth = 320;
              const maxHeight = 240;
              const aspectRatio = img.width / img.height;
              
              if (aspectRatio > maxWidth / maxHeight) {
                canvas.width = maxWidth;
                canvas.height = maxWidth / aspectRatio;
              } else {
                canvas.height = maxHeight;
                canvas.width = maxHeight * aspectRatio;
              }
              
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
              
              // Validate thumbnail generation
              if (thumbnail && thumbnail.length > 1000) {
                setUploadFiles(prev => prev.map(f => 
                  f.id === uploadFile.id ? { ...f, thumbnail: thumbnail } : f
                ));
                
    // console.log(`✅ Image thumbnail generated: ${file.name} (${canvas.width}x${canvas.height})`);
              } else {
                console.error(`❌ Invalid image thumbnail generated for: ${file.name}`);
              }
            } catch (error) {
              console.error(`❌ Error generating image thumbnail for ${file.name}:`, error);
            }
          };
          
          img.onerror = (error) => {
            console.error(`❌ Error loading image for thumbnail generation: ${file.name}`, error);
          };
          
          img.src = imageUrl;
        };
        
        reader.onerror = (error) => {
          console.error(`❌ Error reading image file for preview: ${file.name}`, error);
        };
        
        reader.readAsDataURL(file);
      } else if (isVideo) {
        // Skip thumbnail generation for videos - they will show with play icon
        console.log(`Skipping thumbnail generation for video: ${file.name}`);
      }

      newFiles.push(uploadFile);
    });

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpload = async (uploadFile: UploadFile, targetFolder: string): Promise<void> => {
    setUploadFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
    ));

    return new Promise((resolve, reject) => {
      (async () => {
        try {
        const formData = new FormData();
        formData.append('file', uploadFile.file);
        formData.append('folder', targetFolder);
        
        // If there's a thumbnail (for both images and videos), send it
        if (uploadFile.thumbnail) {
          try {
            const fileType = uploadFile.file.type.startsWith('image/') ? 'image' : 'video';
    // console.log(`📎 Preparing ${fileType} thumbnail for upload:`, uploadFile.file.name);
            
            // Convert base64 to blob with better validation
            if (uploadFile.thumbnail.startsWith('data:image/')) {
              const response = await fetch(uploadFile.thumbnail);
              const thumbnailBlob = await response.blob();
              
              // Validate blob size and type
              if (thumbnailBlob.size > 0 && thumbnailBlob.type.startsWith('image/')) {
                formData.append('thumbnail', thumbnailBlob, 'thumbnail.jpg');
    // console.log(`✅ ${fileType.charAt(0).toUpperCase() + fileType.slice(1)} thumbnail attached: ${thumbnailBlob.size} bytes, type: ${thumbnailBlob.type}`);
              } else {
                console.warn(`⚠️ Invalid ${fileType} thumbnail blob:`, thumbnailBlob.size, thumbnailBlob.type);
              }
            } else {
              console.warn(`⚠️ Invalid ${fileType} thumbnail format - not a valid data URL`);
            }
          } catch (error) {
            console.error(`❌ Error processing ${uploadFile.file.type.startsWith('image/') ? 'image' : 'video'} thumbnail for upload:`, error);
          }
        } else {
          const fileType = uploadFile.file.type.startsWith('image/') ? 'image' : 'video';
    // console.log(`⚠️ ${fileType.charAt(0).toUpperCase() + fileType.slice(1)} file has no thumbnail generated:`, uploadFile.file.name);
        }

        // Use XMLHttpRequest for real progress tracking
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, progress: percentComplete } : f
            ));
          }
        });

        // Handle successful completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const mediaFile = JSON.parse(xhr.responseText);
            setUploadFiles(prev => prev.map(f => 
              f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
            ));

            // Notify via WebSocket
            websocketClient.sendMediaUpdate(mediaFile);
            resolve();
          } else {
            reject(new Error('Upload failed'));
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        // Handle aborts
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });

        // Set headers and send request
        xhr.open('POST', '/api/media');
        xhr.setRequestHeader('Authorization', `Bearer ${token || ''}`);
        xhr.send(formData);

      } catch (error) {
        console.error('Upload failed:', error);
        setUploadFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'error' } : f
        ));
        reject(error);
        }
      })();
    });
  };

  const uploadAll = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) return;
    
    if (selectedFolders.size === 0) {
      alert('Por favor selecciona al menos una carpeta destino');
      return;
    }

    try {
      const foldersArray = Array.from(selectedFolders);
      
      // Upload each file to all selected folders
      for (const file of pendingFiles) {
        for (const folder of foldersArray) {
          await handleUpload(file, folder);
        }
      }

      // Only call onMediaUploaded after ALL uploads complete successfully
      onMediaUploaded();
      
      // Clear all files after upload completion and notify user
      setTimeout(() => {
        setUploadFiles([]);
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 2000);
    } catch (error) {
      console.error('Upload batch failed:', error);
      // Don't clear the upload queue if there were errors, let user retry
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Subir Archivos Multimedia
        </CardTitle>
        <CardDescription>
          Arrastra archivos o haz clic para seleccionar múltiples archivos multimedia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Folder Selection */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-base font-semibold mb-3 block flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Carpetas de Destino
          </Label>
          <p className="text-sm text-gray-600 mb-3">
            Selecciona una o más carpetas donde quieres subir los archivos
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
            {folders.map((folder) => (
              <div key={folder.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`folder-${folder.id}`}
                  checked={selectedFolders.has(folder.name)}
                  onCheckedChange={(checked) => {
                    const newSelectedFolders = new Set(selectedFolders);
                    if (checked) {
                      newSelectedFolders.add(folder.name);
                    } else {
                      newSelectedFolders.delete(folder.name);
                    }
                    setSelectedFolders(newSelectedFolders);
                  }}
                />
                <label
                  htmlFor={`folder-${folder.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {folder.name.charAt(0).toUpperCase() + folder.name.slice(1)}
                </label>
              </div>
            ))}
          </div>
          
          {selectedFolders.size > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm font-medium text-blue-600">
                {selectedFolders.size} carpeta{selectedFolders.size !== 1 ? 's' : ''} seleccionada{selectedFolders.size !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
        
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragActive 
              ? 'border-blue-500 bg-blue-50 border-solid' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isDragActive ? 'Suelta los archivos aquí...' : 'Arrastra archivos aquí o haz clic para seleccionar'}
          </h3>
          <p className="text-gray-500 text-sm">
            <strong>📸 Imágenes:</strong> JPEG, JPG, PNG, GIF, WebP (máx. {getReadableFileSize(10 * 1024 * 1024)})<br/>
            <strong>🎥 Videos:</strong> MP4, WebM, AVI, MOV (máx. {getReadableFileSize(1024 * 1024 * 1024)})
          </p>
        </div>



        {/* Upload Queue */}
        {uploadFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Archivos seleccionados ({uploadFiles.length})</h4>
              <Button 
                onClick={uploadAll}
                disabled={uploadFiles.every(f => f.status !== 'pending')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Subir Todos
              </Button>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadFiles.map((uploadFile) => (
                <div key={uploadFile.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  {/* File Icon/Preview */}
                  <div className="flex-shrink-0">
                    {uploadFile.preview ? (
                      <img 
                        src={uploadFile.preview} 
                        alt={uploadFile.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : uploadFile.file.type.startsWith('image/') ? (
                      <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                        <FileImage className="h-6 w-6 text-blue-600" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-purple-100 rounded flex items-center justify-center">
                        <FileVideo className="h-6 w-6 text-purple-600" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                    
                    {/* Progress Bar */}
                    {uploadFile.status === 'uploading' && (
                      <Progress value={uploadFile.progress} className="mt-2" />
                    )}
                  </div>

                  {/* Status/Actions */}
                  <div className="flex-shrink-0">
                    {uploadFile.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : uploadFile.status === 'uploading' ? (
                      <div className="text-sm text-blue-600">{uploadFile.progress}%</div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}