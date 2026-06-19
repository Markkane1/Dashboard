"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside 
      className={`bg-gradient-to-b from-[#4e73df] to-[#224abe] flex flex-col text-white transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-[14rem]'}`}
    >
      {/* Brand */}
      <Link href="/admin" className="flex items-center justify-center h-16 mb-4 px-4 hover:opacity-90">
        <div className="rotate-[-15deg] text-3xl">
          <i className="fas fa-laugh-wink"></i>
        </div>
        {!isCollapsed && <div className="ml-3 font-bold text-[1.2rem] tracking-widest uppercase">SB Admin <sup>2</sup></div>}
      </Link>

      <hr className="border-t border-white/20 mx-4 mb-4" />

      {/* Nav Item - Dashboard */}
      <div className="px-4 mb-4">
        <Link href="/admin" className="flex items-center text-white/80 hover:text-white font-bold py-2 group">
          <i className="fas fa-fw fa-tachometer-alt w-5 opacity-70 group-hover:opacity-100"></i>
          {!isCollapsed && <span className="ml-3 text-sm">Dashboard</span>}
        </Link>
      </div>

      <hr className="border-t border-white/20 mx-4 mb-4" />

      {/* Heading */}
      {!isCollapsed && (
        <div className="text-[0.65rem] font-bold text-white/40 uppercase tracking-wider mb-2 px-4">
          Interface
        </div>
      )}

      {/* Nav Item - Components */}
      <div className="px-4 mb-2">
        <button className="flex items-center justify-between w-full text-white/80 hover:text-white py-2 group focus:outline-none">
          <div className="flex items-center">
            <i className="fas fa-fw fa-cog w-5 opacity-70 group-hover:opacity-100"></i>
            {!isCollapsed && <span className="ml-3 text-sm">Components</span>}
          </div>
          {!isCollapsed && <i className="fas fa-angle-right opacity-50 text-[0.6rem]"></i>}
        </button>
      </div>

      {/* Nav Item - Utilities */}
      <div className="px-4 mb-4">
        <button className="flex items-center justify-between w-full text-white/80 hover:text-white py-2 group focus:outline-none">
          <div className="flex items-center">
            <i className="fas fa-fw fa-wrench w-5 opacity-70 group-hover:opacity-100"></i>
            {!isCollapsed && <span className="ml-3 text-sm">Utilities</span>}
          </div>
          {!isCollapsed && <i className="fas fa-angle-right opacity-50 text-[0.6rem]"></i>}
        </button>
      </div>

      <hr className="border-t border-white/20 mx-4 mb-4" />

      {/* Heading */}
      {!isCollapsed && (
        <div className="text-[0.65rem] font-bold text-white/40 uppercase tracking-wider mb-2 px-4">
          Addons
        </div>
      )}

      <div className="px-4 mb-2">
        <button className="flex items-center justify-between w-full text-white/80 hover:text-white py-2 group focus:outline-none">
          <div className="flex items-center">
            <i className="fas fa-fw fa-folder w-5 opacity-70 group-hover:opacity-100"></i>
            {!isCollapsed && <span className="ml-3 text-sm">Pages</span>}
          </div>
          {!isCollapsed && <i className="fas fa-angle-right opacity-50 text-[0.6rem]"></i>}
        </button>
      </div>

      <div className="px-4 mb-2">
        <Link href="#" className="flex items-center text-white/80 hover:text-white py-2 group">
          <i className="fas fa-fw fa-chart-area w-5 opacity-70 group-hover:opacity-100"></i>
          {!isCollapsed && <span className="ml-3 text-sm">Charts</span>}
        </Link>
      </div>

      <div className="px-4 mb-4">
        <Link href="#" className="flex items-center text-white/80 hover:text-white py-2 group">
          <i className="fas fa-fw fa-table w-5 opacity-70 group-hover:opacity-100"></i>
          {!isCollapsed && <span className="ml-3 text-sm">Tables</span>}
        </Link>
      </div>

      <hr className="border-t border-white/20 mx-4 mb-4 hidden md:block" />

      {/* Sidebar Toggler */}
      <div className="hidden md:flex justify-center mb-4">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors focus:outline-none"
        >
          <i className={`fas fa-angle-${isCollapsed ? 'right' : 'left'} text-white/50`}></i>
        </button>
      </div>


    </aside>
  );
}
