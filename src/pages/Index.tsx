import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Monitor, Upload, FolderOpen, Settings, Play, Users, Edit, X, ExternalLink, Plus, Trash2, CheckCircle2, BarChart3, Activity, TrendingUp, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Lazy load heavy components for better performance
const MediaUploader = lazy(() => import('@/components/MediaUploader'));
const ScreenManager = lazy(() => import('@/components/ScreenManager'));
const VideoPreview = lazy(() => import('@/components/VideoPreview'));
import { mockBackend } from '@/lib/mock-backend';
import { MediaFile, Screen } from '@/types';
import { websocketClient } from '@/lib/websocket';
import networkConfig from '@/lib/network-config';
import Header from '@/components/Header';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/hooks/useAuth';
import { useWebSocketStatus } from '@/hooks/useWebSocketStatus';
import { toast } from 'sonner';
import { formatFileSize } from '@/lib/file-utils';

// Loading component for lazy loaded components
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
);

export default function CMSDashboard() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const isWebSocketConnected = useWebSocketStatus();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [screenStatus, setScreenStatus] = useState<Record<string, unknown> | null>(null);
  const [folders, setFolders] = useState<Array<{id: number; name: string}>>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [videoPreviewFile, setVideoPreviewFile] = useState<MediaFile | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [playingVideos, setPlayingVideos] = useState<Set<number>>(new Set());

  // Note: premio messages are now handled on the server, client no longer
  // needs to track a separate external socket or message list.
  
  // Confirmation dialog states
  const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<{id: number; name: string} | null>(null);
  const [isDeletingSelectedMedia, setIsDeletingSelectedMedia] = useState(false);
  const [stats, setStats] = useState({ 
    totalFiles: 0, 
    activeScreens: 0, 
    totalStorage: 0,
    totalConfigured: 0
  });
  const [analyticsData, setAnalyticsData] = useState({
    monthlyFileOperations: {
      uploads: 0,
      deletions: 0,
      netChange: 0,
      last30DaysUploads: 0,
      last30DaysDeletions: 0
    },
    systemMetrics: {
      uptime: 0,
      avgConnectionTime: 0,
      totalConnections: 0,
      totalStorage: 0
    }
  });
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [premioServiceConnected, setPremioServiceConnected] = useState<boolean | null>(null);
  const [recentPrizes, setRecentPrizes] = useState<Array<Record<string, unknown>>>([]);
  const premioPrevRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Avoid showing toast on initial unknown -> known transition
    if (premioPrevRef.current === null) {
      premioPrevRef.current = premioServiceConnected;
      return;
    }

    if (premioServiceConnected === false && premioPrevRef.current !== false) {
      toast.error('Servicio de premios desconectado');
    } else if (premioServiceConnected === true && premioPrevRef.current !== true) {
      toast.success('Servicio de premios reconectado');
    }

    premioPrevRef.current = premioServiceConnected;
  }, [premioServiceConnected]);
  const [currentTab, setCurrentTab] = useState('media');
  const [hasLoadedAnalytics, setHasLoadedAnalytics] = useState(false);
  const currentTabRef = useRef('media');
  const screensRef = useRef<Screen[]>([]);

  useEffect(() => {
    // Add a small delay in development to allow server to start up
    const isDevelopment = import.meta.env.DEV;
    const initData = async () => {
      if (isDevelopment) {
        // Wait 2 seconds in development to allow server startup
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      await loadData();
    };
    
    // Initialize data
    initData();

    // Fetch initial premio service status (avoids showing 'Desconocido' on load)
    fetch('/api/premio-status')
      .then(r => r.json())
      .then(d => setPremioServiceConnected(d.connected === true))
      .catch(() => {});
    // Fetch last 3 recent prizes persisted on the server
    fetch('/api/premio/recent')
      .then(r => r.json())
      .then(list => {
        if (Array.isArray(list)) setRecentPrizes(list as Array<Record<string, unknown>>);
      })
      .catch(() => {});
    
    // Setup WebSocket for real-time updates
    websocketClient.connect();
    websocketClient.onMessage((data) => {
      if (data.type === 'media_updated') {
        // Only reload media files, don't touch other stats
        loadMediaFiles();
      } else if (data.type === 'screen_updated') {
        // Only reload screens and update screen-related stats
        loadScreens();
        updateScreenStatus();
      } else if (data.type === 'connection_update') {
        // Only update connection-related metrics
        updateScreenStatus();
      } else if (data.type === 'premio_connection') {
        // Server notifies CMS about external premio service status
        try {
          const connected = data.data && data.data.connected === true;
          setPremioServiceConnected(connected);
        } catch (e) {
          setPremioServiceConnected(false);
        }
      } else if (data.type === 'premio_received') {
        // A prize was broadcast — keep the last 3
        setRecentPrizes(prev => [data.data, ...prev].slice(0, 3) as Array<Record<string, unknown>>);
      } else if (data.type === 'analytics_updated') {
        // Only reload analytics data if user is viewing analytics tab
        if (currentTabRef.current === 'analytics') {
          loadAnalyticsData();
        }
      }
    });

    // previously we opened an external WS here for premios; that logic is
    // now handled on the server so the client no longer needs to connect.
    return () => {
      websocketClient.disconnect();
    };
  }, []);

  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);

  const loadData = async () => {
    await loadMediaFiles();
    await loadScreens();
    await loadFolders();
    // Analytics will be loaded on-demand when the analytics tab is opened
  };

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/folders');
      const folderData = await response.json();
      setFolders(folderData);
      
      // Set first folder as default if none selected
      if (!selectedFolder && folderData.length > 0) {
        setSelectedFolder(folderData[0].name);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  useEffect(() => {
    updateStats();
  }, [mediaFiles, screens]);

  const loadMediaFiles = async () => {
    const files = await mockBackend.getMediaFiles();
    setMediaFiles(files);
  };

  const loadScreens = async () => {
    const screenList = await mockBackend.getScreens();
    setScreens(screenList);
  };

  const loadAnalyticsData = async () => {
    setIsLoadingAnalytics(true);
    let success = false;
    try {
      const response = await fetch('/api/analytics');
      if (response.ok) {
        const analytics = await response.json();
        
        // Only update analytics data if we get valid results
        if (analytics && typeof analytics === 'object') {
          setAnalyticsData(analytics);
          
          // Update storage metric from analytics API only if it's valid
          if (analytics.systemMetrics && analytics.systemMetrics.totalStorage >= 0) {
            setStats(prevStats => ({
              ...prevStats,
              totalStorage: analytics.systemMetrics.totalStorage
            }));
          }
          success = true;
        }
      } else {
    // console.log('Analytics API not available, keeping existing values');
        // Keep existing values without any changes
      }
    } catch (error) {
    // console.log('Analytics not available, maintaining current state');
      // Don't reset or change analytics data on error
    } finally {
      setIsLoadingAnalytics(false);
    }
    return success;
  };

  const updateStats = async () => {
    const totalFiles = mediaFiles.length;
    // Use analytics storage if available, fallback to local calculation
    const totalStorage = analyticsData.systemMetrics.totalStorage > 0 
      ? analyticsData.systemMetrics.totalStorage 
      : mediaFiles.reduce((sum, file) => sum + file.size, 0);
    
    // Get screen status from API
    try {
      const response = await fetch('/api/status/screens');
      const screenData = await response.json();
      setScreenStatus(screenData);
      setStats({ 
        totalFiles, 
        activeScreens: screenData.totalConnected || 0,
        totalStorage,
        totalConfigured: screenData.totalConfigured || screens.length
      });
    } catch (error) {
      console.error('Failed to fetch screen status:', error);
      // Fallback to basic stats
      setStats({ 
        totalFiles, 
        activeScreens: 0,
        totalStorage,
        totalConfigured: screens.length
      });
    }
  };

  // Separate function to update only screen status without touching storage/files
  const updateScreenStatus = async () => {
    try {
      const response = await fetch('/api/status/screens');
      const screenData = await response.json();
      setScreenStatus(screenData);
      
      // Only update screen-related stats, preserve storage and file counts
      setStats(prevStats => ({
        ...prevStats,
        activeScreens: screenData.totalConnected || 0,
        totalConfigured: screenData.totalConfigured || screens.length
      }));
    } catch (error) {
      console.error('Failed to fetch screen status:', error);
      // Don't update anything on error to maintain stability
    }
  };

  const handleMediaUploaded = async () => {
    // Only reload media files
    await loadMediaFiles();
    
    // Update only file-related stats without affecting other metrics
    setStats(prevStats => ({
      ...prevStats,
      totalFiles: mediaFiles.length + 1 // Optimistic update
    }));
  };

  const handleDeleteMedia = async (id: number) => {
    try {
      await mockBackend.deleteMediaFile(id);
      await loadMediaFiles();
      setDeletingMediaId(null);
      toast.success('El archivo ha sido eliminado correctamente');
    } catch (error) {
      console.error('Failed to delete media file:', error);
      toast.error('Error al eliminar el archivo');
    }
  };

  const handleEditMedia = async (id: number, currentName: string) => {
    const newName = prompt('Editar nombre del archivo:', currentName);

    if (newName && newName.trim() && newName !== currentName) {
      try {
        await mockBackend.updateMedia(id, newName);
        await loadMediaFiles();
        toast.success('El nombre del archivo ha sido actualizado');
      } catch (error) {
        console.error('Failed to update media file:', error);
        toast.error('Error al actualizar el archivo');
      }
    }
  };

  const handleScreenUpdated = () => {
    // Only reload screens
    loadScreens();
    updateScreenStatus();
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Por favor ingresa un nombre para la carpeta');
      return;
    }

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName.trim() })
      });

      if (response.ok) {
        await loadFolders();
        setIsAddFolderDialogOpen(false);
        setNewFolderName('');
        toast.success('Carpeta creada correctamente');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear la carpeta');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error al crear la carpeta');
    }
  };

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadFolders();
        // If deleted folder was selected, select first available folder
        if (selectedFolder === folderName && folders.length > 1) {
          const remainingFolders = folders.filter(f => f.name !== folderName);
          setSelectedFolder(remainingFolders[0]?.name || '');
        }
        setDeletingFolder(null);
        toast.success('La carpeta ha sido eliminada correctamente');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al eliminar la carpeta');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Error al eliminar la carpeta');
    }
  };

  const filteredFiles = selectedFolder 
    ? mediaFiles.filter(file => file.folder === selectedFolder)
    : [];

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedMediaFiles(new Set());
  };

  const toggleMediaSelection = (fileId: number) => {
    const newSelection = new Set(selectedMediaFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedMediaFiles(newSelection);
  };

  const selectAllMedia = () => {
    if (selectedMediaFiles.size === filteredFiles.length) {
      setSelectedMediaFiles(new Set());
    } else {
      setSelectedMediaFiles(new Set(filteredFiles.map(file => file.id)));
    }
  };

  const deleteSelectedMedia = async () => {
    try {
      await Promise.all(
        Array.from(selectedMediaFiles).map(fileId => 
          mockBackend.deleteMediaFile(fileId)
        )
      );
      
      await loadMediaFiles();
      setSelectedMediaFiles(new Set());
      setIsMultiSelectMode(false);
      setIsDeletingSelectedMedia(false);
      
      toast.success('Los archivos han sido eliminados correctamente');
    } catch (error) {
      console.error('Error deleting files:', error);
      toast.error('Error al eliminar algunos archivos');
    }
  };


  const handleVideoPreview = (file: MediaFile) => {
    setVideoPreviewFile(file);
    setIsVideoPreviewOpen(true);
  };

  const handleCloseVideoPreview = () => {
    setIsVideoPreviewOpen(false);
    setVideoPreviewFile(null);
  };

  const toggleVideoPlay = (fileId: number) => {
    const newPlayingVideos = new Set(playingVideos);
    if (newPlayingVideos.has(fileId)) {
      newPlayingVideos.delete(fileId);
    } else {
      newPlayingVideos.add(fileId);
    }
    setPlayingVideos(newPlayingVideos);
  };

  const handleTabChange = async (value: string) => {
    setCurrentTab(value);
    currentTabRef.current = value;
    // Load analytics data only when analytics tab is opened and hasn't been loaded yet
    if (value === 'analytics' && !hasLoadedAnalytics) {
      const success = await loadAnalyticsData();
      // Only mark as loaded if successful, so it can retry on next tab open if it failed
      if (success) {
        setHasLoadedAnalytics(true);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Stats Cards */}
      <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8 py-2 sm:py-4 flex-shrink-0 border-b">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-2 sm:mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Archivos Totales</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFiles}</div>
              <p className="text-xs text-muted-foreground">Imágenes y videos</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Displays Conectados</CardTitle>
              <Monitor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.activeScreens}</div>
              <p className="text-xs text-muted-foreground">displays conectados de {stats.totalConfigured} pantallas configuradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Almacenamiento</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatFileSize(stats.totalStorage)}</div>
              <p className="text-xs text-muted-foreground">Espacio utilizado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estado Sistema</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">Dashboard</span>
                <span className={`text-xs font-semibold ml-auto ${isWebSocketConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isWebSocketConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Premios</span>
                <span className={`text-xs font-semibold ml-auto ${premioServiceConnected === null ? 'text-gray-500' : premioServiceConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {premioServiceConnected === null ? 'Verificando...' : premioServiceConnected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Prizes Row */}
        <div className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Últimos 3 Premios
              </CardTitle>
              <span className="text-xs text-muted-foreground">{recentPrizes.length === 0 ? 'Sin premios en esta sesión' : `${recentPrizes.length} premio(s)`}</span>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {recentPrizes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Ningún premio recibido aún</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recentPrizes.map((prize, idx) => (
                    <div key={idx} className="flex flex-col gap-0.5 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">#{recentPrizes.length - idx}</span>
                        <span className="text-xs text-muted-foreground">
                          {prize.receivedAt ? new Date(prize.receivedAt as number).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {(prize.montoFormateado as string) || (prize.monto ? `$${prize.monto}` : '—')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Máq: <span className="font-medium text-foreground">{(prize.maquina as string) || '—'}</span>
                      </div>
                      {prize.ubicacion && (
                        <div className="text-xs text-muted-foreground truncate">{prize.ubicacion as string}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="flex-grow overflow-hidden px-2 sm:px-4 lg:px-6 xl:px-8">
        <div className="flex-grow">
          <Tabs defaultValue="media" value={currentTab} onValueChange={handleTabChange} className="flex flex-col">
            <div className="flex-shrink-0">
              <TabsList className="grid w-full grid-cols-3 h-8 lg:h-10">
                <TabsTrigger value="media">Gestión de Medios</TabsTrigger>
                <TabsTrigger value="screens">Pantallas</TabsTrigger>
                <TabsTrigger value="analytics">Analíticas</TabsTrigger>
              </TabsList>
            </div>

          <TabsContent value="media" className="flex-grow">
            <div className="flex flex-col lg:grid lg:grid-cols-6 gap-4">
              {/* Folders Sidebar */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Carpetas</CardTitle>
                      <CardDescription>Organiza tu contenido</CardDescription>
                    </div>
                    <Dialog open={isAddFolderDialogOpen} onOpenChange={setIsAddFolderDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Agregar Nueva Carpeta</DialogTitle>
                          <DialogDescription>
                            Crea una nueva carpeta para organizar tu contenido multimedia.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="folder-name" className="text-right">Nombre</Label>
                            <Input
                              id="folder-name"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              className="col-span-3"
                              placeholder="ej. ofertas-especiales"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddFolder}>Crear Carpeta</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {folders.map((folder) => (
                    <div key={folder.id} className="flex items-center justify-between">
                      <Button
                        variant={selectedFolder === folder.name ? "default" : "ghost"}
                        className="flex-1 justify-start"
                        onClick={() => setSelectedFolder(folder.name)}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {folder.name.charAt(0).toUpperCase() + folder.name.slice(1)}
                      </Button>
                      <AlertDialog open={deletingFolder?.id === folder.id} onOpenChange={(open) => !open && setDeletingFolder(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeletingFolder(folder)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar carpeta?</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro? ¿Quieres eliminar la carpeta "{folder.name}"? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteFolder(folder.id, folder.name)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                  {folders.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No hay carpetas. Crea una carpeta para comenzar.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Media Content - Center Column */}
              <Card className="lg:col-span-3 flex flex-col">
                  <CardHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Contenido Multimedia</CardTitle>
                        <CardDescription>
                          {filteredFiles.length} archivos en {selectedFolder ? selectedFolder : 'carpeta seleccionada'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={isMultiSelectMode ? "default" : "outline"}
                          size="sm"
                          onClick={toggleMultiSelectMode}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {isMultiSelectMode ? 'Cancelar' : 'Seleccionar'}
                        </Button>
                        {isMultiSelectMode && (
                          <>
                            <Button variant="outline" size="sm" onClick={selectAllMedia}>
                              {selectedMediaFiles.size === filteredFiles.length ? 'Deseleccionar' : 'Seleccionar'} Todo
                            </Button>
                            {selectedMediaFiles.size > 0 && (
                              <AlertDialog open={isDeletingSelectedMedia} onOpenChange={setIsDeletingSelectedMedia}>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar ({selectedMediaFiles.size})
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar archivos seleccionados?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      ¿Estás seguro? ¿Quieres eliminar {selectedMediaFiles.size} archivo(s) seleccionado(s)? Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={deleteSelectedMedia}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-grow overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
                      {filteredFiles.map((file) => (
                        <div 
                          key={file.id} 
                          className={`group relative cursor-pointer ${
                            isMultiSelectMode && selectedMediaFiles.has(file.id) 
                              ? 'ring-2 ring-blue-500 bg-blue-50' 
                              : ''
                          }`}
                          onClick={() => isMultiSelectMode && toggleMediaSelection(file.id)}
                        >
                          {isMultiSelectMode && (
                            <div className="absolute top-2 left-2 z-20">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedMediaFiles.has(file.id) 
                                  ? 'bg-blue-500 border-blue-500' 
                                  : 'bg-white border-gray-300'
                              }`}>
                                {selectedMediaFiles.has(file.id) && (
                                  <CheckCircle2 className="h-3 w-3 text-white" />
                                )}
                              </div>
                            </div>
                          )}
                          {!isMultiSelectMode && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              {file.type.startsWith('video/') && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6 bg-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVideoPreview(file);
                                  }}
                                  title="Ver en pantalla completa"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 bg-white"
                                onClick={() => handleEditMedia(file.id, file.name)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <AlertDialog open={deletingMediaId === file.id} onOpenChange={(open) => !open && setDeletingMediaId(null)}>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setDeletingMediaId(file.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      ¿Estás seguro? ¿Quieres eliminar el archivo "{file.name}"? Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteMedia(file.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={file.thumbnail || file.path || file.url}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : file.type.startsWith('video/') ? (
                              <div className="w-full h-full relative">
                                {playingVideos.has(file.id) ? (
                                  // Show video player when playing
                                  <video
                                    src={file.path || file.url}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-cover rounded-lg"
                                    onEnded={() => toggleVideoPlay(file.id)}
                                    onClick={(e) => {
                                      if (isMultiSelectMode) {
                                        e.preventDefault();
                                        toggleMediaSelection(file.id);
                                      }
                                    }}
                                  />
                                ) : (
                                  // Show video frame without any overlay
                                  <video
                                    src={file.path || file.url}
                                    className="w-full h-full object-cover rounded-lg cursor-pointer"
                                    onClick={() => {
                                      if (isMultiSelectMode) {
                                        toggleMediaSelection(file.id);
                                      } else {
                                        toggleVideoPlay(file.id);
                                      }
                                    }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                <Play className="h-8 w-8 text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <div className="flex items-center justify-between mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {file.type.startsWith('image/') ? 'IMG' : 'VID'}
                              </Badge>
                              <span className="text-xs text-gray-500">{formatFileSize(file.size || 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              {/* Upload Dropzone - Right Column */}
              <div className="lg:col-span-2">
                <Suspense fallback={<ComponentLoader />}>
                  <MediaUploader onMediaUploaded={handleMediaUploaded} selectedFolder={selectedFolder} />
                </Suspense>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="screens" className="flex-grow overflow-y-auto">
            <Suspense fallback={<ComponentLoader />}>
              <ScreenManager screens={screens} onScreenUpdated={handleScreenUpdated} />
            </Suspense>
          </TabsContent>

          <TabsContent value="analytics" className="flex-grow overflow-y-auto">
            <div className="space-y-6">
              {/* Real-time indicator */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Analíticas del Sistema</h3>
                  <p className="text-sm text-muted-foreground">
                    {isLoadingAnalytics ? 'Cargando datos...' : 'Datos actualizados al abrir esta pestaña'}
                  </p>
                </div>
                <Button 
                  onClick={async () => {
                    const success = await loadAnalyticsData();
                    if (success) {
                      setHasLoadedAnalytics(true);
                    }
                  }} 
                  variant="outline" 
                  size="sm"
                  disabled={isLoadingAnalytics}
                >
                  {isLoadingAnalytics ? 'Actualizando...' : 'Actualizar'}
                </Button>
              </div>
              
              {/* Core Analytics - Essential metrics only */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tiempo Activo</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.systemMetrics.uptime > 0 
                        ? `${Math.floor(analyticsData.systemMetrics.uptime / 3600)}h ${Math.floor((analyticsData.systemMetrics.uptime % 3600) / 60)}m`
                        : '0h 0m'
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">Sistema en funcionamiento</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sesión Promedio</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {analyticsData.systemMetrics.avgConnectionTime > 0 
                        ? `${analyticsData.systemMetrics.avgConnectionTime}h`
                        : 'Sin datos'
                      }
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.systemMetrics.avgConnectionTime > 0 
                        ? 'Duración promedio conexiones'
                        : 'No hay conexiones registradas'
                      }
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Archivos del Mes</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {analyticsData.monthlyFileOperations.netChange >= 0 ? '+' : ''}{analyticsData.monthlyFileOperations.netChange}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analyticsData.monthlyFileOperations.uploads} subidos - {analyticsData.monthlyFileOperations.deletions} eliminados
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Averages */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Últimos 30 Días - Subidas</CardTitle>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {analyticsData.monthlyFileOperations.last30DaysUploads}
                    </div>
                    <p className="text-xs text-muted-foreground">Archivos subidos en los últimos 30 días</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Últimos 30 Días - Eliminaciones</CardTitle>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {analyticsData.monthlyFileOperations.last30DaysDeletions}
                    </div>
                    <p className="text-xs text-muted-foreground">Archivos eliminados en los últimos 30 días</p>
                  </CardContent>
                </Card>
              </div>


            </div>
          </TabsContent>
        </Tabs>
        </div>

        {/* Creator Disclaimer */}
        <div className="flex-shrink-0 border-t pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Desarrollado por <strong className="text-foreground">Dreams Coyhaique</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Video Preview Modal */}
      <Suspense fallback={<div />}>
        <VideoPreview
          isOpen={isVideoPreviewOpen}
          onClose={handleCloseVideoPreview}
          mediaFile={videoPreviewFile}
        />
      </Suspense>
    </div>
  );
}
