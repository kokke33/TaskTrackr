import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  CommandDialog, 
  CommandInput, 
  CommandList, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem 
} from "@/components/ui/command";

import { apiRequest } from "@/lib/queryClient";
import { useCustomEvent } from "../hooks/use-custom-event";

type SearchSuggestion = {
  id: number;
  type: 'project' | 'case' | 'report';
  title: string;
  description?: string;
  link: string;
};

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [location, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 検索ページとの連携のためのカスタムイベント
  const dispatchSearchEvent = useCustomEvent<string>("global-search");
  useCustomEvent<string>("update-search-bar", (newQuery) => {
    if (newQuery !== query) {
      setQuery(newQuery);
    }
  });

  // コマンドダイアログのトリガー
  const toggleSearch = () => {
    setIsOpen(!isOpen);
    // ダイアログを閉じる場合のみクエリをクリア
    if (isOpen) {
      setQuery("");
      setSuggestions([]);
    }
  };

  // 検索バーからの直接検索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
      setIsOpen(false);
    }
  };

  // コマンドダイアログから検索
  const handleCommandSearch = () => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery("");
      setIsOpen(false);
    }
  };

  // サジェスト結果を選択
  const handleSelectSuggestion = (link: string) => {
    navigate(link);
    setIsOpen(false);
    setQuery("");
  };

  // 古いリスナーコードは上部の新しいリスナーに置き換えました
  
  // 検索クエリの変更を検出してサジェストを取得
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const results = await apiRequest<SearchSuggestion[]>(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
          method: "GET"
        });
        setSuggestions(results);
      } catch (error) {
        console.error("サジェスト取得エラー:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    // 入力から少し遅延させてAPIリクエストを行う（タイピング中の過剰なリクエストを防ぐ）
    const timer = setTimeout(() => {
      fetchSuggestions();
      
      // 検索ページにいるときは、現在のクエリを検索ページに送信
      if (location.startsWith('/search')) {
        dispatchSearchEvent(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, location, dispatchSearchEvent]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K または Command+K でダイアログを開く
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggleSearch();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* ヘッダーの検索バー */}
      <form onSubmit={handleSearch} className="hidden md:flex items-center relative max-w-md">
        <div className="relative w-60">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="プロジェクト、案件、報告を検索..."
            className="w-full pl-8 pr-9"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
          />
          <Button type="submit" variant="ghost" size="sm" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* モバイル用の検索ボタン */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSearch}>
        <Search className="h-5 w-5" />
      </Button>

      {/* コマンドダイアログ（検索モーダル） */}
      <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
        {/* アクセシビリティは親コンポーネントで対応 */}
        <CommandInput
          placeholder="プロジェクト、案件、報告を検索..."
          value={query}
          onValueChange={setQuery}
          ref={inputRef}
          aria-label="検索入力"
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? "検索中..." : "該当する結果が見つかりません"}
          </CommandEmpty>

          {suggestions.length > 0 && (
            <CommandGroup heading="検索候補">
              {suggestions.map((item) => (
                <CommandItem
                  key={`${item.type}-${item.id}`}
                  onSelect={() => handleSelectSuggestion(item.link)}
                >
                  <div className="flex items-center">
                    {item.type === 'project' && <span className="mr-2 text-blue-500">📂</span>}
                    {item.type === 'case' && <span className="mr-2 text-green-500">📋</span>}
                    {item.type === 'report' && <span className="mr-2 text-yellow-500">📝</span>}
                    <div>
                      <div className="font-medium">{item.title}</div>
                      {item.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup>
            <CommandItem onSelect={handleCommandSearch}>
              <Search className="mr-2 h-4 w-4" />
              <span>「{query}」で検索する</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}