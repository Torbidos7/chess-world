import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

const LoginModal = ({ isOpen, onClose }) => {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const { login, signup } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (mode === 'login') {
                await login(username, password);
            } else {
                if (!email.includes('@')) {
                    setError('Inserisci una email valida');
                    return;
                }
                await signup(username, email, password);
            }
            onClose();
        } catch (err) {
            setError(err.message || 'Autenticazione fallita');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-full max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {mode === 'login' ? <LogIn size={20} /> : <UserPlus size={20} />}
                        {mode === 'login' ? 'Login' : 'Sign Up'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'login' ? 'Accedi al tuo account Chess World' : 'Crea un nuovo account Chess World'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-muted-foreground">Username</label>
                        <Input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Enter username"
                        />
                    </div>

                    {mode === 'signup' && (
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-muted-foreground">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="Enter email"
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-muted-foreground">Password</label>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="Enter password"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        disabled={busy}
                        className="w-full"
                    >
                        {busy ? 'Caricamento...' : (mode === 'login' ? 'Login' : 'Create Account')}
                    </Button>
                </form>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login');
                            setError('');
                        }}
                        className="w-full justify-center text-primary"
                    >
                        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LoginModal;
