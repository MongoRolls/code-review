import { Octokit } from '@octokit/rest';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { PRDiff, ReviewComment } from './types';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private prNumber: number;

  constructor() {
    const config = getConfig();
    this.octokit = new Octokit({
      auth: config.githubToken
    });
    this.owner = config.githubOwner;
    this.repo = config.githubRepo;
    this.prNumber = config.prNumber;

    logger.info(`初始化GitHub客户端: ${this.owner}/${this.repo} PR #${this.prNumber}`);
  }

  /**
   * 获取PR的差异信息
   */
  async getPRDiffs(): Promise<PRDiff[]> {
    try {
      logger.info(`获取PR #${this.prNumber}的差异信息`);
      
      const response = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: this.prNumber,
        mediaType: {
          format: 'diff'
        }
      });

      // 获取PR中变更的文件列表
      const files = await this.octokit.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: this.prNumber
      });

      logger.info(`获取到${files.data.length}个变更文件`);

      const diffs: PRDiff[] = files.data.map(file => ({
        filename: file.filename,
        patch: file.patch,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        status: file.status
      }));

      return diffs;
    } catch (error) {
      logger.error('获取PR差异失败:', error);
      throw new Error(`获取PR差异失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 在PR上创建评论
   */
  async createPRComment(body: string): Promise<void> {
    try {
      logger.info(`在PR #${this.prNumber}上创建评论`);
      
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNumber,
        body
      });

      logger.info('评论创建成功');
    } catch (error) {
      logger.error('创建评论失败:', error);
      throw new Error(`创建评论失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 在PR的特定文件和位置创建评论
   */
  async createPRReviewComment(comments: ReviewComment[]): Promise<void> {
    try {
      if (comments.length === 0) {
        logger.info('没有需要提交的评论');
        return;
      }

      logger.info(`在PR #${this.prNumber}上创建${comments.length}个审查评论`);
      
      // 获取最新的commit SHA
      const { data: pullRequest } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: this.prNumber
      });

      const commitId = pullRequest.head.sha;
      
      // 创建审查
      await this.octokit.pulls.createReview({
        owner: this.owner,
        repo: this.repo,
        pull_number: this.prNumber,
        commit_id: commitId,
        comments: comments.map(comment => ({
          path: comment.path,
          position: comment.position,
          body: comment.body,
          line: comment.position // 使用position作为line
        })),
        event: 'COMMENT' // 提交为评论，不批准或请求更改
      });

      logger.info('审查评论创建成功');
    } catch (error) {
      logger.error('创建审查评论失败:', error);
      throw new Error(`创建审查评论失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 