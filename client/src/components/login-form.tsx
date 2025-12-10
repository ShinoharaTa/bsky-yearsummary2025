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
  identifier: z.string().min(1, "ハンドルネームまたはメールアドレスを入力してください"),
  password: z.string().min(1, "アプリパスワードを入力してください"),
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
        title: "ログインできませんでした",
        description: "アプリパスワードが正しいかご確認ください（通常のパスワードは使用できません）。",
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
          2025年の足あとを振り返ろう
        </CardTitle>
        <CardDescription className="text-center text-blue-200/70 break-keep leading-relaxed text-sm sm:text-base">
          ハンドルネームとアプリパスワードを入力するだけで、<br className="hidden sm:block" />
          あなたの1年を可視化したグラフを作成します。
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
                        placeholder="例: alice.bsky.social" 
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
                        placeholder="例: xxxx-xxxx-xxxx-xxxx" 
                        {...field} 
                        className="pl-10 bg-black/20 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-blue-500"
                      />
                    </div>
                  </FormControl>
                  <div className="text-xs text-blue-200/60 mt-1">
                    ⚠️ 必ず「アプリパスワード」を使用してください。
                    <br className="hidden sm:block" />
                    普段のログイン用パスワードは絶対に入力しないでください。
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
                  集計しています…
                </>
              ) : (
                "2025年のまとめを作る"
              )}
            </Button>
            <p className="mt-3 text-[11px] leading-relaxed text-blue-200/60 text-left">
              作成されたまとめは、1タップでBlueskyにシェアできます。
              <br className="hidden sm:block" />
              ログイン情報は保存されませんのでご安心ください。
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
