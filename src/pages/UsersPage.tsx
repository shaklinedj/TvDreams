import { useEffect, useState } from 'react';
import { apiService } from '@/lib/mock-backend';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Key, UserPlus, Copy, ExternalLink, Send } from 'lucide-react';
import { toast } from 'sonner';


interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    first_login?: boolean | number;
    created_at?: string;
}

const UsersPage = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [error, setError] = useState('');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editRole, setEditRole] = useState('');
    const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [shareableInfo, setShareableInfo] = useState<{
        username: string;
        temporaryPassword: string;
        loginUrl: string;
        message: string;
    } | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            const fetchedUsers = await apiService.getUsers();
            setUsers(fetchedUsers);
        } catch (err) {
            setError('Failed to fetch users');
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (userId: number) => {
        try {
            await apiService.deleteUser(userId);
            fetchUsers(); // Refresh users after deletion
            toast.success('Usuario eliminado exitosamente');
        } catch (err) {
            setError('Failed to delete user');
            toast.error('Error al eliminar usuario');
        }
    };

    const handleEditRole = async () => {
        if (!editingUser) return;
        
        try {
            await apiService.updateUser(editingUser.id, { role: editRole });
            fetchUsers();
            setEditingUser(null);
            toast.success('Rol actualizado exitosamente');
        } catch (err) {
            setError('Failed to update user role');
            toast.error('Error al actualizar rol');
        }
    };

    const handleResetPassword = async () => {
        if (!resetPasswordUser) return;

        try {
            const authData = localStorage.getItem('auth-storage');
            const token = authData ? JSON.parse(authData).state?.token : '';

            const response = await fetch(`/api/users/${resetPasswordUser.id}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword: newPassword || undefined }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al restablecer contraseña');
            }

            const result = await response.json();
            setResetPasswordUser(null);
            setNewPassword('');
            fetchUsers();
            
            if (result.shareableInfo) {
                setShareableInfo(result.shareableInfo);
                setShowShareDialog(true);
                toast.success('Contraseña restablecida. Comparte la información con el usuario.');
            } else {
                toast.success('Contraseña restablecida exitosamente.');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error al restablecer contraseña');
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

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    return (
        <div className="container mx-auto py-10">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="outline" 
                        onClick={() => navigate('/')}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver al Dashboard
                    </Button>
                    <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
                </div>
                <Button 
                    onClick={() => navigate('/create-user')}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Usuario
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha Creación</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.id}</TableCell>
                                <TableCell className="font-medium">{user.username}</TableCell>
                                <TableCell>{user.email || 'No especificado'}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                        {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {user.first_login === 1 || user.first_login === true ? (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            Primer Login
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-green-600 border-green-300">
                                            Activo
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {user.created_at 
                                        ? new Date(user.created_at).toLocaleDateString()
                                        : 'No disponible'
                                    }
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {/* Edit Role Dialog */}
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingUser(user);
                                                        setEditRole(user.role);
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Editar Usuario: {user.username}</DialogTitle>
                                                    <DialogDescription>
                                                        Modifica el rol del usuario
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="role">Rol</Label>
                                                        <Select value={editRole} onValueChange={setEditRole}>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecciona un rol" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="user">Usuario</SelectItem>
                                                                <SelectItem value="admin">Administrador</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => setEditingUser(null)}>
                                                        Cancelar
                                                    </Button>
                                                    <Button onClick={handleEditRole}>
                                                        Guardar Cambios
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        {/* Reset Password Dialog */}
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setResetPasswordUser(user)}
                                                >
                                                    <Key className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Restablecer Contraseña: {user.username}</DialogTitle>
                                                    <DialogDescription>
                                                        Establece una nueva contraseña para el usuario o deja en blanco para generar una temporal.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="newPassword">Nueva Contraseña (opcional)</Label>
                                                        <Input
                                                            id="newPassword"
                                                            type="password"
                                                            placeholder="Dejar en blanco para generar automáticamente"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                        />
                                                        <p className="text-sm text-gray-500">
                                                            Si no especificas una contraseña, se generará una temporal y se enviará por email.
                                                        </p>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button variant="outline" onClick={() => {
                                                        setResetPasswordUser(null);
                                                        setNewPassword('');
                                                    }}>
                                                        Cancelar
                                                    </Button>
                                                    <Button onClick={handleResetPassword}>
                                                        Restablecer Contraseña
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        {/* Delete User Dialog */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta de usuario "{user.username}".
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(user.id)}>
                                                        Eliminar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {users.length === 0 && (
                    <div className="text-center py-12">
                        <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay usuarios</h3>
                        <p className="text-gray-500 mb-4">Comienza creando tu primer usuario.</p>
                        <Button onClick={() => navigate('/create-user')}>
                            <Plus className="h-4 w-4 mr-2" />
                            Crear Usuario
                        </Button>
                    </div>
                )}
            </div>

            {/* Shareable Link Dialog */}
            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Contraseña Restablecida</DialogTitle>
                        <DialogDescription>
                            Comparte estas credenciales con el usuario
                        </DialogDescription>
                    </DialogHeader>
                    
                    {shareableInfo && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium mb-2">Nuevas Credenciales:</h4>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <strong>Usuario:</strong> {shareableInfo.username}
                                    </div>
                                    <div>
                                        <strong>Nueva contraseña temporal:</strong> {shareableInfo.temporaryPassword}
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
                                        onClick={() => openEmailClient(shareableInfo.message, `Credenciales restablecidas para ${shareableInfo.username}`)}
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

export default UsersPage;
