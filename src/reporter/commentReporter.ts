import { Reporter } from './interface';
import { ReviewResult, ReviewIssue, ReviewComment } from '../github/types';
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
      // 分离有position和无position的评论
      const commentsWithPosition = result.comments.filter(comment => comment.position !== undefined);
      const commentsWithoutPosition = result.comments.filter(comment => comment.position === undefined);
      
      // 直接使用原始summary作为评论正文
      let commentBody = result.summary;
      
      // 添加页脚
      commentBody += '\n\n---\n*此评论由自动代码审查工具生成*';
      
      // 1. 提交总体评论
      await this.githubClient.createPRComment(commentBody);
      logger.info('已提交总体评论');
      
      // 2. 提交行级评论（如果有）
      if (commentsWithPosition.length > 0) {
        await this.githubClient.createPRReviewComment(commentsWithPosition);
        logger.info(`已提交${commentsWithPosition.length}个行内评论`);
      }
      
      logger.info('审查结果提交完成');
    } catch (error) {
      logger.error('提交审查结果失败:', error);
      throw new Error(`提交审查结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 