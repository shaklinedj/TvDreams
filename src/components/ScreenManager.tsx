import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Plus, Settings, Edit, Trash2, Play, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockBackend, API_BASE_URL } from '@/lib/mock-backend';
import { Screen, MediaFile } from '@/types';
import { websocketClient } from '@/lib/websocket';
import { toast } from 'sonner';

interface ScreenManagerProps {
  screens: Screen[];
  onScreenUpdated: () => void;
}

interface ScreenPlayingContent {
  [screenId: number]: {
    currentMedia?: MediaFile;
    mediaFiles?: MediaFile[];
    contentIndex?: number;
  };
}

export default function ScreenManager({ screens, onScreenUpdated }: ScreenManagerProps) {
  const [screenStatus, setScreenStatus] = useState<{
    screens: Array<{id: number; name: string; connected: boolean; connectionCount: number}>;
    totalConnected: number;
    totalConfigured: number;
  }>({ screens: [], totalConnected: 0, totalConfigured: 0 });
  const [folders, setFolders] = useState<Array<{id: number; name: string}>>([]);
  const [folderMediaFiles, setFolderMediaFiles] = useState<Record<string, MediaFile[]>>({});
  const [playingContent, setPlayingContent] = useState<ScreenPlayingContent>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingScreen, setEditingScreen] = useState<Screen | null>(null);
  const [configuringScreen, setConfiguringScreen] = useState<Screen | null>(null);
  const [deletingScreen, setDeletingScreen] = useState<Screen | null>(null);
  const [formData, setFormData] = useState<Omit<Screen, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    location: '',
    resolution: '1920x1080',
    orientation: 'landscape',
    assignedFolder: '',
    transitionType: 'fade',
    duration: 10,
  });
  const [configData, setConfigData] = useState({
    assignedFolder: '',
    transitionType: 'fade' as 'fade' | 'slide',
    duration: 10,
  });
  const [carouselIndexes, setCarouselIndexes] = useState<Record<number, number>>({});

  const fetchFolderMediaFiles = async (folderName: string) => {
    if (!folderName || folderMediaFiles[folderName]) return; // Skip if already loaded
    
    try {
      const response = await fetch(`${API_BASE_URL}/media?folder=${encodeURIComponent(folderName)}`);
      const data = await response.json();
      setFolderMediaFiles(prev => ({
        ...prev,
        [folderName]: data
      }));
    } catch (error) {
      console.error('Failed to fetch folder media files:', error);
    }
  };

  useEffect(() => {
    const fetchScreenStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/status/screens`);
        const data = await response.json();
        setScreenStatus(data);
      } catch (error) {
        console.error('Failed to fetch screen status:', error);
      }
    };

    const fetchFolders = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/folders`);
        const data = await response.json();
        setFolders(data);
      } catch (error) {
        console.error('Failed to fetch folders:', error);
      }
    };

    fetchScreenStatus();
    fetchFolders();
    
    // Fetch media files for all assigned folders
    screens.forEach(screen => {
      if (screen.assignedFolder) {
        fetchFolderMediaFiles(screen.assignedFolder);
      }
    });
    
    // WebSocket handles real-time updates via 'connection_update' messages
    // No need for polling interval since heartbeat system manages connections

    const handleConnectionUpdate = (message: { type: string; data?: Record<string, unknown> }) => {
      if (message.type === 'connection_update') {
        fetchScreenStatus();
      } else if (message.type === 'content_playing' && message.data) {
        // Update playing content for screens
        const { screenId, currentMedia, mediaFiles, contentIndex } = message.data;
        if (typeof screenId === 'number') {
          setPlayingContent(prev => ({
            ...prev,
            [screenId]: {
              currentMedia: currentMedia as MediaFile,
              mediaFiles: mediaFiles as MediaFile[],
              contentIndex: contentIndex as number
            }
          }));
        }
      }
    };

    websocketClient.onMessage(handleConnectionUpdate);

    return () => {
      // Cleanup WebSocket listener when component unmounts
    };
  }, [screens]);

  // Auto-advance carousel removed to reduce API calls and resource usage
  // Users can manually navigate using the arrow buttons if needed

  const getScreenStatus = (screenId: number) => {
    const status = screenStatus.screens.find(s => s.id === screenId);
    return status || { connected: false, connectionCount: 0 };
  };

  const getPlayingContent = (screenId: number) => {
    return playingContent[screenId];
  };

  const renderThumbnailPreview = (screenId: number, assignedFolder: string | undefined, orientation: string = 'landscape') => {
    // Base container styles - let the thumbnail dictate the aspect ratio
    const baseContainerStyle = {
      minHeight: '32px',
      maxHeight: '120px', // Reduced from 200px to make cards smaller
      maxWidth: '100%'
    };
    
    // Default fallback style for states without thumbnails
    const fallbackContainerStyle = orientation === 'portrait' 
      ? { ...baseContainerStyle, aspectRatio: '9/16' }  
      : { ...baseContainerStyle, aspectRatio: '16/9' };
    
    if (!assignedFolder) {
      return (
        <div className="w-full bg-gray-50 rounded flex items-center justify-center text-[10px] text-gray-400" style={fallbackContainerStyle}>
          Sin contenido
        </div>
      );
    }


    // Get media files from the assigned folder
    // if undefined it means we haven't fetched them yet
    const mediaFiles = folderMediaFiles[assignedFolder];
    if (mediaFiles === undefined) {
      return (
        <div className="w-full bg-gray-50 rounded flex items-center justify-center text-[10px] text-gray-400" style={fallbackContainerStyle}>
          Cargando…
        </div>
      );
    }
    
    if (mediaFiles.length === 0) {
      return (
        <div className="w-full bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-500 flex-col" style={fallbackContainerStyle}>
          <Image className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Carpeta vacía</span>
        </div>
      );
    }

    // Get media files that can be displayed (have thumbnail/path for images or path for videos)
    const displayableMedia = mediaFiles.filter(media => 
      media.thumbnail || media.path || media.url
    );
    const displayMediaFiles = displayableMedia.length > 0 ? displayableMedia : mediaFiles.slice(0, 1);
    
    if (displayMediaFiles.length === 0) {
      return (
        <div className="w-full bg-gray-100 rounded flex items-center justify-center text-[10px] text-gray-500 flex-col" style={fallbackContainerStyle}>
          <Image className="h-4 w-4 mb-0.5" />
          <span className="text-[10px]">Sin contenido disponible</span>
        </div>
      );
    }

    // Get current carousel index for this screen
    const currentIndex = carouselIndexes[screenId] || 0;
    const currentMedia = displayMediaFiles[currentIndex] || displayMediaFiles[0];
    
    const nextImage = () => {
      if (displayMediaFiles.length <= 1) return;
      const nextIndex = (currentIndex + 1) % displayMediaFiles.length;
      setCarouselIndexes(prev => ({ ...prev, [screenId]: nextIndex }));
    };
    
    const prevImage = () => {
      if (displayMediaFiles.length <= 1) return;
      const prevIndex = currentIndex === 0 ? displayMediaFiles.length - 1 : currentIndex - 1;
      setCarouselIndexes(prev => ({ ...prev, [screenId]: prevIndex }));
    };

    if (currentMedia?.thumbnail || currentMedia?.path || currentMedia?.url) {
      // Check if current media is a video
      const isVideo = currentMedia.type.startsWith('video/');
      
      return (
        <div className="w-full relative group rounded-lg overflow-hidden">
          {isVideo ? (
            // Show video thumbnail/poster without autoplay to reduce resource usage
            <video
              src={currentMedia.path || currentMedia.url}
              className="w-full h-auto object-contain max-h-28"
              style={{ display: 'block' }}
              muted
              playsInline
            />
          ) : (
            // Show image thumbnail for image files
            <img
              src={currentMedia.thumbnail || currentMedia.path || currentMedia.url}
              alt={`Vista previa de ${assignedFolder}`}
              className="w-full h-auto object-contain max-h-28"
              style={{ display: 'block' }}
            />
          )}
          
          {/* Show navigation controls only if multiple items and on hover */}
          {displayMediaFiles.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-0.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Contenido anterior"
              >
                <ChevronLeft className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Siguiente contenido"
              >
                <ChevronRight className="h-2.5 w-2.5" />
              </button>
              
              {/* Content counter */}
              <div className="absolute top-0.5 right-0.5 bg-black/50 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {currentIndex + 1}/{displayMediaFiles.length}
              </div>
            </>
          )}
        </div>
      );
    } else {
      // Fallback when no thumbnail is available but folder has content
      return (
        <div className="w-full relative group rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100" style={fallbackContainerStyle}>
          <div className="w-full h-full flex items-center justify-center">
            {currentMedia.type.startsWith('video/') ? (
              <Play className="h-4 w-4 text-blue-600" />
            ) : (
              <Image className="h-4 w-4 text-blue-600" />
            )}
          </div>
        </div>
      );
    }
  };

  const resolutions = [
    { value: '1920x1080', label: 'Full HD (1920x1080)' },
    { value: '3840x2160', label: '4K (3840x2160)' },
    { value: '1366x768', label: 'HD (1366x768)' },
    { value: '1280x720', label: 'HD Ready (1280x720)' }
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      resolution: '1920x1080',
      orientation: 'landscape',
      assignedFolder: '',
      transitionType: 'fade',
      duration: 10,
    });
  };

  const resetConfigData = () => {
    setConfigData({
      assignedFolder: '',
      transitionType: 'fade',
      duration: 10,
    });
  };

  const handleAddScreen = async () => {
    if (!formData.name) {
      toast.error('Campo requerido: Por favor, introduce un nombre para la pantalla.');
      return;
    }
    
    if (!formData.assignedFolder) {
      toast.error('Campo requerido: Por favor, selecciona una carpeta de contenido para la pantalla.');
      return;
    }
    
    // Check if no folders exist at all
    if (folders.length === 0) {
      toast.error('No existen carpetas asignables. Por favor cree algunas carpetas en su CMS antes de asignar pantallas.');
      return;
    }
    
    // Create screen directly
    try {
      await mockBackend.addScreen(formData);
      onScreenUpdated();
      setIsAddDialogOpen(false);
      resetForm();
      
      toast.success('La pantalla se ha creado correctamente.');
    } catch (error) {
      console.error('Error adding screen:', error);
      toast.error('Error al agregar la pantalla. Por favor, intenta de nuevo.');
    }
  };



  const handleEditScreen = async () => {
    if (!editingScreen) return;
    if (!formData.name) {
      toast.error('Campo requerido: Por favor, introduce un nombre para la pantalla.');
      return;
    }
    
    try {
      await mockBackend.updateScreen(editingScreen.id, formData);
      onScreenUpdated();
      setEditingScreen(null);
      resetForm();
      
      toast.success('La pantalla se ha actualizado correctamente.');
    } catch (error) {
      console.error('Error updating screen:', error);
      toast.error('Error al actualizar la pantalla. Por favor, intenta de nuevo.');
    }
  };

  const handleConfigureScreen = async () => {
    if (!configuringScreen) return;
    
    if (!configData.assignedFolder) {
      toast.error('Campo requerido: Por favor, selecciona una carpeta de contenido para la pantalla.');
      return;
    }
    
    // Configure screen directly
    try {
      await mockBackend.updateScreen(configuringScreen.id, {
        ...configuringScreen,
        assignedFolder: configData.assignedFolder,
        transitionType: configData.transitionType,
        duration: configData.duration,
      });
      onScreenUpdated();
      setConfiguringScreen(null);
      resetConfigData();
      
      toast.success('La configuración de la pantalla se ha guardado correctamente.');
    } catch (error) {
      console.error('Error configuring screen:', error);
      toast.error('Error al configurar la pantalla. Por favor, intenta de nuevo.');
    }
  };



  const handleDeleteScreen = async (screenId: number) => {
    try {
      await mockBackend.deleteScreen(screenId);
      onScreenUpdated();
      setDeletingScreen(null);
      
      toast.success('La pantalla ha sido eliminada correctamente.');
    } catch (error) {
      console.error('Error deleting screen:', error);
      
      // The error message now comes directly from the server via mock-backend
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Error al eliminar la pantalla. Por favor, intenta de nuevo.';
      
      toast.error(errorMessage);
    }
  };

  const openEditDialog = (screen: Screen) => {
    setEditingScreen(screen);
    setFormData({
      name: screen.name,
      location: screen.location || '',
      resolution: screen.resolution || '1920x1080',
      orientation: screen.orientation || 'landscape',
      assignedFolder: screen.assignedFolder || '',
      transitionType: screen.transitionType || 'fade',
      duration: screen.duration || 10,
    });
  };

  const openConfigDialog = (screen: Screen) => {
    setConfiguringScreen(screen);
    setConfigData({
      assignedFolder: screen.assignedFolder || '',
      transitionType: screen.transitionType || 'fade',
      duration: screen.duration || 10,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Pantallas</h2>
          <p className="text-gray-600">Configura y monitorea tus pantallas de visualización</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Pantalla
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Pantalla</DialogTitle>
              <DialogDescription>
                Configura una nueva pantalla de visualización para tu red publicitaria.
                <strong className="text-red-600"> La carpeta de contenido es obligatoria.</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="col-span-3"
                  placeholder="ej. Pantalla Principal"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">Ubicación</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="col-span-3"
                  placeholder="ej. Lobby Principal"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="resolution" className="text-right">Resolución</Label>
                <Select value={formData.resolution} onValueChange={(value) => setFormData(prev => ({ ...prev, resolution: value }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resolutions.map((res) => (
                      <SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="orientation" className="text-right">Orientación</Label>
                <Select value={formData.orientation} onValueChange={(value) => setFormData(prev => ({ ...prev, orientation: value as 'landscape' | 'portrait' }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Horizontal (Landscape)</SelectItem>
                    <SelectItem value="portrait">Vertical (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assigned-folder" className="text-right text-red-600">Carpeta de Contenido *</Label>
                <Select value={formData.assignedFolder} onValueChange={(value) => setFormData(prev => ({ ...prev, assignedFolder: value }))}>
                  <SelectTrigger className="col-span-3 border-red-300">
                    <SelectValue placeholder="Seleccionar carpeta (requerido)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(folders) && folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.name}>
                        {folder.name.charAt(0).toUpperCase() + folder.name.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddScreen}>Agregar Pantalla</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={!!configuringScreen} onOpenChange={(open) => !open && setConfiguringScreen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Contenido</DialogTitle>
            <DialogDescription>
              Configura el contenido y comportamiento de la pantalla.
              <strong className="text-red-600"> Debes seleccionar una carpeta de contenido.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="config-folder" className="text-right text-red-600">Contenido *</Label>
              <Select value={configData.assignedFolder} onValueChange={(value) => setConfigData(prev => ({ ...prev, assignedFolder: value }))}>
                <SelectTrigger className="col-span-3 border-red-300">
                  <SelectValue placeholder="Seleccionar carpeta (requerido)..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(folders) && folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.name}>
                      {folder.name.charAt(0).toUpperCase() + folder.name.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="config-transition" className="text-right">Transición</Label>
              <Select value={configData.transitionType} onValueChange={(value: 'fade' | 'slide') => setConfigData(prev => ({ ...prev, transitionType: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade">Desvanecimiento</SelectItem>
                  <SelectItem value="slide">Deslizamiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="config-duration" className="text-right">Duración (seg)</Label>
              <Input
                id="config-duration"
                type="number"
                min="1"
                max="60"
                value={configData.duration}
                onChange={(e) => setConfigData(prev => ({ ...prev, duration: parseInt(e.target.value) || 10 }))}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleConfigureScreen}>Guardar Configuración</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingScreen} onOpenChange={(open) => !open && setEditingScreen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pantalla</DialogTitle>
            <DialogDescription>
              Modifica la configuración de la pantalla seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-location" className="text-right">Ubicación</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-resolution" className="text-right">Resolución</Label>
              <Select value={formData.resolution} onValueChange={(value) => setFormData(prev => ({ ...prev, resolution: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutions.map((res) => (
                    <SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-orientation" className="text-right">Orientación</Label>
              <Select value={formData.orientation} onValueChange={(value) => setFormData(prev => ({ ...prev, orientation: value as 'landscape' | 'portrait' }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Horizontal (Landscape)</SelectItem>
                  <SelectItem value="portrait">Vertical (Portrait)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-assigned-folder" className="text-right">Carpeta de Contenido</Label>
              <Select value={formData.assignedFolder} onValueChange={(value) => setFormData(prev => ({ ...prev, assignedFolder: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Seleccionar carpeta..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(folders) && folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.name}>
                      {folder.name.charAt(0).toUpperCase() + folder.name.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEditScreen}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Screens Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {screens.map((screen) => (
          <Card key={screen.id} className="relative">
            <CardHeader className="pb-1.5 px-3 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" />
                  {screen.name}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {(() => {
                    const status = getScreenStatus(screen.id);
                    return (
                      <>
                        <div className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <Badge variant={status.connected ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0.5">
                          {status.connected ? 'On' : 'Off'}
                        </Badge>
                      </>
                    );
                  })()}
                </div>
              </div>
              <CardDescription className="text-[10px]">{screen.location || 'Sin ubicación'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              <div className="space-y-1">
                <span className="text-[10px] font-medium">Vista Previa:</span>
                {renderThumbnailPreview(screen.id, screen.assignedFolder, screen.orientation)}
              </div>
              
              {/*  <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium text-gray-600">Resolución:</span>
                  <p className="text-gray-500">{screen.resolution}</p>
                </div>
                {/*
              <div>
                  <span className="font-medium text-gray-600">Orientación:</span>
                  <div className="flex items-center gap-1">
                    <p className="text-gray-500">
                      {screen.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}
                    </p>
                    {screen.orientation === 'portrait' && (
                      <div className="w-3 h-4 border border-gray-400 rounded-sm bg-gray-100" title="Pantalla vertical"></div>
                    )}
                    {screen.orientation === 'landscape' && (
                      <div className="w-4 h-3 border border-gray-400 rounded-sm bg-gray-100" title="Pantalla horizontal"></div>
                    )}
                  </div>
                </div>
              
              </div>
                */}
              <div className="text-[10px]">
                <span className="font-medium text-gray-600">Contenido:</span>
                <p className="text-gray-500 truncate">
                  {screen.assignedFolder
                    ? screen.assignedFolder.charAt(0).toUpperCase() + screen.assignedFolder.slice(1)
                    : 'Sin asignar'}
                </p>
              </div>
              
              {/* Display connection count */}
              <div className="pt-1.5 border-t">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-gray-600">Displays:</span>
                  <span className="font-bold text-blue-600">
                    {getScreenStatus(screen.id).connectionCount}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-1.5 border-t">
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(screen)}
                    className="h-6 px-1.5"
                  >
                    <Edit className="h-2.5 w-2.5" />
                  </Button>
                  <AlertDialog open={deletingScreen?.id === screen.id} onOpenChange={(open) => !open && setDeletingScreen(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingScreen(screen)}
                        className="text-red-600 hover:text-red-700 h-6 px-1.5"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar pantalla?</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro? ¿Quieres eliminar la pantalla "{screen.name}"? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteScreen(screen.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700 h-6 px-1.5 text-[10px]"
                  onClick={() => openConfigDialog(screen)}
                >
                  <Settings className="h-2.5 w-2.5 mr-0.5" />
                  Config
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {screens.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay pantallas configuradas</h3>
            <p className="text-gray-500 mb-4">
              Agrega tu primera pantalla para comenzar a gestionar contenido publicitario.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Primera Pantalla
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
