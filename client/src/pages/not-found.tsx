import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">
              ページが見つかりません
            </h1>
          </div>

          <p className="mt-2 text-sm text-gray-600">
            お探しのページは削除されたか、URLが間違っている可能性があります。
          </p>

          <div className="mt-6">
            <Link href="/">
              <Button className="w-full" variant="secondary">
                トップページへ戻る
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
