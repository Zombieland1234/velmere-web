"use client";

import { useState } from "react";
import {
  BarChart3,
  Bell,
  Grid3X3,
  Search,
  Shield,
  Star,
  TrendingUp,
  User,
} from "lucide-react";
import { Link, useRouter } from "@/navigation";

type AssetDetailNavbarProps = {
  activeSection?: string;
};

export default function AssetDetailNavbar({
  activeSection = "markets",
}: AssetDetailNavbarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-[#142934] bg-[#0c1820]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between px-6">
        {/* Left Side: Logo + Nav Items */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl font-light tracking-[0.22em] text-white">
              VELMÈRE
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden items-center gap-2 md:flex">
            {/* Markets (Active) */}
            <Link
              href="/market-integrity"
              className="relative flex h-14 items-center gap-2 px-3 text-sm font-semibold text-white transition-colors"
            >
              <BarChart3 className="h-4 w-4 text-[#2dd4bf]" />
              <span>Markets</span>
              {/* Teal active underline indicator matching przyklad.jpg */}
              <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#2dd4bf]" />
            </Link>

            {/* Analytics */}
            <Link
              href="/security/audits"
              className="flex items-center gap-2 px-3.5 py-4 text-sm font-medium text-[#8da5b2] transition-colors hover:text-white"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Analytics</span>
            </Link>

            {/* Shield */}
            <Link
              href="/shield"
              className="flex items-center gap-2 px-3.5 py-4 text-sm font-medium text-[#8da5b2] transition-colors hover:text-white"
            >
              <Shield className="h-4 w-4" />
              <span>Shield</span>
            </Link>

            {/* Watchlist */}
            <Link
              href="/market-integrity"
              className="flex items-center gap-2 px-3.5 py-4 text-sm font-medium text-[#8da5b2] transition-colors hover:text-white"
            >
              <Star className="h-4 w-4" />
              <span>Watchlist</span>
            </Link>

            {/* More */}
            <button className="flex items-center gap-2 px-3.5 py-4 text-sm font-medium text-[#8da5b2] transition-colors hover:text-white">
              <Grid3X3 className="h-4 w-4" />
              <span>More</span>
            </button>
          </div>
        </div>

        {/* Right Side: Search + Notifications + Profile */}
        <div className="flex items-center gap-3.5">
          {/* Search Bar matching przyklad.jpg */}
          <form onSubmit={handleSearchSubmit} className="relative hidden sm:block">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-[#5e7c8b]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj rynków, tokenów, aktywów."
                className="h-9 w-64 rounded-full border border-[#163342] bg-[#091720] pl-9 pr-4 text-xs text-white placeholder-[#5e7c8b] transition-all focus:border-[#2dd4bf]/60 focus:bg-[#0c1f2b] focus:w-80 focus:outline-none"
              />
            </div>
          </form>

          {/* Bell Icon */}
          <button
            title="Powiadomienia"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#8da5b2] transition hover:bg-[#122833] hover:text-white"
          >
            <Bell className="h-4 w-4" />
          </button>

          {/* Profile Avatar Icon */}
          <Link
            href="/account"
            title="Konto użytkownika"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#122833] text-[#8da5b2] transition hover:border hover:border-[#2dd4bf]/40 hover:text-white"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
