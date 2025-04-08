import { CodeAnalyzer } from './interface';
import { PRDiff, ReviewResult, ReviewIssue, ReviewComment } from '../github/types';
import { logger } from '../utils/logger';

/**
 * 模拟代码分析器
 * 返回预设的代码审查结果，用于测试和开发
 */
export class MockCodeAnalyzer implements CodeAnalyzer {
  /**
   * 分析PR差异并生成模拟审查结果
   * 
   * @param diffs PR差异信息
   * @returns 模拟的审查结果
   */
  async analyze(diffs: PRDiff[]): Promise<ReviewResult> {
    logger.info(`模拟分析器开始分析 ${diffs.length} 个文件`);
    
    const issues: ReviewIssue[] = [];
    const comments: ReviewComment[] = [];
    
    // 如果没有提供diff或diff为空数组，使用模拟数据
    if (!diffs || diffs.length === 0) {
      logger.info('没有真实的diff数据，使用模拟数据');
      return this.generateMockResult();
    }
    
    // 为每个文件生成一些模拟问题和评论
    diffs.forEach(diff => {
      logger.debug(`分析文件: ${diff.filename}`);
      
      // 根据文件类型生成不同的模拟问题
      if (diff.filename.endsWith('.ts') || diff.filename.endsWith('.js')) {
        // TypeScript/JavaScript文件的模拟问题
        this.generateJsIssues(diff, issues, comments);
      } else if (diff.filename.endsWith('.css') || diff.filename.endsWith('.scss')) {
        // CSS文件的模拟问题
        this.generateCssIssues(diff, issues, comments);
      } else if (diff.filename.endsWith('.md') || diff.filename.endsWith('.txt')) {
        // 文档文件的模拟问题
        this.generateDocIssues(diff, issues, comments);
      }
      
      // 添加一条通用评论
      comments.push({
        path: diff.filename,
        body: `已审查文件 \`${diff.filename}\`，有 ${diff.additions} 行添加和 ${diff.deletions} 行删除。`
      });
    });
    
    // 生成审查摘要
    const summary = this.generateSummary(diffs, issues);
    
    logger.info(`模拟分析完成，生成了 ${issues.length} 个问题和 ${comments.length} 个评论`);
    
    return {
      issues,
      comments,
      summary
    };
  }
  
  /**
   * 生成完全模拟的审查结果，用于测试
   */
  private generateMockResult(): ReviewResult {
    const mockDiffs: PRDiff[] = [
      {
        filename: 'src/example.ts',
        additions: 15,
        deletions: 5,
        changes: 20,
        status: 'modified'
      },
      {
        filename: 'styles/main.css',
        additions: 10,
        deletions: 2,
        changes: 12,
        status: 'modified'
      },
      {
        filename: 'README.md',
        additions: 8,
        deletions: 0,
        changes: 8,
        status: 'modified'
      }
    ];
    
    const issues: ReviewIssue[] = [];
    const comments: ReviewComment[] = [];
    
    // 为模拟文件生成问题和评论
    mockDiffs.forEach(diff => {
      if (diff.filename.endsWith('.ts')) {
        this.generateJsIssues(diff, issues, comments);
      } else if (diff.filename.endsWith('.css')) {
        this.generateCssIssues(diff, issues, comments);
      } else if (diff.filename.endsWith('.md')) {
        this.generateDocIssues(diff, issues, comments);
      }
      
      comments.push({
        path: diff.filename,
        body: `已审查文件 \`${diff.filename}\`，有 ${diff.additions} 行添加和 ${diff.deletions} 行删除。`
      });
    });
    
    const summary = this.generateSummary(mockDiffs, issues);
    
    logger.info(`生成了完全模拟的审查结果: ${issues.length} 个问题和 ${comments.length} 个评论`);
    
    return {
      issues,
      comments,
      summary
    };
  }
  
  /**
   * 为JavaScript/TypeScript文件生成模拟问题
   */
  private generateJsIssues(diff: PRDiff, issues: ReviewIssue[], comments: ReviewComment[]): void {
    // 模拟几种常见的JavaScript/TypeScript问题
    issues.push({
      type: 'style',
      severity: 'low',
      message: '变量命名应使用驼峰式命名法',
      suggestion: '将变量重命名为符合驼峰式命名规范的名称',
      file: diff.filename,
      line: 10 // 模拟行号
    });
    
    issues.push({
      type: 'performance',
      severity: 'medium',
      message: '检测到可能的性能问题，避免在循环中使用高耗时操作',
      suggestion: '考虑将操作移出循环或使用更高效的方法',
      file: diff.filename,
      line: 25 // 模拟行号
    });
    
    comments.push({
      path: diff.filename,
      position: 10, // 模拟行号
      body: '**建议**: 这里的变量命名不符合项目的驼峰式命名规范，应该重命名。'
    });
    
    comments.push({
      path: diff.filename,
      position: 25, // 模拟行号
      body: '**性能问题**: 在循环中执行这种操作可能导致性能下降，建议优化此处代码。'
    });
  }
  
  /**
   * 为CSS文件生成模拟问题
   */
  private generateCssIssues(diff: PRDiff, issues: ReviewIssue[], comments: ReviewComment[]): void {
    issues.push({
      type: 'style',
      severity: 'low',
      message: 'CSS选择器过于具体，可能导致维护困难',
      suggestion: '使用更简洁的选择器或考虑使用类选择器',
      file: diff.filename,
      line: 15 // 模拟行号
    });
    
    comments.push({
      path: diff.filename,
      position: 15, // 模拟行号
      body: '**CSS建议**: 这个选择器过于复杂，考虑简化以提高可维护性。'
    });
  }
  
  /**
   * 为文档文件生成模拟问题
   */
  private generateDocIssues(diff: PRDiff, issues: ReviewIssue[], comments: ReviewComment[]): void {
    issues.push({
      type: 'improvement',
      severity: 'low',
      message: '文档可以添加更多示例说明',
      suggestion: '考虑添加使用示例以提高文档质量',
      file: diff.filename
    });
    
    comments.push({
      path: diff.filename,
      body: '**文档建议**: 这份文档可以通过添加更多的使用示例来提高其质量。'
    });
  }
  
  /**
   * 生成审查摘要
   */
  private generateSummary(diffs: PRDiff[], issues: ReviewIssue[]): string {
    const totalAdditions = diffs.reduce((sum, diff) => sum + diff.additions, 0);
    const totalDeletions = diffs.reduce((sum, diff) => sum + diff.deletions, 0);
    
    const highSeverityCount = issues.filter(issue => issue.severity === 'high').length;
    const mediumSeverityCount = issues.filter(issue => issue.severity === 'medium').length;
    const lowSeverityCount = issues.filter(issue => issue.severity === 'low').length;
    
    return `
# 代码审查摘要

审查了 ${diffs.length} 个文件，共有 ${totalAdditions} 行添加和 ${totalDeletions} 行删除。

## 发现的问题

- 高严重性问题: ${highSeverityCount}
- 中等严重性问题: ${mediumSeverityCount}
- 低严重性问题: ${lowSeverityCount}

## 总体评价

这是一个模拟的代码审查报告，用于测试和演示目的。在实际实现中，这里将包含基于真实分析的评价。

## 建议

- 修复所有高严重性问题
- 考虑解决中等严重性问题
- 低严重性问题可以在未来的迭代中解决
`;
  }
} 