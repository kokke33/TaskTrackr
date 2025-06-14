import { useState, useMemo, useEffect } from "react";
import { Search, Building2, FolderOpen, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Case } from "@shared/schema";

interface CaseSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (case_: Case) => void;
  cases: Case[];
  selectedCaseId?: number;
}

// LocalStorageから最近使用した案件IDを取得
function getRecentCaseIds(): number[] {
  try {
    const recent = localStorage.getItem('recentCases');
    return recent ? JSON.parse(recent) : [];
  } catch {
    return [];
  }
}

// LocalStorageに最近使用した案件IDを保存
function saveRecentCaseId(caseId: number) {
  try {
    const recent = getRecentCaseIds();
    const updated = [caseId, ...recent.filter(id => id !== caseId)].slice(0, 10); // 最大10件
    localStorage.setItem('recentCases', JSON.stringify(updated));
  } catch {
    // エラーは無視
  }
}

export default function CaseSelectorModal({
  isOpen,
  onClose,
  onSelect,
  cases,
  selectedCaseId
}: CaseSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("recent");
  const [showFilters, setShowFilters] = useState(false);
  const [milestoneFilter, setMilestoneFilter] = useState<string>("");

  // 検索入力時の自動フォーカス
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const searchInput = document.querySelector('[placeholder*="検索"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // プロジェクトをグループ化
  const groupedCases = useMemo(() => {
    return cases.reduce((acc, case_) => {
      const projectName = case_.projectName;
      if (!acc[projectName]) {
        acc[projectName] = [];
      }
      acc[projectName].push(case_);
      return acc;
    }, {} as Record<string, Case[]>);
  }, [cases]);

  // 最近使用した案件を取得
  const recentCases = useMemo(() => {
    const recentIds = getRecentCaseIds();
    return recentIds
      .map(id => cases.find(case_ => case_.id === id))
      .filter(Boolean) as Case[];
  }, [cases]);

  // 利用可能なマイルストーン一覧
  const availableMilestones = useMemo(() => {
    const milestones = new Set<string>();
    cases.forEach(case_ => {
      if (case_.milestone && case_.milestone.trim()) {
        milestones.add(case_.milestone);
      }
    });
    return Array.from(milestones).sort();
  }, [cases]);

  // 検索でフィルタリングされた案件
  const filteredCases = useMemo(() => {
    let filtered = cases;
    
    // 検索クエリでフィルタリング
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(case_ => 
        case_.caseName.toLowerCase().includes(query) ||
        case_.projectName.toLowerCase().includes(query) ||
        (case_.description && case_.description.toLowerCase().includes(query))
      );
    }
    
    // マイルストーンでフィルタリング
    if (milestoneFilter) {
      filtered = filtered.filter(case_ => case_.milestone === milestoneFilter);
    }
    
    return filtered;
  }, [cases, searchQuery, milestoneFilter]);

  // 検索でフィルタリングされたプロジェクト
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return Object.keys(groupedCases);
    
    const query = searchQuery.toLowerCase();
    return Object.keys(groupedCases).filter(projectName =>
      projectName.toLowerCase().includes(query) ||
      groupedCases[projectName].some(case_ =>
        case_.caseName.toLowerCase().includes(query) ||
        (case_.description && case_.description.toLowerCase().includes(query))
      )
    );
  }, [groupedCases, searchQuery]);

  const handleCaseSelect = (case_: Case) => {
    saveRecentCaseId(case_.id);
    onSelect(case_);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedProject(null);
    setActiveTab("recent");
    setShowFilters(false);
    setMilestoneFilter("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>案件を選択</DialogTitle>
          <DialogDescription>
            プロジェクトまたは案件名で検索して選択してください
          </DialogDescription>
        </DialogHeader>

        {/* 検索バーとフィルター */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="プロジェクト名または案件名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-blue-50 border-blue-200" : ""}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          
          {/* フィルターオプション */}
          {showFilters && (
            <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  マイルストーン
                </label>
                <select
                  value={milestoneFilter}
                  onChange={(e) => setMilestoneFilter(e.target.value)}
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全て</option>
                  {availableMilestones.map(milestone => (
                    <option key={milestone} value={milestone}>
                      {milestone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMilestoneFilter("");
                  }}
                >
                  クリア
                </Button>
              </div>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">
              <Clock className="h-4 w-4 mr-2" />
              最近使用
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Building2 className="h-4 w-4 mr-2" />
              プロジェクト別
            </TabsTrigger>
            <TabsTrigger value="all">
              <FolderOpen className="h-4 w-4 mr-2" />
              全ての案件
            </TabsTrigger>
          </TabsList>

          {/* 最近使用した案件 */}
          <TabsContent value="recent" className="flex-1">
            <ScrollArea className="h-[400px]">
              {recentCases.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  最近使用した案件がありません
                </div>
              ) : (
                <div className="space-y-2">
                  {recentCases
                    .filter(case_ => {
                      // 検索クエリフィルター
                      const matchesSearch = !searchQuery || 
                        case_.caseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        case_.projectName.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      // マイルストーンフィルター
                      const matchesMilestone = !milestoneFilter || case_.milestone === milestoneFilter;
                      
                      return matchesSearch && matchesMilestone;
                    })
                    .map((case_) => (
                    <div
                      key={case_.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedCaseId === case_.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => handleCaseSelect(case_)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{case_.caseName}</div>
                          <div className="text-sm text-gray-600">{case_.projectName}</div>
                          {case_.description && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {case_.description}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary">最近使用</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* プロジェクト別表示 */}
          <TabsContent value="projects" className="flex-1 flex">
            <div className="flex h-[400px] w-full">
              {/* プロジェクト一覧 */}
              <div className="w-1/3 border-r">
                <div className="p-2 border-b font-medium text-sm">プロジェクト</div>
                <ScrollArea className="h-[360px]">
                  <div className="space-y-1 p-2">
                    {filteredProjects.map((projectName) => (
                      <div
                        key={projectName}
                        className={`p-2 rounded cursor-pointer text-sm hover:bg-gray-100 transition-colors ${
                          selectedProject === projectName ? 'bg-blue-100 text-blue-700' : ''
                        }`}
                        onClick={() => setSelectedProject(projectName)}
                      >
                        <div className="font-medium">{projectName}</div>
                        <div className="text-xs text-gray-500">
                          {groupedCases[projectName].length}件の案件
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* 案件一覧 */}
              <div className="w-2/3">
                <div className="p-2 border-b font-medium text-sm">
                  {selectedProject ? `${selectedProject}の案件` : '案件を表示するにはプロジェクトを選択してください'}
                </div>
                <ScrollArea className="h-[360px]">
                  {selectedProject ? (
                    <div className="space-y-2 p-2">
                      {groupedCases[selectedProject]
                        .filter(case_ => {
                          // 検索クエリフィルター
                          const matchesSearch = !searchQuery || 
                            case_.caseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (case_.description && case_.description.toLowerCase().includes(searchQuery.toLowerCase()));
                          
                          // マイルストーンフィルター
                          const matchesMilestone = !milestoneFilter || case_.milestone === milestoneFilter;
                          
                          return matchesSearch && matchesMilestone;
                        })
                        .map((case_) => (
                        <div
                          key={case_.id}
                          className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                            selectedCaseId === case_.id ? 'border-blue-500 bg-blue-50' : ''
                          }`}
                          onClick={() => handleCaseSelect(case_)}
                        >
                          <div className="font-medium">{case_.caseName}</div>
                          {case_.description && (
                            <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {case_.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      左側からプロジェクトを選択してください
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* 全ての案件 */}
          <TabsContent value="all" className="flex-1">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredCases.map((case_) => (
                  <div
                    key={case_.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedCaseId === case_.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => handleCaseSelect(case_)}
                  >
                    <div>
                      <div className="font-medium">{case_.caseName}</div>
                      <div className="text-sm text-gray-600">{case_.projectName}</div>
                      {case_.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {case_.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}