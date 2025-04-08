import { PRDiff, ReviewResult, ReviewIssue, ReviewComment } from '../github/types';
import { logger } from '../utils/logger';
import { CodeAnalyzer } from './interface';

/**
 * 模拟代码分析器
 * 用于提供基本的代码审查功能，不依赖外部服务
 * 主要用于测试和演示目的
 */
export class MockCodeAnalyzer implements CodeAnalyzer {
  /**
   * 分析PR差异并返回审查结果
   * @param diffs PR差异信息
   */
  async analyze(diffs: PRDiff[]): Promise<ReviewResult> {
    logger.info(`模拟分析器开始分析 ${diffs.length} 个文件`);
    
    // 初始化结果对象
    const issues: ReviewIssue[] = [];
    const comments: ReviewComment[] = [];
    
    if (!diffs || diffs.length === 0) {
      logger.info('没有差异需要分析');
      return {
        comments: [],
        issues: [],
        summary: '没有发现差异需要分析'
      };
    }
    
    // 遍历每个文件差异，生成模拟的审查结果
    diffs.forEach(diff => {
      logger.debug(`分析文件: ${diff.filename}`);
      
      // 根据文件类型生成不同的模拟问题
      if (diff.filename.endsWith('.js') || diff.filename.endsWith('.ts')) {
        // 对JavaScript/TypeScript文件的模拟分析
        this.addJsIssue(diff, issues, comments);
      } else if (diff.filename.endsWith('.css')) {
        // 对CSS文件的模拟分析
        this.addCssIssue(diff, issues, comments);
      } else if (diff.filename.endsWith('.md') || diff.filename.endsWith('.txt')) {
        // 对文档文件的模拟分析
        this.addDocIssue(diff, issues, comments);
      }
    });
    
    // 生成审查摘要
    const summary = this.generateSummary(diffs, issues);
    
    logger.info(`模拟分析完成，生成了 ${issues.length} 个问题和 ${comments.length} 个评论`);
    
    return {
      comments,
      issues,
      summary
    };
  }
  
  /**
   * 为JS/TS文件添加模拟问题
   */
  private addJsIssue(diff: PRDiff, issues: ReviewIssue[], comments: ReviewComment[]): void {
    // 添加一个性能相关的模拟问题
    issues.push({
      type: 'performance',
      severity: 'medium',
      message: '检测到可能的性能问题，避免在循环中使用高耗时操作',
      file: diff.filename
    });
    
    // 添加对应的评论
    comments.push({
      path: diff.filename,
      body: '**性能建议**: 考虑将高耗时操作移出循环，或使用缓存来优化性能。'
    });
  }
  
  /**
   * 为CSS文件添加模拟问题
   */
  private addCssIssue(diff: PRDiff, issues: ReviewIssue[], comments: ReviewComment[]): void {
    // 添加一个样式相关的模拟问题
    issues.push({
      type: 'style',
      severity: 'low',
      message: 'CSS选择器过于具体，可能导致维护困难',
      file: diff.filename
    });
    
    // 添加对应的评论
    comments.push({
      path: diff.filename,
      body: '**样式建议**: 考虑使用更简洁的CSS选择器，避免过度依赖DOM结构。'
    });
  }
  
  /**
   * 为文档文件添加模拟问题
   */
  private addDocIssue(diff: PRDiff, issues: ReviewIssue[], comments: ReviewComment[]): void {
    // 添加一个文档改进的模拟问题
    issues.push({
      type: 'improvement',
      severity: 'low',
      message: '文档可以添加更多示例说明',
      file: diff.filename
    });
    
    // 添加对应的评论
    comments.push({
      path: diff.filename,
      body: '**文档建议**: 考虑添加具体的使用示例，帮助用户更好地理解。'
    });
  }
  
  /**
   * 生成审查摘要
   */
  private generateSummary(diffs: PRDiff[], issues: ReviewIssue[]): string {
    const totalAdditions = diffs.reduce((sum, diff) => sum + diff.additions, 0);
    const totalDeletions = diffs.reduce((sum, diff) => sum + diff.deletions, 0);
    
    const highSeverityCount = issues.filter(i => i.severity === 'high').length;
    const mediumSeverityCount = issues.filter(i => i.severity === 'medium').length;
    const lowSeverityCount = issues.filter(i => i.severity === 'low').length;
    
    return `# 代码审查摘要

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
- 低严重性问题可以在未来的迭代中解决`;
  }
} 