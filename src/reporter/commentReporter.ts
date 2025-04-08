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
      
      // 验证AI响应格式
      const isValidFormat = this.validateAIResponse(result.summary);
      
      // 根据验证结果决定评论正文
      let commentBody = result.summary;
      
      // 如果格式无效，添加警告标记
      if (!isValidFormat) {
        logger.warn('AI响应格式不符合预期');
        commentBody = `⚠️ *AI评论格式异常，请检查系统配置*\n\n${result.summary}`;
      }
      
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
  
  /**
   * 验证AI响应格式
   * @param summary AI返回的完整响应
   * @returns 格式是否有效
   */
  private validateAIResponse(summary: string): boolean {
    // 使用更宽松的正则表达式检查必要部分，避免使用emoji字符
    const requiredSections = [
      /##\s*代码评分:?/i,        // 对应"😀代码评分"
      /##\s*代码优点:?/i,        // 对应"✅代码优点"
      /##\s*问题点:?/i,          // 对应"🤔问题点"
      /##\s*修改建议:?/i         // 对应"🎯修改建议"
    ];
    
    // 检查所有必要部分是否存在
    const valid = requiredSections.every(regex => regex.test(summary));
    
    if (!valid) {
      // 找出缺失的部分，便于调试
      const missingSections = requiredSections
        .filter(regex => !regex.test(summary))
        .map(regex => regex.toString());
      
      logger.warn(`AI响应格式验证失败，缺少以下部分: ${missingSections.join(', ')}`);
    } else {
      logger.debug('AI响应格式验证通过');
    }
    
    return valid;
  }
} 