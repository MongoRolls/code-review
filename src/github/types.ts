// PR差异信息
export interface PRDiff {
  filename: string;
  patch?: string;  // 差异内容，可能为空
  additions: number;
  deletions: number;
  changes: number;
  status: string;  // 文件状态: added, modified, removed等
}

// 代码审查评论
export interface ReviewComment {
  path: string;      // 文件路径
  position?: number; // 行号，可选（可能是整个文件的评论）
  body: string;      // 评论内容
}

// 审查问题
export interface ReviewIssue {
  type: 'style' | 'performance' | 'security' | 'bug' | 'improvement';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
  line?: number;
  file: string;
}

// 审查结果
export interface ReviewResult {
  comments: ReviewComment[];  // 按文件和行的具体评论
  issues: ReviewIssue[];      // 发现的问题列表
  summary: string;            // 总体评价
} 