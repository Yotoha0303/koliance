"use client";

import React from "react";

interface BrandIconProps {
  className?: string;
  size?: number;
  glow?: boolean;
}

export function BrandIcon({ className = "w-8 h-8", size = 32, glow = false }: BrandIconProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 select-none overflow-hidden ${
        glow ? "shadow-[0_0_16px_rgba(255,255,255,0.3)]" : ""
      } ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full block"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Solid Circular Black Background */}
        <circle cx="50" cy="50" r="49" fill="#000000" />
        
        {/* Sacred Geometry Triangle (Triforce / Sierpinski Fractal) */}
        <g stroke="#ffffff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" fill="none">
          {/* Outer Triangle */}
          <polygon points="50,21 78,70 22,70" />
          {/* Horizontal Crossbar */}
          <line x1="36" y1="45.5" x2="64" y2="45.5" />
          {/* Inner Downward Left Diagonal */}
          <line x1="36" y1="45.5" x2="50" y2="70" />
          {/* Inner Downward Right Diagonal */}
          <line x1="64" y1="45.5" x2="50" y2="70" />
        </g>
      </svg>
    </div>
  );
}
