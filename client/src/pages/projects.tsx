import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { type Project } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Home, FolderKanban, Plus, ChevronRight } from "lucide-react";

export default function ProjectList() {
  const [, setLocation] = useLocation();
  const [showDeleted, setShowDeleted] = useState(false);

  // プロジェクト一覧を取得
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: [`/api/projects${showDeleted ? '?includeDeleted=true' : ''}`],
    staleTime: 1000 * 60, // 1分間キャッシュ
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/">
                    <Home className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <span className="flex items-center gap-1">
                    <FolderKanban className="h-3.5 w-3.5" />
                    プロジェクト一覧
                  </span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <ThemeToggle />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              id="showDeleted"
              checked={showDeleted}
              onCheckedChange={setShowDeleted}
            />
            <Label htmlFor="showDeleted">削除済みプロジェクトを表示</Label>
          </div>
          
          <Button onClick={() => setLocation('/project/new')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> 新規プロジェクト
          </Button>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className={`
                  overflow-hidden transition-all duration-300 hover:shadow-md
                  ${project.isDeleted ? 'opacity-60 border-dashed' : ''}
                `}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-bold line-clamp-2 break-all">
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold mb-1">プロジェクト概要</h4>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {project.overview || "未設定"}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Link href={`/project/${project.id}`} className="w-full">
                    <Button variant="default" className="w-full flex items-center justify-center gap-1">
                      詳細を見る <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-lg text-muted-foreground mb-4">プロジェクトがありません</p>
            <Button onClick={() => setLocation('/project/new')}>
              新規プロジェクトを作成
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}