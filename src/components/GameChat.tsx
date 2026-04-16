"use client";

import React, { useState, useEffect, useRef } from 'react';
import { api } from "@/trpc/react";
import { createGameCrypto, ChatCrypto } from '@/lib/chat-crypto';

interface ChatMessage {
  id: number;
  senderId: string;
  encryptedMessage: string;
  iv: string;
  createdAt: Date;
  decryptedText?: string; // Cached decrypted text
  senderName?: string;    // Display name
}

interface GameChatProps {
  gameId: string;
  currentUserId: string;
  player1?: { id: string; name?: string | null };
  player2?: { id: string; name?: string | null };
  isOpen?: boolean;
  onToggle?: () => void;
}

export function GameChat({
  gameId,
  currentUserId,
  player1,
  player2,
  isOpen = false,
  onToggle,
}: GameChatProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [crypto, setCrypto] = useState<ChatCrypto | null>(null);
  const [isEncryptionSupported, setIsEncryptionSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Query messages
  const { data: messageData, refetch } = api.chat.getMessages.useQuery(
    { gameId },
    { 
      enabled: isOpen && !!gameId,
      refetchInterval: 3000, // Poll for new messages
    }
  );

  // Send message mutation
  const sendMessageMutation = api.chat.sendMessage.useMutation({
    onSuccess: async () => {
      setMessage('');
      void refetch();
    },
  });

  // Track new messages when user has scrolled up
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevMessageCountRef = useRef(0);

  // Update new message count when messages change and user has scrolled
  useEffect(() => {
    if (userHasScrolled && messages.length > prevMessageCountRef.current) {
      const newCount = messages.length - prevMessageCountRef.current;
      setNewMessageCount(prev => prev + newCount);
    }
    
    if (shouldAutoScroll) {
      setNewMessageCount(0);
    }
    
    prevMessageCountRef.current = messages.length;
  }, [messages, userHasScrolled, shouldAutoScroll]);

  // Initialize encryption
  useEffect(() => {
    if (gameId && ChatCrypto.isSupported()) {
      setIsEncryptionSupported(true);
      setCrypto(createGameCrypto(gameId));
    } else {
      setIsEncryptionSupported(false);
    }
  }, [gameId]);

  // Decrypt messages when data changes
  useEffect(() => {
    if (messageData && crypto) {
      const decryptMessages = async () => {
        const decryptedMessages = await Promise.all(
          messageData.map(async (msg) => {
            let decryptedText = '';
            try {
              decryptedText = await crypto.decrypt(msg.encryptedMessage, msg.iv);
            } catch (error) {
              console.error('Failed to decrypt message:', error);
              decryptedText = '[Message could not be decrypted]';
            }

            // Get sender name
            let senderName = 'Unknown';
            if (msg.senderId === player1?.id) {
              senderName = player1?.name ?? 'Player 1';
            } else if (msg.senderId === player2?.id) {
              senderName = player2?.name ?? 'Player 2';
            }

            return {
              ...msg,
              decryptedText,
              senderName,
              createdAt: new Date(msg.createdAt),
            };
          })
        );
        setMessages(decryptedMessages);
      };

       decryptMessages().catch((error) => { 
        console.error('Error decrypting messages:', error);
       });
    }
  }, [messageData, crypto, player1, player2]);

  // Smart auto-scroll that doesn't interfere with user scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !shouldAutoScroll) return;

    // Use scrollTop instead of scrollIntoView to avoid page scrolling
    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };

    // Small delay to ensure DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages, shouldAutoScroll]);

  // Detect user scroll behavior
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const threshold = 50; // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    
    setShouldAutoScroll(isNearBottom);
    setUserHasScrolled(!isNearBottom);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !crypto) return;

    try {
      const { encryptedMessage, iv } = await crypto.encrypt(message.trim());
      
      // Re-enable auto-scroll when user sends a message (they expect to see their message)
      setShouldAutoScroll(true);
      setUserHasScrolled(false);
      
      await sendMessageMutation.mutateAsync({
        gameId,
        encryptedMessage,
        iv,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isEncryptionSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-yellow-400">⚠️</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Chat Unavailable
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Your browser doesn&apos;t support encrypted chat. Please try a modern browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <span className="text-lg">💬</span>
          <h3 className="text-sm font-medium text-gray-900">
            Encrypted Chat
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            🔒 Encrypted
          </span>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-gray-600"
          >
            {isOpen ? '−' : '+'}
          </button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Messages */}
          <div 
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="h-64 overflow-y-auto p-4 space-y-3 relative"
          >
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => {
                const isMyMessage = msg.senderId === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                        isMyMessage
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {!isMyMessage && (
                        <div className="text-xs font-medium mb-1 opacity-75">
                          {msg.senderName}
                        </div>
                      )}
                      <div className="break-words">
                        {msg.decryptedText}
                      </div>
                      <div className={`text-xs mt-1 ${
                        isMyMessage ? 'text-indigo-200' : 'text-gray-500'
                      }`}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
            
            {/* Scroll to bottom button */}
            {userHasScrolled && (
              <button
                onClick={() => {
                  setShouldAutoScroll(true);
                  setUserHasScrolled(false);
                  setNewMessageCount(0);
                  if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                  }
                }}
                className="absolute bottom-2 right-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105 flex items-center space-x-1"
                title={newMessageCount > 0 ? `${newMessageCount} new message${newMessageCount > 1 ? 's' : ''}` : "Scroll to bottom"}
              >
                {newMessageCount > 0 && (
                  <span className="text-xs font-medium bg-red-500 rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                    {newMessageCount > 9 ? '9+' : newMessageCount}
                  </span>
                )}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onFocus={(e) => {
                  // Prevent mobile keyboard from scrolling the page
                  e.target.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
                }}
                placeholder="Type an encrypted message..."
                maxLength={500}
                style={{ fontSize: '16px' }} // Prevent iOS zoom on focus
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {sendMessageMutation.isPending ? '⏳' : 'Send'}
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Messages are encrypted end-to-end 🔒
            </div>
          </form>
        </>
      )}
    </div>
  );
}