"use client";

import React from 'react';
import { useLayoutContext } from './LayoutContext';

export default function Topbar() {
  const { setIsMobileSidebarOpen } = useLayoutContext();
  return (
    <nav className="bg-white h-[4.375rem] shadow-[0_0.15rem_1.75rem_0_rgba(58,59,69,0.15)] flex items-center justify-between px-6 z-10">

      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsMobileSidebarOpen(true)}
        className="md:hidden text-[#4e73df] p-2 hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center mr-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4e73df]/50"
      >
        <i className="fa fa-bars"></i>
      </button>

      {/* Topbar Search */}
      <form className="hidden sm:inline-block md:ml-3">
        <div className="flex items-center">
          <input
            type="text"
            className="bg-[#f8f9fc] border border-transparent rounded-l-md px-4 py-2 text-sm focus:outline-none focus:border-[#bac8f3] focus:bg-white focus:ring-0 w-64 transition-colors"
            placeholder="Search for..."
            aria-label="Search"
          />
          <button className="bg-[#4e73df] hover:bg-[#2e59d9] text-white rounded-r-md px-4 py-2 transition-colors focus:outline-none" type="button">
            <i className="fas fa-search fa-sm"></i>
          </button>
        </div>
      </form>

      {/* Topbar Navbar */}
      <ul className="flex items-center ml-auto">

        {/* Alerts */}
        <li className="relative mx-2">
          <button className="text-[#d1d3e2] hover:text-[#b7b9cc] p-2 flex items-center justify-center rounded-full relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4e73df]/50">
            <i className="fas fa-bell fa-fw"></i>
            <span className="absolute top-1 right-1 bg-[#e74a3b] text-white text-[0.55rem] font-bold px-1 rounded-sm leading-none">3+</span>
          </button>
        </li>

        {/* Messages */}
        <li className="relative mx-2">
          <button className="text-[#d1d3e2] hover:text-[#b7b9cc] p-2 flex items-center justify-center rounded-full relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4e73df]/50">
            <i className="fas fa-envelope fa-fw"></i>
            <span className="absolute top-1 right-1 bg-[#e74a3b] text-white text-[0.55rem] font-bold px-1 rounded-sm leading-none">7</span>
          </button>
        </li>

        <div className="w-px h-[2.375rem] bg-[#e3e6f0] mx-4 hidden sm:block"></div>

        {/* User Information */}
        <li className="relative">
          <button className="flex items-center gap-2 text-gray-600 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4e73df]/50 rounded-full px-2 py-1">
            <span className="hidden lg:inline text-sm font-semibold">Admin User</span>
            <i className="fas fa-user-circle text-3xl text-[#d1d3e2]"></i>
          </button>
        </li>

      </ul>
    </nav>
  );
}
