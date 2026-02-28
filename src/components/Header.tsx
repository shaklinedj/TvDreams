import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '@/hooks/useAuth';
import { Button } from './ui/button';
import { Monitor } from 'lucide-react';

const Header = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const openDisplayApp = () => {
        window.open('/display.html', '_blank', 'fullscreen=yes,scrollbars=no,menubar=no,toolbar=no,location=no,status=no');
    };

    return (
        <header className="bg-background border-b sticky top-0 z-50">
            <div className="container mx-auto px-4 py-2 sm:py-3 flex justify-between items-center">
                <h1 className="text-lg sm:text-xl font-bold">Gestor de Pantallas Dreams</h1>
                <div className="flex items-center space-x-2 sm:space-x-4">
                    <Button 
                        onClick={openDisplayApp}
                        className="bg-blue-600 hover:bg-blue-700 hidden sm:flex"
                        size="sm"
                    >
                        <Monitor className="h-4 w-4 mr-2" />
                        Abrir Display
                    </Button>
                    {/* Mobile version - icon only */}
                    <Button 
                        onClick={openDisplayApp}
                        className="bg-blue-600 hover:bg-blue-700 sm:hidden"
                        size="sm"
                    >
                        <Monitor className="h-4 w-4" />
                    </Button>
                    {user && (
                        <span className="text-sm text-muted-foreground hidden md:inline">
                            Bienvenido, <strong>{user.username}</strong>
                        </span>
                    )}
                    {user?.role === 'admin' && (
                        <Link to="/users">
                            <Button variant="outline" size="sm">
                                <span className="hidden sm:inline">Gestión de Usuarios</span>
                                <span className="sm:hidden">Usuarios</span>
                            </Button>
                        </Link>
                    )}
                    <Button onClick={handleLogout} size="sm">
                        <span className="hidden sm:inline">Cerrar Sesión</span>
                        <span className="sm:hidden">Salir</span>
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default Header;
