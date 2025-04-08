import { PRDiff, ReviewResult, ReviewIssue, ReviewComment } from '../github/types';
import { logger } from '../utils/logger';

/**
 * 基于第三方AI的代码分析器
 * 用于将PR差异发送给AI服务并获取审查结果
 */
export class AICodeAnalyzer {
  private apiKey: string;
  private apiEndpoint: string;

  constructor(apiKey?: string, apiEndpoint?: string) {
    // 优先使用传入的参数，否则从环境变量获取
    this.apiKey = apiKey || process.env.AI_API_KEY || '';
    this.apiEndpoint = apiEndpoint || process.env.AI_API_ENDPOINT || '';
    
    if (!this.apiKey) {
      logger.warn('未设置AI API密钥，将无法使用AI分析功能');
    }
    
    if (!this.apiEndpoint) {
      // 默认使用OpenAI的API
      this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
      logger.info(`未设置AI API端点，使用默认端点: ${this.apiEndpoint}`);
    }
  }

  /**
   * 分析PR差异并返回审查结果
   * @param diffs PR差异信息
   */
  async analyze(diffs: PRDiff[]): Promise<ReviewResult> {
    logger.info(`AI分析器开始分析 ${diffs.length} 个文件`);
    
    if (!this.apiKey) {
      logger.error('未设置AI API密钥，无法使用AI分析功能');
      throw new Error('未设置AI API密钥');
    }
    
    if (!diffs || diffs.length === 0) {
      logger.info('没有差异需要分析');
      return {
        comments: [],
        issues: [],
        summary: '没有发现差异需要分析'
      };
    }
    
    try {
      // 准备发送给AI的数据
      const prompt = this.preparePromptFromDiffs(diffs);
      logger.debug('已准备AI分析的提示内容');
      
      // TODO: 实现AI API调用
      // 这里后续会对接实际的AI API，下面是模拟
      logger.info('正在调用AI API分析代码...');
      
      // 模拟AI返回结果
      const mockIssues: ReviewIssue[] = [];
      const mockComments: ReviewComment[] = [];
      
      // 生成模拟的摘要
      const summary = this.generateSummary(diffs, mockIssues);
      
      // 构建审查结果
      const result: ReviewResult = {
        comments: mockComments,
        issues: mockIssues,
        summary
      };
      
      logger.info(`AI分析完成，发现 ${result.issues.length} 个问题`);
      return result;
    } catch (error) {
      logger.error('AI分析过程中发生错误:', error);
      throw error;
    }
  }
  
  /**
   * 准备发送给AI的提示内容
   */
  private preparePromptFromDiffs(diffs: PRDiff[]): string {
    let prompt = `请对以下代码变更进行代码审查，指出任何潜在的问题、改进建议和安全隐患。\n\n`;
    
    prompt += `共有 ${diffs.length} 个文件被修改：\n`;
    
    diffs.forEach((diff, index) => {
      prompt += `\n文件 ${index + 1}/${diffs.length}: ${diff.filename}\n`;
      prompt += `状态: ${diff.status}, 添加: ${diff.additions} 行, 删除: ${diff.deletions} 行\n`;
      
      if (diff.patch) {
        prompt += `差异内容:\n${diff.patch}\n`;
      } else {
        prompt += `[没有可用的差异内容]\n`;
      }
      
      prompt += `---\n`;
    });
    
    prompt += `\n请提供以下格式的审查结果：
1. 总体评价
2. 按严重程度列出的具体问题（高、中、低）
3. 改进建议
4. 任何安全隐患
5. 代码质量评分（1-10）`;
    
    return prompt;
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
    
    return `# AI代码审查摘要

审查了 ${diffs.length} 个文件，共有 ${totalAdditions} 行添加和 ${totalDeletions} 行删除。

## 发现的问题

- 高严重性问题: ${highSeverityCount}
- 中等严重性问题: ${mediumSeverityCount}
- 低严重性问题: ${lowSeverityCount}

## 总体评价

这是一个基于AI的代码审查报告。目前正在开发中，完整功能即将推出。

## 建议

- 修复所有高严重性问题
- 考虑解决中等严重性问题
- 低严重性问题可以在未来的迭代中解决`;
  }
} 