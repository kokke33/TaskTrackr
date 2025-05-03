import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { Home, Search, FileText, Briefcase, FolderOpen, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useCustomEvent } from "../hooks/use-custom-event";

// 検索結果の型定義
type SearchResult = {
  id: number;
  type: 'project' | 'case' | 'report';
  title: string;
  description: string;
  content?: string;
  projectName?: string;
  caseName?: string;
  date?: string;
  match?: {
    field: string;
    text: string;
    highlight: [number, number][];
  }[];
  link: string;
};

export default function SearchPage() {
  const [location] = useLocation();
  const [searchParams, setSearchParams] = useState(new URLSearchParams(window.location.search));
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  
  // ヘッダー検索バーとの連携のためのカスタムイベント
  const updateSearchBar = useCustomEvent<string>("update-search-bar");
  
  // ヘッダー検索バーからのイベントをリッスン（useEffectでラップしてクリーンアップを追加）
  useEffect(() => {
    const listener = (searchQuery: string) => {
      if (searchQuery !== searchInput) {
        setSearchInput(searchQuery);
        setQuery(searchQuery);
      }
    };
    
    // リスナーを登録
    const dispatchSearchEvent = useCustomEvent<string>("global-search");
    const cleanup = dispatchSearchEvent.on(listener);
    
    // クリーンアップ
    return () => cleanup();
  }, [searchInput]);

  // URLが変更されたときにクエリパラメータを更新
  useEffect(() => {
    const newParams = new URLSearchParams(window.location.search);
    const queryParam = newParams.get("q") || "";
    setSearchParams(newParams);
    setQuery(queryParam);
    setSearchInput(queryParam);
    
    // ヘッダー検索バーにも検索クエリを反映
    if (queryParam) {
      updateSearchBar(queryParam);
    }
  }, [location, updateSearchBar]);

  // 検索APIを呼び出す
  const { data: searchResults, isLoading, error } = useQuery<{
    total: number;
    results: SearchResult[];
  }>({
    queryKey: [`/api/search?q=${query}${activeTab !== "all" ? `&type=${activeTab}` : ""}`],
    queryFn: async () => {
      if (!query) return { total: 0, results: [] };
      return apiRequest<{ total: number; results: SearchResult[] }>(
        `/api/search?q=${encodeURIComponent(query)}${activeTab !== "all" ? `&type=${activeTab}` : ""}`,
        { method: "GET" }
      );
    },
    enabled: !!query,
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ
  });

  // 検索フォームの送信処理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.history.pushState(
        {},
        "",
        `/search?q=${encodeURIComponent(searchInput.trim())}`
      );
      setQuery(searchInput.trim());
      
      // ヘッダーの検索バーも更新
      updateSearchBar(searchInput.trim());
    }
  };

  // 検索入力のハンドラ（リアルタイム検索）
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    
    // 少なくとも2文字以上入力された場合、リアルタイム検索を実行
    if (value.trim().length >= 2) {
      // URLを更新せずに検索クエリを更新（リアルタイム検索用）
      setQuery(value.trim());
      
      // ヘッダーの検索バーにも検索値を反映
      updateSearchBar(value.trim());
    }
  };

  // 検索結果のタイプごとの数をカウント
  const resultCounts = {
    all: searchResults?.total || 0,
    project: searchResults?.results.filter(r => r.type === 'project').length || 0,
    case: searchResults?.results.filter(r => r.type === 'case').length || 0,
    report: searchResults?.results.filter(r => r.type === 'report').length || 0,
  };

  // 一致部分をハイライトするヘルパー関数
  const highlightMatches = (text: string, highlights: [number, number][]) => {
    if (!highlights || highlights.length === 0) return text;

    let result = [];
    let lastIndex = 0;

    highlights.forEach(([start, end]) => {
      // ハイライト前のテキスト
      if (start > lastIndex) {
        result.push(text.substring(lastIndex, start));
      }
      
      // ハイライト部分
      result.push(
        <mark key={`${start}-${end}`} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {text.substring(start, end)}
        </mark>
      );
      
      lastIndex = end;
    });

    // 残りのテキスト
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result;
  };

  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle />

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-4">検索結果</h1>
          
          {/* パンくずリスト */}
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">
                    <span className="flex items-center gap-1">
                      <Home className="h-3.5 w-3.5" />
                      ホーム
                    </span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              
              <BreadcrumbSeparator />
              
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <span className="flex items-center gap-1">
                    <Search className="h-3.5 w-3.5" />
                    検索結果 {query ? `「${query}」` : ""}
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* 検索フォーム */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="プロジェクト、案件、報告を検索..."
                  className="pl-10"
                  value={searchInput}
                  onChange={handleSearchInputChange}
                />
              </div>
              <Button type="submit">検索</Button>
            </div>
          </form>

          {/* タブナビゲーション */}
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">
                すべて ({resultCounts.all})
              </TabsTrigger>
              <TabsTrigger value="project">
                プロジェクト ({resultCounts.project})
              </TabsTrigger>
              <TabsTrigger value="case">
                案件 ({resultCounts.case})
              </TabsTrigger>
              <TabsTrigger value="report">
                週次報告 ({resultCounts.report})
              </TabsTrigger>
            </TabsList>

            {/* 検索結果 */}
            <div className="mt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">検索中...</span>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  検索中にエラーが発生しました。再度お試しください。
                </div>
              ) : searchResults?.results && searchResults.results.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchResults.total}件の検索結果
                  </p>

                  {searchResults.results
                    .filter(result => activeTab === "all" || result.type === activeTab)
                    .map((result) => (
                      <Card key={`${result.type}-${result.id}`} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex-shrink-0">
                              {result.type === "project" && (
                                <FolderOpen className="h-5 w-5 text-blue-500" />
                              )}
                              {result.type === "case" && (
                                <Briefcase className="h-5 w-5 text-green-500" />
                              )}
                              {result.type === "report" && (
                                <FileText className="h-5 w-5 text-yellow-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <Link href={result.link}>
                                <a className="block">
                                  <h3 className="text-lg font-medium hover:text-primary hover:underline">
                                    {result.title}
                                  </h3>
                                </a>
                              </Link>
                              
                              <div className="text-sm text-muted-foreground mt-1">
                                {result.type === "project" && "プロジェクト"}
                                {result.type === "case" && (
                                  <>案件 / {result.projectName}</>
                                )}
                                {result.type === "report" && (
                                  <>
                                    週次報告 / {result.projectName} / {result.caseName}{" "}
                                    {result.date && `(${result.date})`}
                                  </>
                                )}
                              </div>
                              
                              {result.match && result.match.length > 0 && (
                                <div className="mt-2 text-sm border-l-2 border-primary/50 pl-3 py-1">
                                  {result.match.map((m, idx) => (
                                    <div key={idx} className="mb-1 last:mb-0">
                                      <span className="text-xs text-muted-foreground mr-1">
                                        {m.field === "title" && "タイトル:"}
                                        {m.field === "description" && "説明:"}
                                        {m.field === "content" && "内容:"}
                                        {m.field === "milestone" && "マイルストーン:"}
                                      </span>
                                      <span>
                                        {highlightMatches(m.text, m.highlight)}...
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              ) : query ? (
                <div className="text-center py-12">
                  <p className="text-lg mb-2">「{query}」に一致する結果は見つかりませんでした。</p>
                  <p className="text-muted-foreground">検索語を変えて、もう一度お試しください。</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-lg">検索キーワードを入力してください。</p>
                </div>
              )}
            </div>
          </Tabs>
        </header>
      </div>
    </div>
  );
}