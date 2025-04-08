import { Reporter } from './interface';
import { ReviewResult, ReviewIssue } from '../github/types';
import { GitHubClient } from '../github/client';
import { logger } from '../utils/logger';

/**
 * GitHub评论报告生成器
 * 将审查结果作为评论提交到GitHub PR上
 */
export class GitHubCommentReporter implements Reporter {
  private githubClient: GitHubClient;
  
  constructor(githubClient: GitHubClient) {
    this.githubClient = githubClient;
    logger.info('初始化GitHub评论报告生成器');
  }
  
  /**
   * 提交审查结果到GitHub PR
   * 
   * @param result 审查结果
   */
  async submit(result: ReviewResult): Promise<void> {
    logger.info('开始提交审查结果');
    
    try {
      // 1. 提交总体评论（摘要）
      await this.submitSummaryComment(result);
      
      // 2. 提交文件级别评论
      if (result.comments.length > 0) {
        await this.githubClient.createPRReviewComment(result.comments);
      }
      
      logger.info('审查结果提交完成');
    } catch (error) {
      logger.error('提交审查结果失败:', error);
      throw new Error(`提交审查结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 提交总体评论（包含摘要和高级别问题）
   */
  private async submitSummaryComment(result: ReviewResult): Promise<void> {
    // 构建评论正文
    const commentBody = this.formatSummaryComment(result);
    
    // 提交评论
    await this.githubClient.createPRComment(commentBody);
    logger.info('已提交总体评论');
  }
  
  /**
   * 格式化总体评论
   */
  private formatSummaryComment(result: ReviewResult): string {
    // 使用结果中的摘要作为基础
    let comment = result.summary;
    
    // 添加问题详情部分（如果有问题）
    if (result.issues.length > 0) {
      comment += '\n\n## 详细问题\n\n';
      
      // 按严重性分组问题
      const highIssues = result.issues.filter(issue => issue.severity === 'high');
      const mediumIssues = result.issues.filter(issue => issue.severity === 'medium');
      const lowIssues = result.issues.filter(issue => issue.severity === 'low');
      
      // 添加高严重性问题
      if (highIssues.length > 0) {
        comment += '### 高严重性问题\n\n';
        comment += this.formatIssueList(highIssues);
      }
      
      // 添加中等严重性问题
      if (mediumIssues.length > 0) {
        comment += '### 中等严重性问题\n\n';
        comment += this.formatIssueList(mediumIssues);
      }
      
      // 添加低严重性问题
      if (lowIssues.length > 0) {
        comment += '### 低严重性问题\n\n';
        comment += this.formatIssueList(lowIssues);
      }
    }
    
    // 添加页脚
    comment += '\n\n---\n*此评论由自动代码审查工具生成*';
    
    return comment;
  }
  
  /**
   * 格式化问题列表
   */
  private formatIssueList(issues: ReviewIssue[]): string {
    let result = '';
    
    issues.forEach((issue, index) => {
      result += `${index + 1}. **${issue.type}**: ${issue.message}\n`;
      if (issue.file) {
        result += `   文件: \`${issue.file}\``;
        if (issue.line) {
          result += ` 行: ${issue.line}`;
        }
        result += '\n';
      }
      if (issue.suggestion) {
        result += `   建议: ${issue.suggestion}\n`;
      }
      result += '\n';
    });
    
    return result;
  }
} 