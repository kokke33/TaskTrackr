import React, { useState, useRef, useEffect } from "react";
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
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

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
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

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
        <Input
          type="text"
          placeholder="プロジェクト、案件、報告を検索..."
          className="w-60 pl-8"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
        />
        <Search className="h-4 w-4 absolute left-2.5 text-muted-foreground" />
        <Button type="submit" variant="ghost" size="sm" className="absolute right-1">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {/* モバイル用の検索ボタン */}
      <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSearch}>
        <Search className="h-5 w-5" />
      </Button>

      {/* コマンドダイアログ（検索モーダル） */}
      <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
        <CommandInput
          placeholder="プロジェクト、案件、報告を検索..."
          value={query}
          onValueChange={setQuery}
          ref={inputRef}
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