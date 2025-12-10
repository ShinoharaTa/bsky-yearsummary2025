import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle, Cloud } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full relative overflow-x-hidden flex flex-col">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      {/* Header/Logo */}
      <header className="relative w-full py-4 sm:py-6 z-10 flex-shrink-0">
        <div className="content-container flex justify-between items-center">
          <Link href="/">
            <div className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
              <Cloud className="w-6 h-6 text-blue-400" />
              <span className="font-display font-bold text-lg tracking-tight">SkyWrap '25</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full relative z-10 flex flex-col justify-center py-6 sm:py-8">
        <div className="content-container">
          <div className="w-full max-w-md mx-auto text-center">
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 space-y-4">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-red-500/10">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-display font-bold text-white">
                  ページが見つかりません
                </h1>
                <p className="text-sm text-blue-200/70 leading-relaxed">
                  お探しのページは削除されたか、URLが間違っている可能性があります。
                </p>
              </div>

              <div className="pt-2">
                <Link href="/">
                  <Button className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium">
                    トップページへ戻る
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full py-4 sm:py-6 text-center text-white/40 text-xs z-10 flex-shrink-0">
        <div className="content-container">
          <p>
            © 2025 <span className="font-semibold">SkyWrap</span>.{" "}
            <span className="text-white/50 text-[11px]">
              Not affiliated with Bluesky PBLLC.
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
