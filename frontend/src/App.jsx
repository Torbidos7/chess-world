import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, BookOpen, User, Settings, MessageSquare, Menu, X, ChevronRight, ChevronLeft, GripVertical, Camera, Send, LogOut, LogIn } from 'lucide-react';
import html2canvas from 'html2canvas';
import ChessboardComponent from './components/Chessboard';
import Training from './components/Training';
import Problems from './components/Problems';
import Profile from './components/Profile';
import LoginModal from './components/LoginModal';
import { useLLM } from './hooks/useLLM';
import { useAuth } from './contexts/AuthContext';

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
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          {isSidebarOpen && <h1 className="text-xl font-bold text-chess-accent tracking-wider">CHESS WORLD</h1>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Play" active={activeTab === 'play'} onClick={() => handleTabClick('play')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<BookOpen size={20} />} label="Training" active={activeTab === 'training'} onClick={() => handleTabClick('training')} isOpen={isSidebarOpen} locked={!isAuthenticated} />
          <SidebarItem icon={<Settings size={20} />} label="Problems" active={activeTab === 'problems'} onClick={() => handleTabClick('problems')} isOpen={isSidebarOpen} locked={!isAuthenticated} />
          <SidebarItem icon={<User size={20} />} label="Profile" active={activeTab === 'profile'} onClick={() => handleTabClick('profile')} isOpen={isSidebarOpen} locked={!isAuthenticated} />
        </nav>

        <div className="p-4 border-t border-gray-800">
          {isSidebarOpen ? (
            isAuthenticated ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-chess-accent flex items-center justify-center font-bold text-white">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{user?.username}</div>
                    <div className="text-xs text-gray-500">ELO: {user?.elo || 1200}</div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
              >
                <LogIn size={18} />
                Login
              </button>
            )
          ) : (
            <div className="w-8 h-8 rounded-full bg-chess-accent flex items-center justify-center font-bold text-white mx-auto cursor-pointer" onClick={() => setShowLoginModal(true)}>
              {isAuthenticated ? (user?.username?.[0]?.toUpperCase() || 'U') : <LogIn size={16} />}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header with Right Sidebar Toggle */}
        <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <h2 className="text-lg font-semibold text-white capitalize">{activeTab} Mode</h2>
          {!isRightSidebarOpen && (
            <button
              onClick={() => setIsRightSidebarOpen(true)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-chess-accent transition-colors flex items-center gap-2"
              title="Open Chat Assistant"
            >
              <MessageSquare size={20} />
              {ollamaHealthy === false && <span className="text-xs text-red-400">Offline</span>}
            </button>
          )}
        </header>

        <main ref={mainContentRef} className="flex-1 overflow-y-auto bg-gray-800/50 p-6 relative">
          {renderContent()}
        </main>
      </div>

      {/* Right Sidebar (LLM Chat Assistant) */}
      {isRightSidebarOpen && (
        <div
          className="bg-gray-900 border-l border-gray-800 flex flex-col relative shadow-2xl z-20"
          style={{ width: rightSidebarWidth }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-chess-accent transition-colors z-30 flex items-center justify-center group"
            onMouseDown={startResizing}
          >
            <div className="w-4 h-8 bg-gray-800 rounded-l flex items-center justify-center -ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={12} className="text-gray-500" />
            </div>
          </div>

          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
            <h3 className="font-bold text-white flex items-center gap-2">
              <MessageSquare size={18} className="text-chess-accent" />
              Chess Assistant
              {ollamaHealthy !== null && (
                <span className={`ml-2 w-2 h-2 rounded-full ${ollamaHealthy ? 'bg-green-500' : 'bg-red-500'}`} title={ollamaHealthy ? 'Ollama running' : 'Ollama offline'}></span>
              )}
            </h3>
            <button
              onClick={() => setIsRightSidebarOpen(false)}
              className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg ${msg.role === 'user'
                  ? 'bg-chess-accent text-white'
                  : msg.isError
                    ? 'bg-red-900/40 border border-red-700 text-red-200'
                    : 'bg-gray-800 border border-gray-700 text-gray-300'
                  }`}>
                  {msg.image && <div className="text-xs opacity-75 mb-1">📷 With screenshot</div>}
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  {msg.suggested_moves && msg.suggested_moves.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs font-semibold mb-1">Suggested moves:</div>
                      <div className="flex flex-wrap gap-1">
                        {msg.suggested_moves.map((move, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-700 rounded text-xs font-mono">{move}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {llmLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-chess-accent"></div>
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-800 bg-gray-900">
            {!ollamaHealthy && ollamaHealthy !== null && (
              <div className="mb-2 p-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-200">
                Ollama not running. Start: <code className="bg-gray-800 px-1 rounded">ollama serve</code>
              </div>
            )}
            {pendingScreenshot && (
              <div className="mb-2 relative">
                <img
                  src={`data:image/png;base64,${pendingScreenshot}`}
                  alt="Chess board preview"
                  className="w-full rounded border border-gray-700"
                />
                <button
                  onClick={() => setPendingScreenshot(null)}
                  className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleScreenshotCapture}
                disabled={llmLoading || pendingScreenshot}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                title="Capture screenshot of chessboard"
              >
                <Camera size={16} />
                {pendingScreenshot ? 'Captured' : 'Screenshot'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !llmLoading && handleSendMessage()}
                placeholder="Ask about the position..."
                disabled={llmLoading}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-chess-accent transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={llmLoading || !chatInput.trim()}
                className="p-2 bg-chess-accent hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}

const SidebarItem = ({ icon, label, active, onClick, isOpen, locked }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${active ? 'bg-chess-accent text-white shadow-lg shadow-blue-900/20' : locked ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
    disabled={locked}
  >
    <div className={`${active ? 'text-white' : locked ? 'text-gray-600' : 'text-gray-400 group-hover:text-white'}`}>{icon}</div>
    {isOpen && (
      <div className="flex items-center justify-between flex-1">
        <span className="font-medium">{label}</span>
        {locked && <span className="text-xs text-gray-600">🔒</span>}
      </div>
    )}
  </button>
);

export default App;
