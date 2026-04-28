import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAIAssistantResponse, ChatMessage } from '../../services/gemini';
import ReactMarkdown from 'react-markdown';

import { useLocation } from 'react-router-dom';

export default function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Expose toggle to window for Dashboard "Consult Assistant" button
  useEffect(() => {
    (window as any).toggleAIChat = () => setIsOpen(true);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: input }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const context = `
      User: ${user?.displayName}
      Role: ${user?.role}
      SchoolID: ${user?.schoolId}
      Current Page: ${location.pathname}
      Unique ID: ${user?.uniqueId || 'N/A'}
      Time: ${new Date().toLocaleString()}
    `;
    const response = await getAIAssistantResponse(input, messages, context);

    const botMessage: ChatMessage = {
      role: 'model',
      parts: [{ text: response }]
    };

    setIsTyping(false);
    setMessages(prev => [...prev, botMessage]);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[380px] max-w-[calc(100vw-48px)] h-[550px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-indigo-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Nexus AI Assistant</h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-200">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    <span>Ready to help</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50"
            >
              {messages.length === 0 && (
                 <div className="text-center py-8">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
                      <Sparkles size={24} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">Hello {user?.displayName}!</h4>
                    <p className="text-xs text-slate-500 mt-2 px-6 leading-relaxed">
                      I'm your school AI. I can analyze attendance, summarize performance, or help with school admin tasks.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-6 px-4">
                       <button 
                         onClick={() => setInput("How do I take attendance?")}
                         className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                       >
                          Take Attendance
                       </button>
                       <button 
                         onClick={() => setInput("Explain result analysis")}
                         className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                       >
                          Result Analysis
                       </button>
                       <button 
                         onClick={() => setInput("Add a new student")}
                         className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                       >
                          Enrollment Help
                       </button>
                    </div>
                 </div>
              )}

              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                     <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {msg.role === 'user' ? 'ME' : <Bot size={14} />}
                     </div>
                     <div className={`p-3 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                       msg.role === 'user' 
                       ? 'bg-indigo-600 text-white rounded-tr-none' 
                       : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                     }`}>
                        <div className="prose prose-sm prose-slate max-w-none">
                           <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                        </div>
                     </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                     <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center">
                        <Bot size={14} className="text-slate-600" />
                     </div>
                     <div className="p-3 bg-white border border-slate-100 rounded-2xl rounded-tl-none flex gap-1 items-center h-8 shadow-sm">
                        <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                     </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form 
              onSubmit={handleSend}
              className="p-4 bg-white border-t border-slate-100 flex gap-2"
            >
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md shadow-indigo-100"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl shadow-xl border border-indigo-100 group cursor-pointer hover:shadow-indigo-100/50 transition-all active:scale-95"
      >
        <div className="relative">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white">
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                   <X size={20} />
                </motion.div>
              ) : (
                <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                   <Bot size={20} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
        </div>
        {!isOpen && (
          <div className="hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">AI Assistant</p>
            <p className="text-sm font-bold text-indigo-600">How can I help?</p>
          </div>
        )}
      </div>
    </div>
  );
}
