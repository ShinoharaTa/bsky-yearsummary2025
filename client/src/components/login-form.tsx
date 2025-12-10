import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { agent } from "@/lib/bluesky";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Lock, AtSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  identifier: z.string().min(1, "Handle or Email is required"),
  password: z.string().min(1, "App Password is required"),
  service: z.string().default("https://bsky.social"),
});

interface LoginFormProps {
  onSuccess: (did: string) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      service: "https://bsky.social",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      // In a real app, we might want to let the user pick the PDS
      // For now we assume bsky.social or let the agent handle resolution if we implemented that
      await agent.login({
        identifier: values.identifier,
        password: values.password,
      });
      
      if (agent.session) {
        onSuccess(agent.session.did);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "ログイン失敗",
        description: "認証情報をご確認ください。通常のパスワードではなく、アプリパスワードを使用してください。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto glass-card border-white/10 text-white">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl sm:text-2xl font-bold text-center font-display tracking-tight text-balance">
          Blueskyでの1年を振り返ろう
        </CardTitle>
        <CardDescription className="text-center text-blue-200/60 break-keep leading-relaxed text-sm sm:text-base">
          ハンドルネームとアプリパスワードを入力して、<br className="hidden sm:block"/>2025年の活動を確認しましょう。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-blue-100">ハンドルネーム</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-2.5 h-5 w-5 text-blue-300/50" />
                      <Input 
                        placeholder="alice.bsky.social" 
                        {...field} 
                        className="pl-10 bg-black/20 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-blue-500"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-blue-100">アプリパスワード</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-5 w-5 text-blue-300/50" />
                      <Input 
                        type="password" 
                        placeholder="xxxx-xxxx-xxxx-xxxx" 
                        {...field} 
                        className="pl-10 bg-black/20 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-blue-500"
                      />
                    </div>
                  </FormControl>
                  <div className="text-xs text-blue-200/50 mt-1">
                    設定 &gt; プライバシーとセキュリティ &gt; アプリパスワード
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 font-medium h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  認証中...
                </>
              ) : (
                "2025年の活動を見る"
              )}
            </Button>
            <p className="mt-3 text-[11px] leading-relaxed text-blue-200/50 text-left">
              解析結果の画面からボタンを押すと、あなたの PDS に
              <span className="font-mono"> net.shino3.yearsummary2025.wrap/2025 </span>
              として今年一年のサマリーを保存し、結果を Bluesky に 1 件投稿できます。
              投稿内容には <span className="font-mono">bsky-summary2025.shino3.net</span> へのリンクが含まれます。
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
