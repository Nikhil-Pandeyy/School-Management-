import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  addDoc, 
  setDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit, 
  Timestamp,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
  updateDoc,
  or,
  and
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
   Send, 
   User, 
   Hash, 
   Bot, 
   Plus, 
   Users, 
   X,
   UserPlus,
   Trash2,
   Settings,
   Circle,
   Clock,
   Check,
   CheckCheck,
   Smile,
   Paperclip,
   Image as ImageIcon,
   FileText,
   File as FileIcon,
   ChevronLeft,
   ArrowLeft,
   Phone,
   Video,
   Info,
   Sparkles
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { getCampusGuideResponse } from '../services/geminiService';

interface ChatMember {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: string;
}

interface ChatGroup {
  id: string;
  name: string;
  type: 'group' | 'direct';
  isPublic?: boolean;
  members?: string[];
  memberDetails?: { [uid: string]: ChatMember };
  createdBy?: string;
  lastMessageAt?: any;
  lastMessage?: string;
  lastMessageBy?: string;
  schoolId?: string;
}

interface MessageAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  attachment?: MessageAttachment;
  createdAt: any;
  deletedBy?: string[];
  schoolId: string;
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [activeChat, setActiveChat] = useState<ChatGroup | null>(null);
  const [chats, setChats] = useState<ChatGroup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewDirectChatOpen, setIsNewDirectChatOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [newMemberId, setNewMemberId] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCalling, setIsCalling] = useState<null | 'video' | 'voice'>(null);
  const [schoolPermissions, setSchoolPermissions] = useState<any>(null);
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 }
  };
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with public announcements
  useEffect(() => {
    if (!user?.schoolId) return;
    
    // Default chat if none active
    if (!activeChat) {
      setActiveChat({ 
        id: 'announcements', 
        name: 'School Announcements', 
        type: 'group', 
        isPublic: true, 
        members: [] 
      });
    }

    const q = query(
      collection(db, 'schools', user.schoolId, 'chats'),
      and(
        where('schoolId', '==', user.schoolId),
        or(
          where('isPublic', '==', true),
          where('members', 'array-contains', user.uid)
        )
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(d => {
        const data = d.data() as ChatGroup;
        return { 
          ...data,
          id: d.id, 
          lastMessageDate: data.lastMessageAt?.toDate?.() || new Date(0)
        };
      });

      // Sort by last message date descending
      chatList.sort((a, b) => b.lastMessageDate - a.lastMessageDate);

      // System Chats
      const announcements: ChatGroup = { 
        id: 'announcements', 
        name: 'School Announcements', 
        type: 'group', 
        isPublic: true,
        members: []
      };

      const campusBot: ChatGroup = {
        id: 'campus-bot',
        name: 'Nexus AI Assistant',
        type: 'direct',
        members: [user.uid, 'bot']
      };
      
      setChats([announcements, campusBot, ...chatList]);
    });

    return () => unsubscribe();
  }, [user]);

  // School permissions listener
  useEffect(() => {
    if (!user?.schoolId) return;
    const unsub = onSnapshot(doc(db, 'schools', user.schoolId), (docSnap) => {
      if (docSnap.exists()) {
        setSchoolPermissions(docSnap.data().permissions || {});
      }
    });
    return () => unsub();
  }, [user?.schoolId]);

  // Integrated User Search logic
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setUserSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const q = query(
          collection(db, 'schools', user?.schoolId, 'users'),
          where('uniqueId', '>=', searchQuery.toUpperCase()),
          where('uniqueId', '<=', searchQuery.toUpperCase() + '\uf8ff'),
          limit(10)
        );
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((u: any) => u.id !== user?.uid);
        setUserSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timeout = setTimeout(searchUsers, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, user]);

  // Handle auto-open chat from search params
  useEffect(() => {
    const targetUid = searchParams.get('uid');
    if (targetUid && user?.schoolId) {
      const openUserChat = async () => {
        try {
          const userSnap = await getDoc(doc(db, 'schools', user.schoolId, 'users', targetUid));
          if (userSnap.exists()) {
            handleCreateDirectChat({ id: userSnap.id, ...userSnap.data() });
          }
          setSearchParams({}); // Clear params
        } catch (err) {
          console.error("Auto-open chat error:", err);
        }
      };
      openUserChat();
    }
  }, [searchParams, user?.schoolId]);

  // Messages listener
  useEffect(() => {
    if (!activeChat?.id || !user?.schoolId) return;

    // Special logic for AI Bot
    if (activeChat.id === 'campus-bot') {
       const botChatId = `bot-${user.uid}`;
       const q = query(
         collection(db, 'schools', user.schoolId, 'chats', botChatId, 'messages'),
         orderBy('createdAt', 'asc'),
         limit(50)
       );

       const unsubscribe = onSnapshot(q, (snapshot) => {
         const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
         setMessages(msgs);
         scrollToBottom();

         // If empty, add a welcome message
         if (msgs.length === 0) {
           const welcomeMsg = {
             schoolId: user.schoolId,
             chatId: botChatId,
             senderId: 'bot',
             senderName: 'Nexus AI Assistant',
             senderRole: 'AI Assistant',
             text: "Hello! 👋 I'm Nexus, your EduCloud AI Guide. I can help you find your way around the campus system. Ask me anything about where to find your results, attendance, or how to download your admission letter! 📚✨",
             createdAt: serverTimestamp(),
             isPublic: false,
             members: [user.uid, 'bot']
           };
           addDoc(collection(db, 'schools', user.schoolId, 'chats', botChatId, 'messages'), welcomeMsg);
         }

         // check if last message is from user, then trigger bot
         const lastMsg = msgs[msgs.length - 1];
         if (lastMsg && lastMsg.senderId === user.uid) {
            handleBotResponse(lastMsg.text, msgs);
         }
       });

       return () => unsubscribe();
    }

    const q = query(
      collection(db, 'schools', user.schoolId, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      scrollToBottom();
    }, (err) => {
        console.error(err);
    });

    return () => unsubscribe();
  }, [activeChat?.id, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleBotResponse = async (userText: string, history: Message[]) => {
    if (activeChat?.id !== 'campus-bot') return;

    // Format history for Gemini
    const geminiHistory = history.slice(-10).map(m => ({
      role: m.senderId === user?.uid ? 'user' : 'model' as 'user' | 'model',
      parts: [{ text: m.text }]
    }));

    // Remove the last message from history which is the current userText
    const finalHistory = geminiHistory.slice(0, -1);

    const botResponseText = await getCampusGuideResponse(userText, finalHistory);

    const msgData = {
      schoolId: user?.schoolId,
      chatId: `bot-${user?.uid}`,
      senderId: 'bot',
      senderName: 'Nexus AI Assistant',
      senderRole: 'AI Assistant',
      text: botResponseText,
      createdAt: serverTimestamp(),
      isPublic: false,
      members: [user?.uid, 'bot']
    };

    await addDoc(collection(db, 'schools', user?.schoolId as string, 'chats', `bot-${user?.uid}`, 'messages'), msgData);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachment) return;

    const messageText = inputText;
    const currentAttachment = attachment;
    
    setInputText('');
    setAttachment(null);
    setShowEmojiPicker(false);

    try {
      let attachmentData = null;
      
      if (currentAttachment) {
        setIsUploading(true);
        const reader = new FileReader();
        const filePromise = new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(currentAttachment);
        });

        const dataUrl = await filePromise;
        attachmentData = {
          name: currentAttachment.name,
          type: currentAttachment.type,
          size: currentAttachment.size,
          url: dataUrl 
        };
        setIsUploading(false);
      }

      const isBotChat = activeChat?.id === 'campus-bot';
      const actualChatId = isBotChat ? `bot-${user?.uid}` : activeChat?.id;

      const msgData = {
        schoolId: user?.schoolId,
        chatId: actualChatId,
        senderId: user?.uid,
        senderName: user?.displayName || 'User',
        senderRole: user?.role,
        text: messageText,
        attachment: attachmentData,
        createdAt: serverTimestamp(),
        isPublic: activeChat?.isPublic || false,
        members: isBotChat ? [user?.uid, 'bot'] : (activeChat?.members || [])
      };

      await addDoc(collection(db, 'schools', user?.schoolId as string, 'chats', actualChatId as string, 'messages'), msgData);

      // Update chat last message preview if not system
      if (activeChat?.id !== 'announcements' && activeChat?.id !== 'campus-bot') {
        const chatRef = doc(db, 'schools', user?.schoolId as string, 'chats', activeChat!.id);
        await updateDoc(chatRef, {
          lastMessage: currentAttachment ? (messageText || 'Sent a file') : messageText,
          lastMessageBy: user?.displayName,
          lastMessageAt: serverTimestamp()
        });
      }
      scrollToBottom();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachment(file);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      if (showChatMenu) setShowChatMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showChatMenu]);

  const handleDeleteEveryone = async (msgId: string) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      await deleteDoc(doc(db, 'schools', user?.schoolId as string, 'chats', activeChat!.id, 'messages', msgId));
      setActiveMenuId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `messages/${msgId}`);
    }
  };

  const handleDeleteForMe = async (msg: Message) => {
    try {
      const deletedBy = msg.deletedBy || [];
      if (user?.uid && !deletedBy.includes(user.uid)) {
        await updateDoc(doc(db, 'schools', user?.schoolId as string, 'chats', activeChat!.id, 'messages', msg.id), {
          deletedBy: [...deletedBy, user.uid]
        });
      }
      setActiveMenuId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `messages/${msg.id}`);
    }
  };

  const handleClearChat = async () => {
    if (!activeChat || activeChat.id === 'announcements') return;
    
    const isAdminOrCreator = user?.role === 'school-admin' || activeChat.createdBy === user?.uid;
    const confirmMsg = isAdminOrCreator 
      ? "Clear history for everyone (OK) or just for yourself (Cancel)?" 
      : "Are you sure you want to clear your chat history?";
    
    const forEveryone = isAdminOrCreator ? window.confirm(confirmMsg) : false;
    if (!isAdminOrCreator && !window.confirm("Clear your chat history?")) return;

    try {
      const q = query(collection(db, 'schools', user?.schoolId as string, 'chats', activeChat.id, 'messages'));
      const snap = await getDocs(q);
      
      const promises = snap.docs.map(async (d) => {
        const msgData = d.data();
        if (forEveryone) {
          // Only if user has permission to delete this specific doc
          if (msgData.senderId === user?.uid || user?.role === 'school-admin') {
            return deleteDoc(d.ref);
          }
          return null;
        } else {
          // Delete for me
          const deletedBy = msgData.deletedBy || [];
          if (user?.uid && !deletedBy.includes(user.uid)) {
            return updateDoc(d.ref, {
              deletedBy: [...deletedBy, user.uid]
            });
          }
          return null;
        }
      });
      
      await Promise.all(promises);
      
      // Update chat last message preview if cleared for everyone
      if (forEveryone) {
        await updateDoc(doc(db, 'schools', user?.schoolId as string, 'chats', activeChat.id), {
          lastMessage: 'History cleared',
          lastMessageAt: serverTimestamp()
        });
      }
      
      setShowChatMenu(false);
      setActiveMenuId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `messages/chat/${activeChat.id}`);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeChat || activeChat.id === 'announcements') return;
    if (!window.confirm("Are you sure you want to delete this chat and all its messages?")) return;

    try {
      // Delete messages
      const q = query(collection(db, 'schools', user?.schoolId as string, 'chats', activeChat.id, 'messages'));
      const snap = await getDocs(q);
      const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Delete chat doc
      await deleteDoc(doc(db, 'schools', user?.schoolId as string, 'chats', activeChat.id));
      
      setActiveChat({ 
        id: 'announcements', 
        name: 'School Announcements', 
        type: 'group', 
        isPublic: true, 
        members: [] 
      });
      setShowChatMenu(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'chats');
    }
  };

  const handleCreateDirectChat = async (targetUser: any) => {
    if (!targetUser) return;
    
    // Check permissions
    if (user?.role === 'student' && targetUser.role === 'student') {
      if (schoolPermissions?.allowStudentToStudentChat === false) {
        alert("Student-to-student chat is currently disabled by the school administrator.");
        return;
      }
    }

    try {
      const targetUid = targetUser.id;
      const targetDisplayName = targetUser.displayName;

      // Check for existing direct chat
      const existing = chats.find(c => c.type === 'direct' && c.members?.includes(targetUid));
      if (existing) {
        setActiveChat(existing);
        setIsNewDirectChatOpen(false);
        setSearchQuery('');
        return;
      }

      const chatData = {
        name: targetDisplayName,
        schoolId: user?.schoolId,
        createdBy: user?.uid,
        members: [user!.uid, targetUid],
        type: 'direct',
        createdAt: serverTimestamp(),
        lastMessage: 'Conversation started',
        lastMessageAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'schools', user?.schoolId as string, 'chats'), chatData);
      setActiveChat({ ...chatData, id: docRef.id } as ChatGroup);
      setIsNewDirectChatOpen(false);
      setSearchQuery('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatName.trim() || memberIds.length === 0) return;

    try {
      const finalMembers = [user!.uid];
      for (const id of memberIds) {
        const qUsers = query(collection(db, 'schools', user?.schoolId as string, 'users'), where('uniqueId', '==', id.trim()), limit(1));
        const snap = await getDocs(qUsers);
        if (!snap.empty) finalMembers.push(snap.docs[0].id);
      }

      const newGroupData = {
        name: newChatName,
        schoolId: user?.schoolId,
        createdBy: user?.uid,
        creatorName: user?.displayName,
        members: finalMembers,
        type: 'group',
        createdAt: serverTimestamp(),
        lastMessage: 'Group created',
        lastMessageAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'schools', user?.schoolId as string, 'chats'), newGroupData);
      setActiveChat({ ...newGroupData, id: docRef.id } as ChatGroup);
      setIsModalOpen(false);
      setNewChatName('');
      setMemberIds([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chats');
    }
  };

  const formatMessageDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'dd/MM/yy');
  };

  const renderMessageContent = (msg: Message) => {
    const isMe = msg.senderId === user?.uid;
    
    // Don't render if deleted for me
    if (msg.deletedBy?.includes(user?.uid || '')) return null;

    return (
      <div className={`p-3 rounded-2xl shadow-sm relative group max-w-[85vw] md:max-w-md ${
        isMe 
          ? 'bg-[#dcf8c6] text-[#303030] rounded-tr-none' 
          : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
      }`}>
        <div className={`absolute top-2 ${isMe ? 'right-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity z-20`}>
           <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveMenuId(activeMenuId === msg.id ? null : msg.id);
            }}
            className="px-2 py-0.5 hover:bg-black/10 rounded-md transition-colors bg-white/20 text-[8px] font-black uppercase text-slate-400"
           >
              Edit
           </button>
           {activeMenuId === msg.id && (
             <div 
               className="absolute right-0 top-6 bg-white border border-slate-200 shadow-2xl rounded-xl py-1 z-[100] min-w-[160px] overflow-hidden"
               onClick={e => e.stopPropagation()}
             >
                <button 
                  onClick={() => handleDeleteForMe(msg)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-widest text-left"
                >
                   Delete for me
                </button>
                {isMe && (
                  <button 
                    onClick={() => handleDeleteEveryone(msg.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition-colors uppercase tracking-widest text-left border-t border-slate-50"
                  >
                     Delete for everyone
                  </button>
                )}
             </div>
           )}
        </div>

        {msg.attachment && (
          <div className="mb-2">
            {msg.attachment.type.startsWith('image/') ? (
              <img 
                src={msg.attachment.url} 
                alt="attachment" 
                className="rounded-xl max-h-60 w-full object-cover border border-black/5" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? 'bg-black/5 border-black/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMe ? 'bg-[#128c7e] text-white' : 'bg-brand-50 text-brand-600'}`}>
                  <FileText size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{msg.attachment.name}</p>
                  <p className="text-[10px] opacity-70">{(msg.attachment.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}
          </div>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <p className={`text-[9px] font-bold uppercase ${isMe ? 'text-slate-400' : 'text-slate-400'}`}>
            {formatMessageDate(msg.createdAt)}
          </p>
          {isMe && <CheckCheck size={14} className="text-[#34b7f1]" />}
        </div>
      </div>
    );
  };

  const filteredChats = chats.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] flex bg-[#f0f2f5] rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-full md:w-96' : 'hidden'} md:flex flex-col border-r border-slate-200 bg-white z-20 transition-all`}>
        <div className="h-16 px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-slate-200">
           <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden border border-white">
              {user?.photoURL ? <img src={user.photoURL} alt="profile" /> : <User size={24} className="m-auto mt-2 text-slate-500" />}
           </div>
           <div className="flex items-center gap-4 text-slate-500">
              <button onClick={() => setIsModalOpen(true)} className="p-2 hover:bg-black/5 rounded-full transition-colors" title="New Group">
                 <span className="text-[10px] font-bold uppercase tracking-wider">Group</span>
              </button>
              <button onClick={() => setIsNewDirectChatOpen(true)} className="p-2 hover:bg-black/5 rounded-full transition-colors" title="New DM">
                 <span className="text-[10px] font-bold uppercase tracking-wider">New</span>
              </button>
           </div>
        </div>

        <div className="p-2 bg-white">
           <div className="relative">
              <input 
                type="text" 
                placeholder="Search..."
                className="w-full pl-12 pr-4 py-2 bg-[#f0f2f5] rounded-xl text-sm outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 transition-all uppercase"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
           {searchQuery.length > 0 && userSearchResults.length > 0 && (
             <div className="px-4 py-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                   Directory Search
                </p>
                {userSearchResults.map(u => (
                  <button 
                    key={u.id}
                    onClick={() => handleCreateDirectChat(u)}
                    className="w-full flex items-center gap-3 py-2 hover:bg-slate-50 transition-colors group"
                  >
                      <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold group-hover:bg-brand-600 group-hover:text-white shrink-0 overflow-hidden">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                        ) : (
                          u.displayName[0]
                        )}
                      </div>
                     <div className="text-left min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{u.displayName}</p>
                        <p className="text-[9px] text-slate-400 font-mono tracking-tighter uppercase">{u.uniqueId} • {u.role}</p>
                     </div>
                  </button>
                ))}
                <div className="h-px bg-slate-100 my-4" />
             </div>
           )}

            {filteredChats.map(ch => {
              const isActive = activeChat?.id === ch.id;
              const isBot = ch.id === 'campus-bot';
              const isAnnouncements = ch.id === 'announcements';
              
              return (
                <button 
                 key={ch.id}
                 onClick={() => {
                   setActiveChat(ch);
                   if (window.innerWidth < 768) setIsSidebarOpen(false);
                 }}
                 className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-50 transition-colors ${isActive ? 'bg-[#ebebeb]' : 'hover:bg-[#f5f6f6]'}`}
                >
                  <div className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 bg-slate-50">
                     {isBot ? (
                       <div className="w-full h-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white">
                         <Sparkles size={20} />
                       </div>
                     ) : isAnnouncements ? (
                       <div className="w-full h-full bg-rose-500 flex items-center justify-center text-white">
                         <Bot size={20} />
                       </div>
                     ) : (
                       <User size={20} className="text-slate-400" />
                     )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                     <div className="flex items-center justify-between mb-0.5">
                        <p className="font-bold text-sm text-slate-800 truncate">{ch.name}</p>
                        <span className="text-[10px] text-slate-400">{formatMessageDate(ch.lastMessageAt)}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <p className="text-xs text-slate-500 truncate flex-1 leading-tight">
                           {isBot ? "Nexus AI: Your integrated campus intelligence" : (ch.lastMessageBy && <span className="font-semibold text-slate-600">{ch.lastMessageBy}: </span>)}
                           {!isBot && (ch.lastMessage || 'Start a conversation')}
                        </p>
                     </div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* Main Chat Pane */}
      <div className={`flex-1 flex flex-col bg-[#e5ddd5] relative ${!isSidebarOpen || (window.innerWidth >= 768) ? 'flex' : 'hidden'}`}>
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none" style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/580/630/wallpaper-whatsapp-background-dark-pattern-whatsapp-doodle-patterns-wallpapers.jpg")', backgroundSize: '400px' }}></div>

        {activeChat ? (
          <>
            <header className="h-16 px-4 bg-[#f0f2f5] border-b border-slate-200 flex items-center justify-between z-10">
               <div className="flex items-center gap-3">
                  <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-500">
                     <ArrowLeft size={20} />
                  </button>
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-white flex items-center justify-center">
                     {activeChat.id === 'campus-bot' ? (
                        <div className="w-full h-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white">
                          <Sparkles size={18} />
                        </div>
                     ) : activeChat.id === 'announcements' ? (
                        <div className="w-full h-full bg-rose-500 flex items-center justify-center text-white">
                          <Bot size={18} />
                        </div>
                     ) : (
                        <User size={18} className="text-slate-400" />
                     )}
                  </div>
                  <div className="min-w-0">
                     <h3 className="font-black text-slate-800 text-sm truncate leading-none mb-0.5">{activeChat.name}</h3>
                     <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">
                           {activeChat.id === 'campus-bot' ? 'AI Assistant' : 'Online'}
                        </p>
                     </div>
                  </div>
               </div>
               <div className="flex items-center gap-4 text-slate-500">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setIsCalling('video')} className="p-2 hover:bg-black/5 rounded-full transition-colors text-brand-600" title="Video Call">
                      <Video size={18} />
                    </button>
                    <button onClick={() => setIsCalling('voice')} className="p-2 hover:bg-black/5 rounded-full transition-colors text-brand-600" title="Voice Call">
                      <Phone size={18} />
                    </button>
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block" />
                  <div className="relative">
                    <button 
                      onClick={() => setShowChatMenu(!showChatMenu)}
                      className="px-2 py-1 hover:bg-black/5 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest text-slate-400"
                    >
                      Menu
                    </button>
                    {showChatMenu && (
                      <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-1 z-50">
                        <button 
                          onClick={handleClearChat}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-wider"
                        >
                          Clear History
                        </button>
                        <button 
                          onClick={handleDeleteChat}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-50 uppercase tracking-wider"
                        >
                          Delete Chat
                        </button>
                      </div>
                    )}
                  </div>
               </div>
            </header>

            <AnimatePresence>
              {isCalling && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
                >
                   <div className="flex flex-col items-center text-center max-w-sm w-full bg-white/10 p-12 rounded-[3rem] border border-white/20 shadow-2xl">
                      <div className="relative mb-8">
                         <div className="w-32 h-32 bg-brand-500 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_50px_rgba(99,102,241,0.5)]">
                            {activeChat.id === 'announcements' ? <Bot size={64} className="text-white" /> : <User size={64} className="text-white" />}
                         </div>
                         <div className="absolute -bottom-2 -right-2 p-3 bg-emerald-500 text-white rounded-2xl shadow-lg border-4 border-slate-900">
                            {isCalling === 'video' ? <Video size={24} /> : <Phone size={24} />}
                         </div>
                      </div>
                      
                      <h3 className="text-2xl font-black text-white mb-2">{isCalling === 'video' ? 'Video calling...' : 'Calling...'}</h3>
                      <p className="text-brand-200 font-bold text-sm uppercase tracking-widest mb-12">{activeChat.name}</p>
                      
                      <div className="flex items-center gap-6">
                         <button 
                           onClick={() => setIsCalling(null)}
                           className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-rose-500/40 hover:scale-110 transition-all active:scale-95"
                         >
                            <X size={32} />
                         </button>
                         <div className="w-16 h-16 border-4 border-white/20 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-0 border-4 border-emerald-400 rounded-full border-t-transparent animate-spin" />
                            <Bot size={24} className="text-emerald-400" />
                          </div>
                       </div>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar relative z-0">
               <div className="flex justify-center mb-6">
                  <div className="px-4 py-1.5 bg-brand-50/80 backdrop-blur-sm rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-brand-600 border border-brand-100 shadow-sm">
                     Today
                  </div>
               </div>
               <motion.div 
                 variants={containerVariants}
                 initial="hidden"
                 animate="visible"
                 className="space-y-4"
               >
                 {messages.map((msg, idx) => {
                   const isMe = msg.senderId === user?.uid;
                   const prevMsg = messages[idx - 1];
                   const isSameUser = prevMsg?.senderId === msg.senderId;
                   
                   return (
                     <motion.div 
                       key={msg.id} 
                       variants={itemVariants}
                       className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isSameUser ? 'mt-1' : 'mt-4'}`}
                     >
                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && !isSameUser && activeChat.type === 'group' && (
                            <p className={`text-[10px] font-bold mb-1 ml-1 ${['school-admin', 'teacher'].includes(msg.senderRole) ? 'text-rose-500' : 'text-brand-600'}`}>
                               {msg.senderName}
                            </p>
                          )}
                          {renderMessageContent(msg)}
                        </div>
                     </motion.div>
                   );
                 })}
               </motion.div>
            </div>

            <div className="p-2 bg-[#f0f2f5] z-10 border-t border-slate-200">
               <AnimatePresence>
                 {showEmojiPicker && (
                   <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-2xl overflow-hidden"
                   >
                      <EmojiPicker 
                        onEmojiClick={onEmojiClick} 
                        theme={Theme.LIGHT} 
                        width={300} 
                        height={400}
                        lazyLoadEmojis
                      />
                   </motion.div>
                 )}
               </AnimatePresence>

               {attachment && (
                 <div className="mx-2 mb-2 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                       <FileIcon size={20} className="text-[#128c7e]" />
                       <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{attachment.name}</p>
                    </div>
                    <button onClick={() => setAttachment(null)} className="p-1 hover:bg-slate-100 rounded-full">
                       <X size={16} />
                    </button>
                 </div>
               )}

               <form onSubmit={handleSend} className="flex items-center gap-2">
                  <div className="flex items-center text-slate-500">
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-black/5 rounded-full transition-colors"
                    >
                       <Smile size={24} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-black/5 rounded-full transition-colors"
                    >
                       <Paperclip size={24} className="rotate-45" />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload}
                      accept="image/*,.pdf,.doc,.docx"
                    />
                  </div>

                  <div className="flex-1">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onFocus={() => setShowEmojiPicker(false)}
                      placeholder="Type a message"
                      disabled={activeChat.id === 'announcements' && user?.role === 'student'}
                      className="w-full bg-white border-none rounded-xl px-4 py-2.5 text-sm outline-none shadow-sm focus:ring-0 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={(!inputText.trim() && !attachment) || isUploading}
                    className={`w-12 h-12 ${inputText.trim() || attachment ? 'bg-[#128c7e]' : 'bg-[#128c7e]'} text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95`}
                  >
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Send size={20} className={inputText.trim() || attachment ? 'rotate-0 translate-x-0' : 'rotate-0'} />
                    )}
                  </button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] border-b-[6px] border-[#128c7e]">
             <div className="w-64 h-64 opacity-5 grayscale scale-125 mb-8 flex items-center justify-center font-black text-6xl text-slate-900">
                CAMPUS
             </div>
             <h2 className="text-3xl font-light text-slate-500 mb-4 tracking-tight">Campus Connect</h2>
             <p className="text-sm text-slate-400 max-w-sm text-center font-medium leading-relaxed">
                Send and receive messages instantly. This is a secure academic network for students and staff.
             </p>
             <div className="mt-12 flex items-center gap-2 text-slate-300">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Encrypted Connection</span>
             </div>
          </div>
        )}
      </div>

      {/* New Group Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50" onClick={() => setIsModalOpen(false)} />
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md bg-white rounded-3xl shadow-2xl relative z-10 p-8">
                <h2 className="text-2xl font-black text-slate-800 mb-2">Create New Group</h2>
                <p className="text-xs text-slate-400 mb-6 font-bold uppercase tracking-widest">Multi-user discussion room</p>
                
                <div className="space-y-5">
                   <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Group Name</label>
                      <input type="text" placeholder="e.g. Science Project" className="w-full px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm" value={newChatName} onChange={e => setNewChatName(e.target.value)} />
                   </div>
                   
                   <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Add Members by ID</label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="ST-1002" className="flex-1 px-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm" value={newMemberId} onChange={e => setNewMemberId(e.target.value)} />
                        <button onClick={() => { if(newMemberId) { setMemberIds([...memberIds, newMemberId]); setNewMemberId(''); } }} className="p-3 bg-slate-100 text-slate-600 rounded-xl"><Plus size={20} /></button>
                      </div>
                   </div>

                   <div className="flex flex-wrap gap-2">
                      {memberIds.map(m => (
                        <span key={m} className="px-3 py-1 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold flex items-center gap-2 border border-brand-100">
                           {m} <X size={14} className="cursor-pointer" onClick={() => setMemberIds(memberIds.filter(id => id !== m))} />
                        </span>
                      ))}
                   </div>

                   <button onClick={handleCreateGroup} className="w-full bg-[#128c7e] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100">Establish Room</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
