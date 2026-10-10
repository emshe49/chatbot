import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import {
  FiSend,
  FiPlus,
  FiMessageSquare,
  FiMenu,
  FiX,
  FiClock,
  FiUser,
  FiTrash2,
  FiLayers,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiBookOpen,
  FiBell,
  FiShield,
  FiCornerDownLeft,
  FiInfo,
  FiMic,
  FiMicOff,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import { Sparkles, Bot, GraduationCap, Users } from "lucide-react";
import { useToast } from "../context/ToastContext";

export default function ChatbotUI() {
  const toast = useToast();
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [input, setInput] = useState("");
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Pending question state for namespace lock
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [showNamespaceSelector, setShowNamespaceSelector] = useState(false);
  const [namespaceLocked, setNamespaceLocked] = useState(false);

  // Voice Speech Recognition & Synthesis states
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const recognitionRef = useRef(null);

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
  }, [messages, isTyping, scrollToBottom]);

  /* ================= LOAD NAMESPACES ================= */
  useEffect(() => {
    fetch("http://localhost:8000/api/namespaces")
      .then((res) => res.json())
      .then((data) => {
        const list = data.namespaces || [];
        setNamespaces(list);
      })
      .catch((err) => console.error("Namespace error:", err));
  }, []);

  /* ================= LOAD SESSIONS ================= */
  const loadSessions = async (namespace) => {
    if (!namespace) return;
    try {
      const res = await fetch(`${API_BASE_URL}/sessions?namespace=${namespace}`);
      const data = await res.json();
      setChatList(data.sessions || data || []);
    } catch (err) {
      console.error("Load sessions error:", err);
      setChatList([]);
    }
  };

  /* ================= LOAD CHAT ================= */
  const loadChat = async (session_id) => {
    setSessionId(session_id);
    try {
      const res = await fetch(`${API_BASE_URL}/chat-history/${session_id}`);
      const history = await res.json();
      setMessages(Array.isArray(history) ? history : []);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (err) {
      console.error("Load chat error:", err);
    }
  };

  /* ================= COPY MESSAGE ================= */
  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  /* ================= SPEECH RECOGNITION (VOICE INPUT) ================= */
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast?.error?.("Microphone permission denied. Please allow microphone access in your browser.") ||
            alert("Microphone permission denied. Please allow microphone access in your browser.");
        } else if (event.error === "network") {
          toast?.error?.("Network issue with speech recognition.") ||
            alert("Network issue with speech recognition.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [toast]);

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice input is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari."
      );
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.error("Error starting speech recognition:", err);
      }
    }
  };

  /* ================= TEXT TO SPEECH (READ ALOUD) ================= */
  const toggleSpeakAnswer = (text, index) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Strip markdown formatting, links, and tables before speaking
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*`_~|]/g, " ")
      .replace(/-{3,}/g, "")
      .replace(/\n+/g, ". ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  /* ================= SEND ACTUAL MESSAGE (streaming) ================= */
  const sendActualMessage = async (question, namespace, sid) => {
    setIsLoading(true);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          namespace,
          session_id: sid,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botText = "";

      setMessages((prev) => [
        ...prev,
        { sender: "assistant", text: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        botText += decoder.decode(value);
        setMessages((prev) => {
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

      // Update sidebar title dynamically
      setChatList((prev) =>
        prev.map((chat) =>
          chat.sessionId === sid && chat.title === "New Chat"
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
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "⚠️ Sorry, I encountered an error connecting to the AI engine. Please ensure the server is running and try again.",
          timestamp: new Date(),
          isError: true,
        },
      ]);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  /* ================= HANDLE NAMESPACE SELECTION ================= */
  const handleNamespaceSelection = async (namespace) => {
    setSelectedNamespace(namespace);
    setNamespaceLocked(true);
    setShowNamespaceSelector(false);

    setMessages((prev) => [
      ...prev,
      {
        sender: "assistant",
        text: `Department selected: **${namespace.toUpperCase()}**. Answering your query now...`,
        timestamp: new Date(),
      },
    ]);

    let newSessionId = "";
    try {
      const res = await fetch(`${API_BASE_URL}/new_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namespace }),
      });
      const data = await res.json();
      newSessionId = data.session_id;
      setSessionId(newSessionId);

      setChatList((prev) => [
        {
          sessionId: newSessionId,
          title: "New Chat",
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ]);

      loadSessions(namespace);
    } catch (err) {
      console.error("New session error:", err);
      return;
    }

    if (pendingQuestion) {
      await sendActualMessage(pendingQuestion, namespace, newSessionId);
      setPendingQuestion("");
    }
  };

  /* ================= SEND MESSAGE ================= */
  const sendMessage = async (overrideText = null) => {
    const textToSend = (overrideText !== null ? overrideText : input).trim();
    if (!textToSend || isLoading) return;

    setInput("");

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: textToSend, timestamp: new Date() },
    ]);

    if (!namespaceLocked) {
      setPendingQuestion(textToSend);
      setShowNamespaceSelector(true);

      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "To give you the most accurate official information, please select a department or data source:",
          timestamp: new Date(),
          isNamespaceSelector: true,
        },
      ]);
      return;
    }

    await sendActualMessage(textToSend, selectedNamespace, sessionId);
  };

  /* ================= NEW CHAT ================= */
  const startNewChat = () => {
    setSessionId("");
    setMessages([]);
    setSelectedNamespace("");
    setNamespaceLocked(false);
    setPendingQuestion("");
    setShowNamespaceSelector(false);
  };

  /* ================= FORMAT HELPERS ================= */
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const deleteChat = async (session_id, e) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/delete-session/${session_id}`, {
        method: "DELETE",
      });

      setChatList((prev) => prev.filter((chat) => chat.sessionId !== session_id));
      if (sessionId === session_id) startNewChat();
      toast.delete("Conversation deleted");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete conversation");
    }
  };

  /* ================= NAMESPACE ICON HELPER ================= */
  const getNamespaceMeta = (ns) => {
    const lower = ns.toLowerCase();
    if (lower.includes("ug") || lower.includes("undergrad")) {
      return {
        label: "Undergraduate (UG)",
        desc: "Admissions, BS Programs, Fees & Quota",
        icon: <GraduationCap className="w-5 h-5 text-blue-600" />,
        color: "from-blue-50 to-indigo-50 border-blue-200 text-blue-700",
      };
    }
    if (lower.includes("pg") || lower.includes("postgrad")) {
      return {
        label: "Postgraduate (PG)",
        desc: "MS/PhD Programs, Research, Evening Shifts",
        icon: <FiBookOpen className="w-5 h-5 text-purple-600" />,
        color: "from-purple-50 to-pink-50 border-purple-200 text-purple-700",
      };
    }
    if (lower.includes("notif")) {
      return {
        label: "Announcements & News",
        desc: "Live Scraped Notices, Tenders, Events",
        icon: <FiBell className="w-5 h-5 text-amber-600" />,
        color: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
      };
    }
    return {
      label: ns.toUpperCase(),
      desc: "University Information & Records",
      icon: <Users className="w-5 h-5 text-emerald-600" />,
      color: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    };
  };

  /* ================= NAMESPACE SELECTOR CARDS ================= */
  const NamespaceSelectorCards = () => (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {namespaces.map((ns) => {
        const meta = getNamespaceMeta(ns);
        return (
          <button
            key={ns}
            onClick={() => handleNamespaceSelection(ns)}
            className={`
              p-3.5 rounded-xl border text-left transition-all duration-200
              hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
              flex items-start gap-3 bg-gradient-to-br ${meta.color}
            `}
          >
            <div className="p-2 bg-white rounded-lg shadow-xs flex-shrink-0">
              {meta.icon}
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                {meta.label}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {meta.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  /* ================= SUGGESTIONS LIST ================= */
  const quickSuggestions = [
    {
      title: "Undergraduate Admissions",
      desc: "Eligibility criteria & entry test requirements",
      icon: <GraduationCap className="w-4 h-4 text-blue-600" />,
      prompt: "What are the eligibility criteria and admission requirements for undergraduate programs?",
    },
    {
      title: "Fee Structure & Quota",
      desc: "Semester tuition & self-finance breakdown",
      icon: <FiBookOpen className="w-4 h-4 text-indigo-600" />,
      prompt: "What is the fee structure for Open Merit and Self-Finance seats?",
    },
    {
      title: "Recent Announcements",
      desc: "Official merit lists and student updates",
      icon: <FiBell className="w-4 h-4 text-amber-600" />,
      prompt: "Show me the latest notifications and recent announcements from UET Mardan",
    },
    {
      title: "Degree Programs",
      desc: "Engineering & Computing departments",
      icon: <Sparkles className="w-4 h-4 text-purple-600" />,
      prompt: "What undergraduate engineering and computing programs are offered?",
    },
  ];

  return (
    <div className="flex h-screen bg-slate-900 font-sans overflow-hidden antialiased text-slate-800">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        ref={sidebarRef}
        className={`
          fixed md:relative z-40 h-screen
          transform transition-all duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0 w-72 lg:w-80" : "-translate-x-full md:translate-x-0 md:w-0"}
          bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 text-slate-200
        `}
      >
        {/* Sidebar Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-wide text-white">UniGuide AI</span>
                <span className="text-[10px] font-semibold uppercase bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                  RAG
                </span>
              </div>
              <p className="text-[11px] text-slate-400">UET Mardan Portal</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={startNewChat}
            className="
              w-full py-2.5 px-3.5 rounded-xl font-medium text-sm
              bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
              text-white shadow-md shadow-blue-600/20 hover:shadow-blue-600/30
              flex items-center justify-center gap-2 transition-all duration-200
              active:scale-[0.98]
            "
          >
            <FiPlus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Sessions History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 custom-scrollbar">
          {chatList.length > 0 ? (
            Array.from(new Set(chatList.map((chat) => formatDate(chat.timestamp)))).map(
              (date) => (
                <div key={date} className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {date}
                  </div>
                  {chatList
                    .filter((chat) => formatDate(chat.timestamp) === date)
                    .map((chat) => (
                      <div
                        key={chat.sessionId}
                        onClick={() => loadChat(chat.sessionId)}
                        className={`
                          group relative px-3 py-2.5 rounded-xl cursor-pointer text-xs
                          flex items-center justify-between gap-2 transition-all duration-150
                          ${
                            sessionId === chat.sessionId
                              ? "bg-slate-800/90 text-white font-medium border border-slate-700 shadow-sm"
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                          }
                        `}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FiMessageSquare
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              sessionId === chat.sessionId ? "text-blue-400" : "text-slate-500"
                            }`}
                          />
                          <span className="truncate">{chat.title || "New Conversation"}</span>
                        </div>
                        <button
                          onClick={(e) => deleteChat(chat.sessionId, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                          title="Delete chat"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              )
            )
          ) : (
            <div className="text-center py-12 px-4 text-slate-500">
              <FiMessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No previous chats</p>
              <p className="text-[11px] text-slate-600 mt-1">Start a conversation anytime</p>
            </div>
          )}
        </div>

        {/* Sidebar Footer & Admin Link */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">System Ready</span>
          </div>
          <Link
            to="/admin/login"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
            title="Open Admin Dashboard"
          >
            <FiShield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        </div>
      </aside>

      {/* ================= MAIN CHAT AREA ================= */}
      <main className="flex-1 flex flex-col h-screen bg-slate-50 relative overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-14 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 flex items-center justify-between z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Toggle Sidebar"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm md:text-base tracking-tight">
                UET Mardan Academic Assistant
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Active Knowledge
              </span>
            </div>
          </div>

          {/* Department badge & New Chat button */}
          <div className="flex items-center gap-2">
            {selectedNamespace && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                <FiLayers className="w-3 h-3 text-blue-600" />
                <span>{selectedNamespace.toUpperCase()}</span>
              </div>
            )}
            <button
              onClick={startNewChat}
              className="p-1.5 sm:px-3 sm:py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 transition-colors"
              title="Reset conversation"
            >
              <FiPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </header>

        {/* Message Stream Container */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 ? (
              /* Welcome Hero Screen */
              <div className="py-8 md:py-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 mb-4 transform hover:scale-105 transition-transform">
                  <Bot className="w-8 h-8" />
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                  Welcome to UniGuide AI
                </h2>
                <p className="text-slate-500 text-sm max-w-lg mt-2 mb-8 leading-relaxed">
                  Your university companion grounded in official UET Mardan prospectuses, admission regulations, and real-time scraped notifications.
                </p>

                {/* Quick Prompts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
                  {quickSuggestions.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(item.prompt)}
                      className="
                        p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/80
                        hover:border-blue-300 hover:shadow-md transition-all duration-200
                        flex items-start gap-3 group
                      "
                    >
                      <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-blue-50 transition-colors">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-800 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation Messages */
              messages.map((msg, index) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={index}
                    className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} group`}
                  >
                    {/* Avatar */}
                    <div
                      className={`
                        w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-semibold
                        ${
                          isUser
                            ? "bg-slate-800 text-white shadow-sm"
                            : "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                        }
                      `}
                    >
                      {isUser ? <FiUser className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble Card */}
                    <div
                      className={`
                        max-w-[85%] md:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed relative
                        ${
                          isUser
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/15 rounded-tr-xs"
                            : msg.isError
                            ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-xs"
                            : "bg-white border border-slate-200/80 text-slate-800 shadow-xs rounded-tl-xs"
                        }
                      `}
                    >
                      {/* Namespace Selection Interactivity */}
                      {msg.isNamespaceSelector ? (
                        <div>
                          <p className="font-medium text-slate-700">{msg.text}</p>
                          <NamespaceSelectorCards />
                        </div>
                      ) : (
                        <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""}`}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2 my-1"
                                >
                                  <span>{props.children}</span>
                                  <FiExternalLink className="w-3.5 h-3.5 inline" />
                                </a>
                              ),
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-slate-700">{children}</li>,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Bottom action row (Copy & Speak buttons & timestamp) */}
                      {!isUser && !msg.isNamespaceSelector && (
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
                          <span>{formatTime(msg.timestamp)}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleSpeakAnswer(msg.text, index)}
                              className={`flex items-center gap-1 hover:text-slate-700 transition-colors p-1 rounded ${
                                speakingIndex === index ? "text-blue-600 font-medium" : ""
                              }`}
                              title={speakingIndex === index ? "Stop reading aloud" : "Listen to answer"}
                            >
                              {speakingIndex === index ? (
                                <>
                                  <FiVolumeX className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                                  <span className="text-blue-600">Stop</span>
                                </>
                              ) : (
                                <>
                                  <FiVolume2 className="w-3.5 h-3.5" />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(msg.text, index)}
                              className="flex items-center gap-1 hover:text-slate-700 transition-colors p-1 rounded"
                              title="Copy response"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <FiCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600">Copied</span>
                                </>
                              ) : (
                                <>
                                  <FiCopy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing shimmer effect */}
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs p-3.5 shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-purple-600 animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-xs text-slate-400 font-medium ml-1">Consulting knowledge base...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ================= FLOATING INPUT BAR ================= */}
        <footer className="p-3 md:p-4 bg-white/80 backdrop-blur-md border-t border-slate-200/70 z-20">
          <div className="max-w-3xl mx-auto">
            {/* Listening Indicator Bar */}
            {isListening && (
              <div className="flex items-center justify-between mb-2.5 px-3.5 py-2 bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/80 rounded-xl text-rose-600 text-xs shadow-xs animate-pulse">
                <div className="flex items-center gap-2 font-medium">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span>Listening... Speak your question into your microphone</span>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline underline-offset-2 ml-2"
                >
                  Done Speaking
                </button>
              </div>
            )}

            <div
              className={`
                flex items-center gap-2 bg-white rounded-2xl border px-3.5 py-2.5 shadow-md transition-all
                ${
                  isListening
                    ? "border-rose-400 ring-4 ring-rose-100"
                    : showNamespaceSelector
                    ? "border-amber-300 ring-2 ring-amber-100"
                    : "border-slate-200/90 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100"
                }
              `}
            >
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
                rows={1}
                disabled={isLoading || showNamespaceSelector}
                placeholder={
                  isListening
                    ? "Listening to your voice..."
                    : showNamespaceSelector
                    ? "Please select a department above..."
                    : namespaceLocked
                    ? `Ask anything about ${selectedNamespace.toUpperCase()}...`
                    : "Ask about admissions, fee structures, notices, or degree programs..."
                }
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-800 placeholder-slate-400 max-h-28 custom-scrollbar"
                style={{ height: "24px" }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
              />

              {/* Voice Input Microphone Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isLoading || showNamespaceSelector}
                className={`
                  p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center relative
                  ${
                    isListening
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 ring-4 ring-rose-100 scale-105"
                      : "text-slate-500 hover:text-blue-600 hover:bg-blue-50 bg-slate-100"
                  }
                  ${
                    isLoading || showNamespaceSelector
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer active:scale-95"
                  }
                `}
                title={
                  isListening
                    ? "Listening... Click to stop"
                    : "Ask question with voice (Microphone)"
                }
              >
                {isListening ? (
                  <FiMicOff className="w-4 h-4 animate-pulse" />
                ) : (
                  <FiMic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim() || showNamespaceSelector}
                className={`
                  p-2.5 rounded-xl text-white transition-all duration-200 flex items-center justify-center
                  ${
                    !input.trim() || isLoading || showNamespaceSelector
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 active:scale-95"
                  }
                `}
                title="Send message"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                ) : (
                  <FiSend className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Input Disclaimer & Hint */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
              <span>
                Press <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-slate-600">Enter</kbd> to send or use <kbd className="px-1 py-0.5 bg-slate-100 border rounded text-slate-600">Mic</kbd> for voice
              </span>
              <span className="flex items-center gap-1">
                <FiInfo className="w-3 h-3 text-slate-400" />
                Grounded in official UET Mardan data
              </span>
            </div>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}