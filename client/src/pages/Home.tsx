import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClipboardEdit, List } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">週次報告</h1>
          <p className="text-muted-foreground mb-8">
            ss7-1
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/report/new">
              <Button
                variant="outline"
                className="w-full h-32 text-left flex flex-col items-center justify-center gap-2"
              >
                <ClipboardEdit className="h-8 w-8" />
                <div>
                  <div className="font-semibold">新規報告作成</div>
                  <div className="text-sm text-muted-foreground">週次報告を入力する</div>
                </div>
              </Button>
            </Link>

            <Link href="/reports">
              <Button
                variant="outline"
                className="w-full h-32 text-left flex flex-col items-center justify-center gap-2"
              >
                <List className="h-8 w-8" />
                <div>
                  <div className="font-semibold">報告一覧</div>
                  <div className="text-sm text-muted-foreground">提出済みの報告を確認する</div>
                </div>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
