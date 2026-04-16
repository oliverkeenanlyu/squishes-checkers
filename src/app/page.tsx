"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { api } from "@/trpc/react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [hasEntered, setHasEntered] = useState(false);
  const pigeonRef = useRef<HTMLDivElement>(null);
  const coffeeRef = useRef<HTMLDivElement>(null);
  
  // Check if user is admin (only when authenticated)
  const { data: isUserAdmin } = api.allowedEmails.isAdmin.useQuery(
    undefined,
    { enabled: status === "authenticated" }
  );

  // Redirect to sign-in if not authenticated
  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-200 rounded-full animate-pulse"></div>
          <p className="text-gray-600">Loading your coffee...</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return <div>No session</div>;
  }

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const rect = pigeonRef.current?.getBoundingClientRect();
    if (rect) {
      setDragPosition({ x: clientX - rect.left, y: clientY - rect.top });
    }
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !pigeonRef.current || !coffeeRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    
    const pigeonRect = pigeonRef.current.getBoundingClientRect();
    const coffeeRect = coffeeRef.current.getBoundingClientRect();
    
    const newX = clientX - dragPosition.x;
    const newY = clientY - dragPosition.y;
    
    pigeonRef.current.style.transform = `translate(${newX - pigeonRect.left}px, ${newY - pigeonRect.top}px)`;
    
    // Check if pigeon is over coffee cup
    const distance = Math.sqrt(
      Math.pow(clientX - (coffeeRect.left + coffeeRect.width / 2), 2) +
      Math.pow(clientY - (coffeeRect.top + coffeeRect.height / 2), 2)
    );
    
    if (distance < 80 && !hasEntered) {
      setHasEntered(true);
      setTimeout(() => router.push('/lobby'), 800);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (!hasEntered && pigeonRef.current) {
      pigeonRef.current.style.transform = 'translate(0, 0)';
    }
  };

  return (
    <main 
      className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 relative overflow-hidden"
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-8xl animate-bounce delay-1000">🏁</div>
        <div className="absolute top-32 right-20 text-6xl animate-pulse delay-500">🎯</div>
        <div className="absolute bottom-20 left-1/4 text-7xl animate-bounce delay-700">⚔️</div>
        <div className="absolute bottom-32 right-16 text-5xl animate-pulse">👑</div>
      </div>

      {/* Header */}
      <div className="absolute top-4 right-4 z-10">
        <Link
          href="/api/auth/signout"
          className="px-3 py-2 text-sm bg-red-500/20 backdrop-blur-sm text-red-700 rounded-full hover:bg-red-500/30 transition-all"
        >
          Sign Out
        </Link>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 sm:py-16 relative z-20">
        <div className="text-center mb-8 sm:mb-16">
          {/* Title */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 mb-2 sm:mb-4">
              Squishes
            </h1>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-2 sm:mb-4">
              Checkers ✨
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Welcome, <span className="font-semibold text-orange-600">{session.user.name ?? session.user.email}</span>! 👋<br/>
              Where strategy meets whimsy, and every move is an adventure.
            </p>
          </div>

          {/* Interactive Section */}
          <div className="relative max-w-lg mx-auto mb-8 sm:mb-12">
            {!hasEntered ? (
              <>
                <div className="text-center mb-6 sm:mb-8">
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2 sm:mb-3">
                    Meet Your Guide! 🐦
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
                    This is <span className="font-semibold text-blue-600">Hank</span>, your feathered checkers companion.<br/>
                    <span className="text-orange-600 font-medium">Drag him to the coffee cup</span> to enter the magical world of checkers!
                  </p>
                </div>

                {/* Pigeon (Draggable) */}
                <div
                  ref={pigeonRef}
                  className={`relative mx-auto w-24 h-24 sm:w-32 sm:h-32 cursor-grab ${isDragging ? 'cursor-grabbing scale-110' : 'hover:scale-105'} transition-all duration-300 select-none touch-none`}
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                >
                  <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                    <span className="text-4xl sm:text-5xl animate-bounce">🐦</span>
                  </div>
                  {!isDragging && (
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 sm:w-6 sm:h-6 bg-orange-500 rounded-full animate-pulse shadow-md"></div>
                  )}
                </div>

                <div className="text-center mt-6 sm:mt-8">
                  <p className="text-xs sm:text-sm text-gray-500 italic animate-pulse">
                    💡 Pro tip: Hank loves coffee almost as much as checkers! Careful.... He might steal your coffee if you&apos;re not careful...
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center animate-fade-in">
                <div className="text-6xl sm:text-7xl mb-4 animate-spin">☕</div>
                <h3 className="text-xl sm:text-2xl font-bold text-orange-600 mb-2">
                  Welcome to the Lobby! ✨
                </h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Hank is brewing up some amazing games for you...
                </p>
              </div>
            )}
          </div>

          {/* Coffee Cup (Drop Target) */}
          <div className="relative">
            <div
              ref={coffeeRef}
              className={`mx-auto w-20 h-20 sm:w-24 sm:h-24 ${hasEntered ? 'scale-150 animate-spin' : 'hover:scale-110'} transition-all duration-500`}
            >
              <div className="w-full h-full bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white relative overflow-hidden">
                <span className="text-3xl sm:text-4xl z-10">☕</span>
                <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20"></div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 font-medium">
              🎯 Drop Zone
            </p>
          </div>

          {/* Quick Access Buttons */}
          <div className="mt-8 sm:mt-12 space-y-3 sm:space-y-4">
            <Link
              href="/lobby"
              className="block w-full max-w-sm mx-auto px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-base sm:text-lg font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transform hover:scale-105 transition-all duration-300 shadow-lg"
            >
              🎮 Go to Game Lobby
            </Link>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              {isUserAdmin && (
                <Link
                  href="/admin"
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-gray-500/20 backdrop-blur-sm text-gray-700 text-sm sm:text-base font-semibold rounded-xl hover:bg-gray-500/30 transition-all duration-300"
                >
                  ⚙️ Admin Panel
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Fun Facts */}
        <div className="mt-12 sm:mt-20">
          <h3 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-6 sm:mb-8">
            Did You Know? 🤔
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:bg-white/70 transition-all duration-300">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🧠</div>
              <h4 className="font-bold text-gray-800 text-sm sm:text-base mb-1 sm:mb-2">Smart Strategy</h4>
              <p className="text-xs sm:text-sm text-gray-600">Hank uses complex algorithms to challenge players of all skill levels!</p>
            </div>
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:bg-white/70 transition-all duration-300">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🌍</div>
              <h4 className="font-bold text-gray-800 text-sm sm:text-base mb-1 sm:mb-2">Play Anywhere</h4>
              <p className="text-xs sm:text-sm text-gray-600">Fully optimized for mobile and desktop experiences!</p>
            </div>
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:bg-white/70 transition-all duration-300">
              <div className="text-3xl sm:text-4xl mb-2 sm:mb-3">🎉</div>
              <h4 className="font-bold text-gray-800 text-sm sm:text-base mb-1 sm:mb-2">Pure Fun</h4>
              <p className="text-xs sm:text-sm text-gray-600">Where classic checkers meets modern whimsy!</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}