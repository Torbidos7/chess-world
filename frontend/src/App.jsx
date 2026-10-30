import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, BookOpen, User, Settings, MessageSquare, Menu, X, ChevronRight, ChevronLeft, GripVertical, Camera, Send, LogOut, LogIn, Sun, Moon } from 'lucide-react';
import html2canvas from 'html2canvas';
import ChessboardComponent from './components/Chessboard';
import Training from './components/Training';
import Problems from './components/Problems';
import Profile from './components/Profile';
import LoginModal from './components/LoginModal';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Avatar, AvatarFallback } from './components/ui/avatar';
import { useLLM } from './hooks/useLLM';
import { useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const [activeTab, setActiveTab] = useState('play');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [chatInput, setChatInput] = useState('');
  const [ollamaHealthy, setOllamaHealthy] = useState(null);
  const [pendingScreenshot, setPendingScreenshot] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const sidebarRef = useRef(null);
  const isResizingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const mainContentRef = useRef(null);

  const { loading: llmLoading, error: llmError, messages, sendMessage, checkHealth } = useLLM();

  // Check Ollama health on mount
  useEffect(() => {
    checkHealth().then(health => {
      setOllamaHealthy(health?.ollama_running && health?.model_available);
    });
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startResizing = (e) => {
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  const handleMouseMove = (e) => {
    if (isResizingRef.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 600) {
        setRightSidebarWidth(newWidth);
      }
    }
  };

  const stopResizing = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };

  const captureScreenshot = async () => {
    if (!mainContentRef.current) return null;

    try {
      // Find the chessboard element
      // Find the chessboard element - try multiple selectors
      let chessboardElement = mainContentRef.current.querySelector('[id$="Board"]');

      if (!chessboardElement) {
        // Fallback: try to find any element that looks like a board container
        chessboardElement = mainContentRef.current.querySelector('div[data-boardid]') ||
          mainContentRef.current.querySelector('.chessboard-container') ||
          mainContentRef.current.querySelector('div[style*="aspect-ratio"]');
      }

      if (!chessboardElement) {
        console.error('Screenshot failed: No chessboard element found. Available IDs:',
          Array.from(mainContentRef.current.querySelectorAll('[id]')).map(el => el.id));
        alert('No chessboard found to capture');
        return null;
      }

      const canvas = await html2canvas(chessboardElement, {
        backgroundColor: '#1f2937',
        scale: 2
      });

      return canvas.toDataURL('image/png').split(',')[1]; // Return base64 without prefix
    } catch (error) {
      console.error('Screenshot error:', error);
      alert('Failed to capture screenshot');
      return null;
    }
  };

  const handleScreenshotCapture = async () => {
    const imageBase64 = await captureScreenshot();
    if (imageBase64) {
      setPendingScreenshot(imageBase64);
      setChatInput('Analyze this position');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const prompt = chatInput;
    const screenshot = pendingScreenshot;
    setChatInput('');
    setPendingScreenshot(null);
    await sendMessage(prompt, null, screenshot);
  };

  const handleTabClick = (tab) => {
    // Restrict non-Play tabs if not authenticated
    if (!isAuthenticated && tab !== 'play') {
      setShowLoginModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'play':
        return <ChessboardComponent />;
      case 'training':
        return <Training />;
      case 'problems':
        return <Problems />;
      case 'profile':
        return <Profile />;
      default:
        return <ChessboardComponent />;
    }
  };

  return (
    <div className="flex h-screen bg-chess-dark text-chess-light font-sans overflow-hidden">
      {/* Left Sidebar (Navigation) */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          {isSidebarOpen && <h1 className="text-xl font-bold text-primary tracking-wider">CHESS WORLD</h1>}
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="rounded-lg">
            <Menu size={20} />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Play" active={activeTab === 'play'} onClick={() => handleTabClick('play')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<BookOpen size={20} />} label="Training" active={activeTab === 'training'} onClick={() => handleTabClick('training')} isOpen={isSidebarOpen} locked={!isAuthenticated} />
          <SidebarItem icon={<Settings size={20} />} label="Problems" active={activeTab === 'problems'} onClick={() => handleTabClick('problems')} isOpen={isSidebarOpen} locked={!isAuthenticated} />
          <SidebarItem icon={<User size={20} />} label="Profile" active={activeTab === 'profile'} onClick={() => handleTabClick('profile')} isOpen={isSidebarOpen} locked={!isAuthenticated} />
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {isSidebarOpen ? (
            <div className="space-y-2">
              <Button
                variant="ghost"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-full justify-center gap-2 text-muted-foreground"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="mx-auto block text-muted-foreground"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          )}
          {isSidebarOpen ? (
            isAuthenticated ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{user?.username}</div>
                    <Badge variant="secondary">ELO {user?.elo || 1200}</Badge>
                  </div>
                </div>
                <Button
                  onClick={logout}
                  variant="secondary"
                  className="w-full justify-center gap-2"
                >
                  <LogOut size={16} />
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowLoginModal(true)}
                className="w-full justify-center gap-2"
              >
                <LogIn size={18} />
                Login
              </Button>
            )
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground mx-auto cursor-pointer" onClick={() => setShowLoginModal(true)}>
              {isAuthenticated ? (user?.username?.[0]?.toUpperCase() || 'U') : <LogIn size={16} />}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header with Right Sidebar Toggle */}
        <header className="h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-foreground capitalize">{activeTab} Mode</h2>
          {!isRightSidebarOpen && (
            <Button
              onClick={() => setIsRightSidebarOpen(true)}
              variant="outline"
              className="gap-2 text-primary"
              title="Open Chat Assistant"
            >
              <MessageSquare size={20} />
              {ollamaHealthy === false && <span className="text-xs text-destructive">Offline</span>}
            </Button>
          )}
        </header>

        <main ref={mainContentRef} className="flex-1 overflow-y-auto bg-muted/30 p-6 relative">
          {renderContent()}
        </main>
      </div>

      {/* Right Sidebar (LLM Chat Assistant) */}
      {isRightSidebarOpen && (
        <div
          className="bg-sidebar border-l border-sidebar-border flex flex-col relative shadow-2xl z-20"
          style={{ width: rightSidebarWidth }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary transition-colors z-30 flex items-center justify-center group"
            onMouseDown={startResizing}
          >
            <div className="w-4 h-8 bg-muted rounded-l flex items-center justify-center -ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={12} className="text-muted-foreground" />
            </div>
          </div>

          <div className="p-4 border-b border-sidebar-border flex items-center justify-between bg-sidebar">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              Chess Assistant
              {ollamaHealthy !== null && (
                <span className={`ml-2 w-2 h-2 rounded-full ${ollamaHealthy ? 'bg-green-500' : 'bg-red-500'}`} title={ollamaHealthy ? 'Ollama running' : 'Ollama offline'}></span>
              )}
            </h3>
            <Button
              onClick={() => setIsRightSidebarOpen(false)}
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg ${msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.isError
                    ? 'bg-destructive/10 border border-destructive text-destructive'
                    : 'bg-card border border-border text-foreground'
                  }`}>
                  {msg.image && <div className="text-xs opacity-75 mb-1">📷 With screenshot</div>}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  {msg.suggested_moves && msg.suggested_moves.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-xs font-semibold mb-1">Suggested moves:</div>
                      <div className="flex flex-wrap gap-1">
                        {msg.suggested_moves.map((move, i) => (
                          <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{move}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {llmLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-sidebar-border bg-sidebar">
            {!ollamaHealthy && ollamaHealthy !== null && (
              <div className="mb-2 p-2 bg-destructive/10 border border-destructive rounded text-xs text-destructive">
                Ollama not running. Start: <code className="bg-muted px-1 rounded">ollama serve</code>
              </div>
            )}
            {pendingScreenshot && (
              <div className="mb-2 relative">
                <img
                  src={`data:image/png;base64,${pendingScreenshot}`}
                  alt="Chess board preview"
                  className="w-full rounded border border-border"
                />
                <button
                  onClick={() => setPendingScreenshot(null)}
                  className="absolute top-1 right-1 p-1 bg-destructive hover:bg-destructive/80 rounded text-xs"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <Button
                onClick={handleScreenshotCapture}
                disabled={llmLoading || pendingScreenshot}
                variant="secondary"
                className="gap-2"
                title="Capture screenshot of chessboard"
              >
                <Camera size={16} />
                {pendingScreenshot ? 'Captured' : 'Screenshot'}
              </Button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !llmLoading && handleSendMessage()}
                placeholder="Ask about the position..."
                disabled={llmLoading}
                className="flex-1 bg-muted border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
              <Button
                onClick={handleSendMessage}
                disabled={llmLoading || !chatInput.trim()}
                size="icon"
                className="bg-primary text-primary-foreground"
              >
                <Send size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}

const SidebarItem = ({ icon, label, active, onClick, isOpen, locked }) => (
  <Button
    variant={active ? 'default' : 'ghost'}
    onClick={onClick}
    disabled={locked}
    className={`w-full justify-start gap-3 p-3 rounded-lg transition-all duration-200 ${locked ? 'text-muted-foreground/50 cursor-not-allowed' : ''}`}
  >
    <div className={active ? 'text-primary-foreground' : locked ? 'text-muted-foreground/50' : 'text-muted-foreground'}>{icon}</div>
    {isOpen && (
      <div className="flex items-center justify-between flex-1">
        <span className="font-medium">{label}</span>
        {locked && <span className="text-xs text-muted-foreground/50">🔒</span>}
      </div>
    )}
  </Button>
);

export default App;

