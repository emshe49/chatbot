import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  FiSend,
  FiPlus,
  FiChevronDown,
  FiMessageSquare,
  FiMenu,
  FiX,
  FiClock,
  FiUser,
  FiCpu,
  FiTrash2,
  FiEdit3,
  FiMoreVertical
} from "react-icons/fi";

export default function ChatbotUI() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [input, setInput] = useState("");
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sidebarRef = useRef(null);

  const API_BASE_URL =
    process.env.REACT_APP_API_URL || "http://localhost:5000/api";

  /* ================= AUTO SCROLL ================= */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  /* ================= LOAD NAMESPACES ================= */
  useEffect(() => {
    fetch("http://localhost:8000/api/namespaces")
      .then((res) => res.json())
      .then((data) => {
        const list = data.namespaces || [];
        setNamespaces(list);
        setSelectedNamespace(list[0] || "");
      })
      .catch((err) => console.error("Namespace error:", err));
  }, []);

  /* ================= LOAD SESSIONS ================= */
  const loadSessions = async (namespace = selectedNamespace) => {
    if (!namespace) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/sessions?namespace=${namespace}`
      );
      const data = await res.json();
      setChatList(data.sessions || data || []);
    } catch (err) {
      console.error("Load sessions error:", err);
      setChatList([]);
    }
  };

  /* ================= AUTO CREATE FIRST CHAT ================= */
  useEffect(() => {
    if (selectedNamespace) {
      loadSessions();
      startNewChat();
    }
  }, [selectedNamespace]);

  /* ================= NEW CHAT ================= */
  const startNewChat = async () => {
    if (!selectedNamespace) return;

    try {
      const res = await fetch(`${API_BASE_URL}/new_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace: selectedNamespace }),
      });

      const data = await res.json();

      setSessionId(data.session_id);
      setMessages([]);

      setChatList(prev => [
        {
          sessionId: data.session_id,
          title: "New Chat",
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

    } catch (err) {
      console.error("New chat error:", err);
    }
  };

  /* ================= LOAD CHAT ================= */
  const loadChat = async (session_id) => {
    setSessionId(session_id);

    const res = await fetch(
      `${API_BASE_URL}/chat-history/${session_id}`
    );
    const history = await res.json();
    setMessages(Array.isArray(history) ? history : []);
    
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    setIsLoading(true);
    setIsTyping(true);

    const userText = input;

    const userMessage = {
      sender: "user",
      text: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          namespace: selectedNamespace,
          session_id: sessionId,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let botText = "";

      setMessages(prev => [
        ...prev,
        { sender: "assistant", text: "", timestamp: new Date() }
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        botText += decoder.decode(value);

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            sender: "assistant",
            text: botText,
            timestamp: new Date(),
          };
          return updated;
        });
      }

      setIsTyping(false);

      /* 🔥 UPDATE SIDEBAR TITLE USING AI RESPONSE */
      setChatList(prev =>
        prev.map(chat =>
          chat.sessionId === sessionId && chat.title === "New Chat"
            ? {
                ...chat,
                title:
                  botText.length > 40
                    ? botText.substring(0, 40) + "..."
                    : botText,
                timestamp: new Date().toISOString(),
              }
            : chat
        )
      );

    } catch (err) {
      console.error("Chat error:", err);
      setIsTyping(false);
      
      // Show error message in chat
      setMessages(prev => [
        ...prev,
        {
          sender: "assistant",
          text: "⚠️ Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
          isError: true,
        },
      ]);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  /* ================= FORMAT TIMESTAMP ================= */
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  /* ================= UI ================= */
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
      >
        {isSidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* SIDEBAR - with improved styling */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative z-40 h-screen
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          w-80 bg-white/80 backdrop-blur-xl shadow-2xl flex flex-col border-r border-gray-200/50
        `}
      >
        {/* Sidebar Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <FiMessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">AI Assistant</h2>
              <p className="text-blue-100 text-xs">Your intelligent companion</p>
            </div>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={startNewChat}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-xl font-medium 
                     flex items-center justify-center space-x-2 hover:from-blue-700 hover:to-blue-800 
                     transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <FiPlus className="w-5 h-5" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
            Recent Chats
          </p>
          
          {/* Group chats by date */}
          {Array.from(new Set(chatList.map(chat => formatDate(chat.timestamp)))).map(date => (
            <div key={date} className="space-y-1">
              <p className="text-xs text-gray-400 px-3 py-2">{date}</p>
              {chatList
                .filter(chat => formatDate(chat.timestamp) === date)
                .map((chat) => (
                  <div
                    key={chat.sessionId}
                    onClick={() => loadChat(chat.sessionId)}
                    className={`
                      group relative p-3 rounded-xl cursor-pointer transition-all duration-200
                      ${sessionId === chat.sessionId
                        ? "bg-gradient-to-r from-blue-50 to-blue-100/50 border-l-4 border-blue-600 shadow-md"
                        : "hover:bg-gray-50 hover:shadow-sm border-l-4 border-transparent"
                      }
                    `}
                  >
                    <div className="flex items-start space-x-3">
                      <FiMessageSquare className={`
                        mt-1 w-4 h-4 flex-shrink-0
                        ${sessionId === chat.sessionId ? "text-blue-600" : "text-gray-400"}
                      `} />
                      <div className="flex-1 min-w-0">
                        <p className={`
                          text-sm font-medium truncate
                          ${sessionId === chat.sessionId ? "text-blue-900" : "text-gray-700"}
                        `}>
                          {chat.title || "New Chat"}
                        </p>
                        {chat.timestamp && (
                          <p className="text-xs text-gray-400 mt-1">
                            <FiClock className="inline w-3 h-3 mr-1" />
                            {formatTime(chat.timestamp)}
                          </p>
                        )}
                      </div>
                      
                      {/* Hover actions */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 hover:bg-gray-200 rounded">
                          <FiMoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))}
          
          {chatList.length === 0 && (
            <div className="text-center py-8 px-4">
              <div className="bg-gray-50 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                <FiMessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No conversations yet</p>
              <p className="text-gray-400 text-xs mt-1">Start a new chat to begin</p>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">AI Assistant</p>
              <p className="text-xs text-gray-400">Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TOP BAR */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 md:px-6 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center space-x-4">
            {/* Mobile spacer for menu button */}
            <div className="w-8 md:hidden"></div>
            <h1 className="text-xl font-semibold text-gray-800 flex items-center">
              <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                AI Assistant
              </span>
            </h1>
          </div>

          {/* Namespace Selector */}
          <div className="relative">
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="appearance-none bg-gray-50 border border-gray-200 text-sm rounded-xl pl-4 pr-10 py-2.5
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                       hover:border-gray-300 transition-colors cursor-pointer min-w-[150px]"
            >
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
            <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
            {messages.length === 0 ? (
              // Welcome Screen
              <div className="h-full flex items-center justify-center py-20">
                <div className="text-center max-w-md">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center shadow-xl">
                    <FiCpu className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">
                    Welcome to AI Assistant
                  </h2>
                  <p className="text-gray-500 mb-8">
                    Start a conversation by asking a question about {selectedNamespace || 'anything'}.
                  </p>
                  <div className="grid gap-3">
                    {[
                      "What can you help me with?",
                      "Tell me about your capabilities",
                      "How do I get started?"
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(suggestion)}
                        className="text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 
                                 hover:border-blue-300 transition-all hover:shadow-md group"
                      >
                        <span className="text-gray-700 group-hover:text-blue-600">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Message List
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}
                >
                  <div className={`flex max-w-[85%] md:max-w-[70%] ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"} items-start gap-3`}>
                    {/* Avatar */}
                    <div className={`
                      flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${msg.sender === "user" 
                        ? "bg-gradient-to-r from-gray-700 to-gray-900 text-white" 
                        : "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                      }
                      ${msg.isError ? "bg-red-500" : ""}
                    `}>
                      {msg.sender === "user" ? <FiUser className="w-4 h-4" /> : <FiCpu className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble */}
                    <div className={`
                      group relative p-4 rounded-2xl shadow-sm
                      ${msg.sender === "user"
                        ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                        : msg.isError
                        ? "bg-red-50 border border-red-200 text-red-800"
                        : "bg-white border border-gray-200 text-gray-800"
                      }
                    `}>
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                      
                      {/* Timestamp */}
                      {msg.timestamp && (
                        <div className={`
                          absolute bottom-1 right-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity
                          ${msg.sender === "user" ? "text-blue-200" : "text-gray-400"}
                        `}>
                          {formatTime(msg.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                    <FiCpu className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50 p-4 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows="1"
                  className="w-full border border-gray-200 rounded-xl pl-4 pr-12 py-3.5
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                           hover:border-gray-300 transition-colors resize-none max-h-32
                           placeholder:text-gray-400"
                  placeholder={`Ask about ${selectedNamespace || 'anything'}...`}
                  disabled={isLoading}
                  style={{
                    overflow: 'auto',
                    maxHeight: '120px'
                  }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                />
                {isLoading && (
                  <div className="absolute right-3 bottom-3">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className={`
                  px-6 py-3.5 rounded-xl font-medium flex items-center justify-center space-x-2
                  transition-all duration-200 min-w-[100px]
                  ${!input.trim() || isLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                  }
                `}
              >
                {isLoading ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <FiSend className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Input Footer */}
            <div className="flex justify-between items-center mt-2 px-1">
              <p className="text-xs text-gray-400">
                Press Enter to send, Shift + Enter for new line
              </p>
              {selectedNamespace && (
                <p className="text-xs text-gray-400">
                  Context: <span className="font-medium text-blue-600">{selectedNamespace}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}