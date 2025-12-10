import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { fetchYearlyStats, type BlueskyStats } from "@/lib/bluesky";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Heart, MessageCircle, Calendar, Share2, Copy, Check, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toPng } from "html-to-image";

interface StatsDisplayProps {
  did: string;
  handle?: string;
}

export function StatsDisplay({ did, handle }: StatsDisplayProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<BlueskyStats>({
    posts: 0,
    replies: 0,
    likes: 0,
    loading: true,
    progress: 0,
  });

  useEffect(() => {
    let mounted = true;
    
    const loadStats = async () => {
      try {
        const data = await fetchYearlyStats(did, 2025, (p) => {
          if (mounted) {
            setStats(prev => ({ ...prev, progress: Math.min(prev.progress + p, 90) }));
          }
        });
        
        if (mounted) {
          setStats({
            ...data,
            loading: false,
            progress: 100,
          });
        }
      } catch (err) {
        if (mounted) {
          setStats(prev => ({
            ...prev,
            loading: false,
            error: "Failed to fetch stats. Your timeline might be too massive!",
          }));
        }
      }
    };

    loadStats();
    return () => { mounted = false; };
  }, [did]);

  const shareUrl = `${window.location.origin}/${handle || did}`;
  const shareText = `私の2025年のBluesky活動まとめ:
📝 投稿数: ${stats.posts.toLocaleString()}
💬 リプライ数: ${stats.replies.toLocaleString()}
❤️ いいね数: ${stats.likes.toLocaleString()}

あなたの活動もチェック: ${shareUrl}`;

  const handleShare = () => {
    const intentUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`;
    window.open(intentUrl, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: "リンクをコピーしました",
      description: "あなたの活動をシェアしましょう！",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      // Create a clone for the download to ensure consistent styling and remove animations
      // We'll just snapshot the current view but we need to handle the background properly
      // Actually html-to-image handles most things well.
      
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#0f172a', // Dark background
        style: {
          transform: 'none', // Remove any transforms
        }
      });
      
      const link = document.createElement('a');
      link.download = `bluesky-2025-wrap-${handle || 'stats'}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({
        title: "画像を保存しました",
        description: "統計カードがダウンロードされました。",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "保存失敗",
        description: "画像を生成できませんでした。もう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (stats.loading) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 pt-12">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <h2 className="text-2xl font-display text-white">データを集計中...</h2>
          <p className="text-blue-200/60">PDSから2025年の活動データを取得しています。</p>
        </motion.div>
        
        <div className="space-y-2">
          <Progress value={stats.progress} className="h-2 bg-white/10" />
          <div className="text-xs text-blue-300/40 text-right font-mono">{Math.floor(stats.progress)}%</div>
        </div>
      </div>
    );
  }

  if (stats.error) {
    return (
      <div className="text-center text-red-400 glass-card p-8 rounded-xl">
        <p>データの取得に失敗しました。タイムラインが大きすぎる可能性があります。</p>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-xl mx-auto space-y-8 pb-12"
    >
      {/* Capture Area */}
      <div ref={cardRef} className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Decorative background for the image */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-500/20 rounded-full blur-[80px]" />

        <motion.div variants={item} className="text-center space-y-2 mb-8 relative z-10">
          <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/20 mb-2">
            2025年まとめ
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight break-all px-4">
            {handle || "あなた"}
          </h1>
          <p className="text-blue-200/60 text-xs sm:text-sm">Blueskyでの一年</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <motion.div variants={item}>
            <StatCard 
              icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
              label="投稿数"
              value={stats.posts}
              sub="Thoughts"
              delay={0}
              compact
            />
          </motion.div>
          <motion.div variants={item}>
            <StatCard 
              icon={<MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />}
              label="リプライ"
              value={stats.replies}
              sub="Replies"
              delay={0.1}
              compact
            />
          </motion.div>
          <motion.div variants={item} className="col-span-2">
            <StatCard 
              icon={<Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />}
              label="いいね"
              value={stats.likes}
              sub="あなたが送った「いいね」の数"
              className="bg-gradient-to-br from-pink-900/20 to-purple-900/20"
              delay={0.2}
            />
          </motion.div>
        </div>

        {stats.mostActiveMonth && (
          <motion.div variants={item} className="pt-3 relative z-10">
            <Card className="bg-black/20 border-white/5 overflow-hidden relative group">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                  <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-300" />
                  </div>
                  <div className="text-left min-w-0">
                    <h3 className="text-blue-200 text-[10px] sm:text-xs font-medium uppercase tracking-wider whitespace-nowrap truncate">最も活発だった月</h3>
                    <p className="text-lg sm:text-xl font-display font-bold text-white truncate">
                      {stats.mostActiveMonth}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-white/30 relative z-10">
           <span>bluesky-year-in-review</span>
           <span className="font-mono">{new Date().getFullYear()}</span>
        </div>
      </div>

      <motion.div variants={item} className="text-center pt-4 space-y-6">
        <div className="flex flex-col gap-3 px-4">
          <Button 
            onClick={handleShare}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium shadow-lg shadow-blue-500/20 text-sm sm:text-base"
          >
            <Share2 className="mr-2 h-4 w-4" />
            Blueskyでシェア
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={handleDownload}
              variant="secondary"
              className="w-full h-11 bg-white/10 hover:bg-white/20 text-white border-0 rounded-full text-xs sm:text-sm"
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              )}
              画像を保存
            </Button>
            
            <Button 
              onClick={handleCopy}
              variant="ghost"
              className="w-full h-11 text-blue-200 hover:text-white hover:bg-white/5 rounded-full text-xs sm:text-sm"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
                  コピー完了
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  リンクをコピー
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon, label, value, sub, className = "", delay, compact = false }: any) {
  return (
    <Card className={`glass-card border-white/5 overflow-hidden relative group h-full ${className}`}>
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardContent className={`${compact ? 'p-4 sm:p-5' : 'p-6'} relative z-10 flex flex-col justify-between h-full`}>
        <div className="flex items-start justify-between mb-2">
          <div className={`${compact ? 'p-1.5 sm:p-2' : 'p-3'} rounded-xl bg-white/5 backdrop-blur-md`}>
            {icon}
          </div>
        </div>
        <div>
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + delay, type: "spring" }}
            className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl md:text-5xl'} font-display font-bold text-white tracking-tighter mb-0.5`}
          >
            {value.toLocaleString()}
          </motion.div>
          <h3 className="text-xs sm:text-sm font-medium text-blue-100 whitespace-nowrap">{label}</h3>
          {!compact && <p className="text-[10px] sm:text-xs text-blue-300/50 mt-0.5 line-clamp-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
