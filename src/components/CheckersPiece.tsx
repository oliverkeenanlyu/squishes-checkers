"use client";

import React from 'react';
import { type Piece } from "@/lib/checkers-logic";

interface CheckersPieceProps {
  piece: Piece | null;
  isSelected: boolean;
  isLastMove?: boolean;
  isAnimating?: boolean;
  isPossibleMove: boolean;
  isMandatoryCapture?: boolean;
  _isPossibleMove: boolean;
  _isMandatoryCapture?: boolean;
  onClick: () => void;
  isDarkSquare: boolean;
}

export function CheckersPiece({
  piece,
  isSelected,
  isLastMove = false,
  isAnimating = false,
  _isPossibleMove,
  _isMandatoryCapture = false,
  onClick,
  isDarkSquare,
}: CheckersPieceProps) {
  const baseClasses = "w-full h-full flex items-center justify-center relative transition-all duration-500 ease-in-out checkers-square";
  
  // Square background
  let squareColor = isDarkSquare 
    ? "bg-amber-900" 
    : "bg-amber-100";
  
  // Last move highlighting
  if (isLastMove) {
    squareColor = isDarkSquare ? "bg-blue-700" : "bg-blue-300";
  }
  
  // Highlight states
  let highlightClasses = "";
  if (isSelected) {
    highlightClasses = "ring-4 ring-blue-400";
  } else if (isLastMove) {
    highlightClasses = "ring-2 ring-blue-500";
  }
  // Removed mandatory capture and possible move hints
  
  // Animation classes
  const animationClasses = isAnimating ? "animate-pulse" : "";
  
  // No hint indicators - removed possible move highlighting

  return (
    <div
      className={`
        ${baseClasses} 
        ${squareColor} 
        ${highlightClasses} 
        ${animationClasses}
        ${isDarkSquare ? 'cursor-pointer hover:bg-amber-800' : ''}
        border border-amber-700
      `}
      onClick={isDarkSquare ? onClick : undefined}
    >
      {/* Piece */}
      {piece && (
        <div
          className={`
            w-10 h-10 rounded-full shadow-lg border-2 transition-all duration-300 ease-in-out checkers-piece
            ${piece.player === 'red' 
              ? 'bg-red-600 border-red-800 shadow-red-900/50' 
              : 'bg-gray-800 border-gray-900 shadow-gray-900/50'
            }
            ${isSelected ? 'scale-110 shadow-xl' : 'hover:scale-105'}
            ${piece.type === 'king' ? 'relative' : ''}
            cursor-pointer
          `}
        >
          {/* King crown */}
          {piece.type === 'king' && (
            <div className={`
              absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
              text-xs font-bold
              ${piece.player === 'red' ? 'text-yellow-300' : 'text-yellow-400'}
            `}>
              ♔
            </div>
          )}
        </div>
      )}
    </div>
  );
}