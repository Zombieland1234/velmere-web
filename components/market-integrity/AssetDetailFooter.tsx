"use client";

export default function AssetDetailFooter() {
  return (
    <footer data-asset-detail-footer className="w-full border-t border-[#142833] bg-[#08141a] px-6 py-3.5">
      <div className="mx-auto flex max-w-[1680px] items-center justify-between text-xs text-[#718d9c]">
        {/* Left branding */}
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">Velmère</span>
          <span className="text-[#3b5563]">|</span>
          <span>Market Intelligence &amp; Risk Analysis</span>
        </div>

        {/* Right status info matching przyklad.jpg */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_rgba(45,212,191,0.7)]" />
            <span className="text-[#8ea5b1]">System online</span>
          </div>
          <span className="font-mono text-[#5d7a89]">2026-09-07 21:46</span>
        </div>
      </div>
    </footer>
  );
}
