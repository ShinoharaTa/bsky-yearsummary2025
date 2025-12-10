import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  fetchYearlyStats,
  fetchSavedSummary,
  type BlueskyStats,
  agent,
} from "@/lib/bluesky";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Heart,
  MessageCircle,
  Calendar,
  Share2,
  Copy,
  Check,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toPng } from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StatsDisplayProps {
  did: string;
  handle?: string;
}

function buildSummaryText(stats: BlueskyStats): string {
  const mostActiveMonthName = stats.mostActiveMonth ?? null;

  return (
    `2025年のBluesky活動まとめ（bsky-summary2025.shino3.net）\n\n` +
    `📝 投稿: ${stats.posts.toLocaleString()} 件\n` +
    `💬 リプライ数: ${stats.replies.toLocaleString()} 件\n` +
    `❤️ いいね数: ${stats.likes.toLocaleString()} 件` +
    (mostActiveMonthName ? `\n📅 もっとも活発だった月: ${mostActiveMonthName}` : "")
  );
}

export function StatsDisplay({ did, handle }: StatsDisplayProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
   const [autoSaved, setAutoSaved] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useLocation();
  const [redirected, setRedirected] = useState(false);

  const [stats, setStats] = useState<BlueskyStats>({
    posts: 0,
    replies: 0,
    likes: 0,
    loading: true,
    progress: 0,
  });

  useEffect(() => {
    let mounted = true;

    // /:handle でアクセスしている場合は、常にレキシコンの
    // Year Summary レコードのみを読む軽量モードにする。
    // （重い listRecords ベースの解析は / のときだけ行う）
    const shouldUseSavedSummary = !!handle;

    const loadStats = async () => {
      try {
        if (shouldUseSavedSummary && handle) {
          // 保存済みサマリーのみを取得するモード（他人の /:handle 表示時など）
          const data = await fetchSavedSummary(handle);
          if (mounted) {
            setStats({
              ...data,
              loading: false,
              progress: 100,
            });
          }
        } else {
          // 自分自身のアカウントに対する重い解析（listRecords）モード
          const data = await fetchYearlyStats(did, 2025, (p) => {
            if (mounted) {
              setStats((prev) => ({
                ...prev,
                progress: Math.min(prev.progress + p, 90),
              }));
            }
          });

          if (mounted) {
            setStats({
              ...data,
              loading: false,
              progress: 100,
            });
          }
        }
      } catch (err) {
        if (mounted) {
          setStats((prev) => ({
            ...prev,
            loading: false,
            error: "Failed to fetch stats. Your timeline might be too massive!",
          }));
        }
      }
    };

    loadStats();
    return () => {
      mounted = false;
    };
  }, [did, handle]);

  // 自分自身のアカウントを / で解析し終わったタイミングで、
  // Year Summary を自動的に PDS に保存する。
  useEffect(() => {
    if (autoSaved) return;
    if (stats.loading || stats.error) return;
    // /:handle のときは、このマウントでは自動保存しない（/ で一度だけ保存）
    if (handle) return;
    if (!agent.session || agent.session.did !== did) return;

    const saveToPds = async () => {
      try {
        const generatedAt = new Date().toISOString();
        const summaryText = buildSummaryText(stats);

        await agent.api.com.atproto.repo.putRecord({
          repo: agent.session!.did,
          collection: "net.shino3.yearsummary2025.wrap",
          rkey: "2025",
          record: {
            year: 2025,
            generatedAt,
            posts: stats.posts,
            replies: stats.replies,
            likes: stats.likes,
            mostActiveMonth: stats.mostActiveMonth ?? null,
            firstPostDate: null,
            summaryText,
            lang: "ja",
            version: "1.0.0",
          },
        });

        setAutoSaved(true);

        // 自動保存後に、シェアを促すモーダルを一度表示する
        setShareDialogOpen(true);
      } catch (err) {
        console.error("Failed to auto-save year summary", err);
      }
    };

    void saveToPds();
  }, [autoSaved, stats, did]);

  // 解析完了時に、自分のアカウントであれば /:handle へ遷移して
  // その URL をそのままシェアに使えるようにする。
  useEffect(() => {
    if (redirected) return;
    if (stats.loading || stats.error) return;

    const isSelf = !!(agent.session && agent.session.did === did);
    const isRootPath = location === "/";

    // / （ハンドル無し）で自分自身を見ているときにのみ、
    // 解析完了後に /:handle へ遷移する。
    if (isSelf && isRootPath && !handle && agent.session?.handle) {
      setRedirected(true);
      setLocation(`/${agent.session.handle}`);
    }
  }, [stats.loading, stats.error, handle, did, location, redirected, setLocation]);

  const shareUrl = `${window.location.origin}/${handle || did}`;
  const shareText = `私の2025年のBluesky活動まとめ
📝 投稿数: ${stats.posts.toLocaleString()}
💬 リプライ数: ${stats.replies.toLocaleString()}
❤️ いいね数: ${stats.likes.toLocaleString()}

あなたも2025年を振り返ってみませんか？
👉 ${shareUrl}`;

  const handleShare = () => {
    setShareDialogOpen(true);
  };

  const handleConfirmShare = () => {
    const intentUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(
      shareText,
    )}`;
    window.open(intentUrl, "_blank");
    setShareDialogOpen(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({
      title: "リンクをコピーしました",
      description: "SNSでシェアしましょう！",
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
        title: "画像をダウンロードしました",
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

  const canSave = !!(agent.session && agent.session.did === did);

  const handleSaveAndPost = async () => {
    if (!canSave) {
      toast({
        title: "保存できません",
        description: "自分のアカウントでログインしてください。",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const generatedAt = new Date().toISOString();
      const displayName = handle || agent.session?.handle || "あなた";
      const summaryText = buildSummaryText(stats);

      // Bluesky にも自動投稿
      const postText =
        `${displayName} の 2025 年の Bluesky 活動まとめ\n\n` +
        summaryText +
        `\n\n詳しくはこちら: ${shareUrl}`;

      await agent.post({
        text: postText,
      });

      setSavedOnce(true);
      toast({
        title: "保存・投稿しました！",
        description: "あなたのPDSへの保存と、Blueskyへの投稿が完了しました。",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "保存／投稿に失敗しました",
        description: "時間をおいてもう一度お試しください。",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (stats.loading) {
    return (
      <div className="w-full max-w-md mx-auto text-center space-y-6 py-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <h2 className="text-2xl font-display text-white">
            2025年の足あとを集計中…
          </h2>
          <p className="text-blue-200/70 text-sm sm:text-base">
            PDSから2025年の投稿・リプライ・いいねを読み込んでいます。少しお待ちください。
          </p>
        </motion.div>

        <div className="space-y-2">
          <Progress value={stats.progress} className="h-2 bg-white/10" />
          <div className="text-xs text-blue-300/40 text-right font-mono">
            {Math.floor(stats.progress)}%
          </div>
        </div>
      </div>
    );
  }

  if (stats.error) {
    // 共有用リンクなどから /[identifier] で直接アクセスされた場合、
    // PDS からデータが取得できなければ、その人への「リクエスト画面」を表示する
    if (handle) {
      const atHandle = handle.startsWith("@") ? handle : `@${handle}`;

      const handleRequest = () => {
        const appRoot = window.location.origin;
        const requestText = `${atHandle} さんの 2025 年の Bluesky 活動まとめを見たいです！\n\nここから生成できます：${appRoot}`;
        const intentUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(
          requestText,
        )}`;
        window.open(intentUrl, "_blank");
      };

      const goHome = () => {
        window.location.href = "/";
      };

      return (
        <div className="w-full max-w-md mx-auto py-8 text-center">
          <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 bg-black/40 text-white space-y-4">
            <h2 className="text-xl font-display font-bold">
              {atHandle} さんのまとめはまだありません
            </h2>
            <p className="text-sm text-blue-200/70 leading-relaxed">
              PDSから2025年のまとめレコードが見つかりませんでした。
              <br />
              アカウントの持ち主に「今年のまとめを作ってほしい」とお願いしてみましょう。
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={handleRequest}
                className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium"
              >
                Blueskyでまとめ作成をお願いする
              </Button>
              <Button
                variant="ghost"
                onClick={goHome}
                className="w-full h-11 text-blue-200 hover:text-white hover:bg-white/5 rounded-full text-sm"
              >
                トップページに戻る
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // 自分自身の画面など、handle が無い場合は従来どおりのエラーメッセージ
    return (
      <div className="w-full max-w-md mx-auto py-8">
        <div className="text-center text-red-400 glass-card p-6 sm:p-8 rounded-2xl">
          <p className="text-sm sm:text-base">
            データの取得に失敗しました。タイムラインが大きいか、一時的なエラーの可能性があります。時間をおいて再度お試しください。
          </p>
        </div>
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
      className="w-full max-w-lg mx-auto space-y-6 pb-8"
    >
      {/* Capture Area */}
      <div ref={cardRef} className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Decorative background for the image */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500/20 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-500/20 rounded-full blur-[80px]" />

        <motion.div
          variants={item}
          className="text-center space-y-2 mb-6 relative z-10"
        >
          <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/20 mb-2">
            SkyWrap '25
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight break-all">
            {handle || "あなた"}
          </h1>
          <p className="text-blue-200/70 text-xs sm:text-sm">
            Bluesky Life in 2025
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <motion.div variants={item}>
            <StatCard
              icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
              label="📝 投稿数"
              value={stats.posts}
              sub="Posts"
              delay={0}
              compact
            />
          </motion.div>
          <motion.div variants={item}>
            <StatCard
              icon={<MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />}
              label="↩️ リプライ"
              value={stats.replies}
              sub="Replies"
              delay={0.1}
              compact
            />
          </motion.div>
          <motion.div variants={item} className="col-span-2">
            <StatCard
              icon={<Heart className="w-4 h-4 sm:h-5 sm:w-5 text-pink-400" />}
              label="❤️ いいねした数"
              value={stats.likes}
              sub="Likes Sent"
              className="bg-gradient-to-br from-pink-900/20 to-purple-900/20"
              delay={0.2}
            />
          </motion.div>
        </div>

        {stats.mostActiveMonth && (
          <motion.div variants={item} className="pt-4 relative z-10">
            <Card className="bg-black/20 border-white/5 overflow-hidden relative group">
              <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-300" />
                </div>
                <div className="text-left min-w-0">
                  <h3 className="text-blue-200 text-[10px] sm:text-xs font-medium uppercase tracking-wider whitespace-nowrap truncate">
                    📅 一番盛り上がった月
                  </h3>
                  <p className="text-lg sm:text-xl font-display font-bold text-white truncate">
                    {stats.mostActiveMonth}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-white/30 relative z-10">
          <span>bsky-summary2025.shino3.net</span>
          <span className="font-mono">{new Date().getFullYear()}</span>
        </div>
      </div>

      <motion.div variants={item} className="space-y-4">
        <Button
          onClick={handleShare}
          className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium shadow-lg shadow-blue-500/20 text-sm sm:text-base"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Blueskyに投稿
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

        {canSave && (
          <div className="space-y-2">
            <Button
              onClick={handleSaveAndPost}
              disabled={saving || savedOnce}
              className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full text-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blueskyに投稿中...
                </>
              ) : savedOnce ? (
                "Blueskyに投稿済み"
              ) : (
                "このまとめをBlueskyに投稿"
              )}
            </Button>
            <p className="text-[11px] text-blue-200/60 text-left">
              bsky-summary2025.shino3.net が、あなたのPDSに
              <span className="font-mono"> net.shino3.yearsummary2025.wrap/2025 </span>
              としてまとめを保存し、同じ内容をBlueskyへ投稿します。
            </p>
          </div>
        )}

        {/* CTA: この結果を見た人自身にも一年のまとめを作ってもらう導線 */}
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-left space-y-3">
          <div className="space-y-1">
            <p className="text-sm text-blue-50 font-medium">
              次は、あなたの番です。
            </p>
            <p className="text-xs text-blue-100/70">
              ログインするだけで、あなただけの2025年まとめカードがすぐに作れます。
            </p>
          </div>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="secondary"
            className="w-full h-10 bg-white text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-medium rounded-full"
          >
            私も2025年まとめを作る
          </Button>
        </div>
      </motion.div>

      {/* Blueskyシェア用モーダル */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-slate-950 text-white border-white/10">
          <DialogHeader>
            <DialogTitle>Blueskyで2025年の活動をシェアしませんか？</DialogTitle>
            <DialogDescription className="text-blue-100/70">
              投稿内容は開いたあとで自由に編集できます。気軽にシェアしてみましょう。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 p-3 rounded-lg bg-slate-900/80 border border-white/10 max-h-52 overflow-y-auto">
            <p className="text-xs whitespace-pre-wrap text-blue-50">{shareText}</p>
          </div>

          <DialogFooter className="mt-4 space-y-2 sm:space-y-0">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto text-blue-200 hover:text-white hover:bg-white/5"
              onClick={() => setShareDialogOpen(false)}
            >
              あとで
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleConfirmShare}
            >
              Blueskyを開いて投稿する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
