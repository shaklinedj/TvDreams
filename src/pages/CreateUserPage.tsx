import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiService } from '@/lib/mock-backend';
import { ArrowLeft, Mail, User, Shield, Copy, ExternalLink, Send } from 'lucide-react';
import { toast } from 'sonner';

const CreateUserPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [shareableInfo, setShareableInfo] = useState<{
    username: string;
    temporaryPassword: string;
    loginUrl: string;
    message: string;
  } | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const navigate = useNavigate();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !email) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token : ''}`
        },
        body: JSON.stringify({ username, email, role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear usuario');
      }

      const result = await response.json();
      
      if (result.shareableInfo) {
        setShareableInfo(result.shareableInfo);
        setShowShareDialog(true);
      }
      
      toast.success(`Usuario ${username} creado exitosamente`);
      
      // Reset form
      setUsername('');
      setEmail('');
      setRole('user');
      
    } catch (error) {
      console.error('Create user error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copiado al portapapeles');
    }).catch(() => {
      toast.error('Error al copiar');
    });
  };

  const openEmailClient = (message: string, subject: string = 'Credenciales de Acceso') => {
    const emailBody = encodeURIComponent(message);
    const emailSubject = encodeURIComponent(subject);
    const mailtoLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;
    window.open(mailtoLink, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto py-10">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Crear Nuevo Usuario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nombre de Usuario *
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Ingrese el nombre de usuario"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Correo Electrónico *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@ejemplo.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">
                    Se generará un enlace para compartir las credenciales
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Rol de Usuario
                  </Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-2">ℹ️ Información Importante:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Se generará una contraseña temporal automáticamente</li>
                    <li>• El usuario debe cambiar la contraseña en el primer login</li>
                    <li>• Se generará un enlace para compartir las credenciales</li>
                    <li>• La sesión se mantendrá activa por 7 días</li>
                  </ul>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? 'Creando Usuario...' : 'Crear Usuario'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Shareable Link Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Usuario Creado Exitosamente</DialogTitle>
            <DialogDescription>
              Comparte estas credenciales con el nuevo usuario
            </DialogDescription>
          </DialogHeader>
          
          {shareableInfo && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Credenciales de Acceso:</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Usuario:</strong> {shareableInfo.username}
                  </div>
                  <div>
                    <strong>Contraseña temporal:</strong> {shareableInfo.temporaryPassword}
                  </div>
                  <div>
                    <strong>URL de acceso:</strong>
                    <div className="flex items-center gap-2 mt-1">
                      <Input 
                        value={shareableInfo.loginUrl} 
                        readOnly 
                        className="text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(shareableInfo.loginUrl)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">💌 Compartir Credenciales:</h4>
                <div className="bg-white p-3 rounded border text-sm mb-3" style={{ whiteSpace: 'pre-line' }}>
                  {shareableInfo.message}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(shareableInfo.message)}
                    className="flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEmailClient(shareableInfo.message, `Credenciales de acceso para ${shareableInfo.username}`)}
                    className="flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(shareableInfo.loginUrl, '_blank')}
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ir al Login
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowShareDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateUserPage;