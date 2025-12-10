import { Route, Switch, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { LoginForm } from "@/components/login-form";
import { StatsDisplay } from "@/components/stats-display";
import { agent } from "@/lib/bluesky";
import { Cloud, Sparkles } from "lucide-react";

function HomePage() {
  // Check if we have a session
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDid, setUserDid] = useState<string | null>(null);
  
  // Handling /:handle route manually since wouter's Switch is simple
  // We want to support domain/handle
  const [match, params] = useRoute("/:handle");

  useEffect(() => {
    if (agent.session) {
      setIsAuthenticated(true);
      setUserDid(agent.session.did);
    }
  }, []);

  const handleLoginSuccess = (did: string) => {
    setIsAuthenticated(true);
    setUserDid(did);
  };

  // If a handle is provided in URL, show that user's stats (assuming public)
  // If no handle, show login or own stats
  const targetHandle = match ? params?.handle : null;
  const showStats = !!targetHandle || (isAuthenticated && !targetHandle);
  const didToFetch = targetHandle || userDid;

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
          <div className="flex items-center gap-2 text-white/80">
            <Cloud className="w-6 h-6 text-blue-400" />
            <span className="font-display font-bold text-lg tracking-tight">SkyWrap '25</span>
          </div>
          {isAuthenticated && !targetHandle && (
            <div className="text-sm text-white/40 font-mono">
              {agent.session?.handle}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow w-full relative z-10 flex flex-col justify-center py-6 sm:py-8">
        <div className="content-container">
          {showStats && didToFetch ? (
            <StatsDisplay did={didToFetch} handle={targetHandle || undefined} />
          ) : (
            <div className="space-y-8 py-4 sm:py-0">
              <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-blue-200 text-sm mb-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>Blueskyでの1年を、1枚のカードに。</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-100 to-blue-400 tracking-tighter pb-2 text-balance leading-[1.2]">
                  Bluesky Life in 2025
                </h1>
                <p className="text-base sm:text-lg text-blue-200/70 max-w-lg mx-auto break-keep leading-relaxed">
                  あなたの2025年の投稿・リプライ・いいねを自動で集計し、「1年のまとめカード」として発行します。
                </p>
              </div>
              
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                <LoginForm onSuccess={handleLoginSuccess} />
              </div>
            </div>
          )}
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

export default HomePage;
