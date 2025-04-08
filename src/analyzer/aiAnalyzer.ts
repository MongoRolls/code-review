import { PRDiff, ReviewResult, ReviewIssue, ReviewComment } from '../github/types';
import { logger } from '../utils/logger';
import { CodeAnalyzer } from './interface';


/**
 * 基于第三方AI的代码分析器
 * 用于将PR差异发送给AI服务并获取审查结果
 */
export class AICodeAnalyzer implements CodeAnalyzer {
  private apiKey: string;
  // 请求地址
  private apiEndpoint: string;
  // 模型
  private aiModel: string;

  constructor() {
    // 从环境变量获取配置
    this.apiKey = process.env.AI_API_KEY || '';
    this.apiEndpoint = process.env.AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    this.aiModel = process.env.AI_MODEL || 'gpt-4';
    
    if (!this.apiKey) {
      logger.warn('未设置AI API密钥，将无法使用AI分析功能');
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
      logger.debug(`提示内容长度: ${prompt.length} 字符`);
      
      // 提取系统和用户提示
      const systemPromptEndIndex = prompt.indexOf('\n\n');
      const systemPrompt = prompt.substring(0, systemPromptEndIndex);
      const userPrompt = prompt.substring(systemPromptEndIndex + 2);
      
      // 实现实际的AI API调用
      logger.info(`调用AI API: ${this.apiEndpoint}, 模型: ${this.aiModel}`);
      
      const requestBody: any = {
        model: this.aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3  // 较低的温度以获得更一致的回复
      };
      
      // 根据不同的API端点调整请求格式
      if (this.apiEndpoint.includes('deepseek')) {
        logger.info('检测到DeepSeek API，调整请求格式');
        // DeepSeek API可能有特殊要求，根据文档调整格式
        // 注意：这里假设DeepSeek API格式与OpenAI类似，可能需要根据实际情况调整
      }
      
      logger.debug('发送AI请求...');
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`AI API响应错误: ${response.status} ${response.statusText}`);
        logger.error(`错误详情: ${errorText}`);
        throw new Error(`AI API响应错误: ${response.status} ${response.statusText}`);
      }
      
      const data: any = await response.json();
      logger.debug('收到AI响应');
      
      // 处理不同API返回格式的差异
      let aiReply = '';
      if (this.apiEndpoint.includes('deepseek')) {
        // DeepSeek API回复格式处理
        aiReply = data.choices && data.choices[0] && data.choices[0].message 
          ? data.choices[0].message.content 
          : JSON.stringify(data);
        logger.debug('从DeepSeek API解析回复');
      } else {
        // 默认OpenAI格式
        aiReply = data.choices && data.choices[0] && data.choices[0].message 
          ? data.choices[0].message.content 
          : JSON.stringify(data);
      }
      
      logger.info('AI分析完成，现在解析结果');
      
      // 基本解析逻辑
      const issues: ReviewIssue[] = [];
      const comments: ReviewComment[] = [];
      
      // 解析高严重性问题
      const highSeverityMatch = aiReply.match(/### 高严重性问题\n([\s\S]*?)(?=###|##|$)/);
      if (highSeverityMatch && highSeverityMatch[1]) {
        const highSeverityIssues = this.parseIssuesFromSection(highSeverityMatch[1], 'high');
        issues.push(...highSeverityIssues);
      }
      
      // 解析中等严重性问题
      const mediumSeverityMatch = aiReply.match(/### 中等严重性问题\n([\s\S]*?)(?=###|##|$)/);
      if (mediumSeverityMatch && mediumSeverityMatch[1]) {
        const mediumSeverityIssues = this.parseIssuesFromSection(mediumSeverityMatch[1], 'medium');
        issues.push(...mediumSeverityIssues);
      }
      
      // 解析低严重性问题
      const lowSeverityMatch = aiReply.match(/### 低严重性问题\n([\s\S]*?)(?=###|##|$)/);
      if (lowSeverityMatch && lowSeverityMatch[1]) {
        const lowSeverityIssues = this.parseIssuesFromSection(lowSeverityMatch[1], 'low');
        issues.push(...lowSeverityIssues);
      }
      
      logger.info(`共解析出 ${issues.length} 个问题`);
      
      return {
        comments,
        issues,
        summary: aiReply
      };
    } catch (error) {
      logger.error('AI分析过程中发生错误:', error);
      throw error;
    }
  }
  
  /**
   * 从问题部分解析出具体问题
   */
  private parseIssuesFromSection(section: string, severity: 'high' | 'medium' | 'low'): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    // 简单的正则匹配来提取问题
    // 格式例如: "1. [问题描述] - 在 [文件名]:[行号]"
    const issueRegex = /\d+\.\s+(.+?)\s+-\s+在\s+([^:]+):(\d+)/g;
    let match;
    
    while ((match = issueRegex.exec(section)) !== null) {
      const [_, message, filename, lineStr] = match;
      const line = parseInt(lineStr, 10);
      
      issues.push({
        message,
        file: filename,
        line: isNaN(line) ? 0 : line,
        severity,
        type: 'bug' // 默认问题类型
      });
    }
    
    return issues;
  }
  
  /**
   * 准备发送给AI的提示内容
   */
  private preparePromptFromDiffs(diffs: PRDiff[]): string {
    // 构建系统消息
    let systemPrompt = `你是一位专业的高级代码审查专家，拥有多年软件开发和代码审查经验。
你的任务是对提交的代码变更进行全面、专业、有建设性的代码审查，提供具体、可操作的改进建议。
你应该重点关注代码的以下方面：
1. 代码质量：可读性、可维护性、命名规范、注释完整性
2. 架构设计：模块化、职责分离、依赖关系
3. 性能问题：算法效率、资源使用、可能的性能瓶颈
4. 安全隐患：潜在的安全漏洞、未验证的输入、敏感数据处理
5. 最佳实践：是否遵循行业最佳实践和设计模式
6. 潜在的bug：逻辑错误、边界条件、异常处理
7. 代码重复：可能的重复代码和重构机会

请提供具体、明确的建议，而不是笼统的评论。包括具体的代码示例来说明如何改进。
你的回应必须客观、有建设性、专业，避免对代码作者的主观评价。`;

    // 构建用户提示
    let userPrompt = `## 代码审查请求
    
我需要你对以下Pull Request的代码变更进行专业的代码审查。

### 变更概述
共有 ${diffs.length} 个文件被修改：
`;

    // 添加文件概述
    diffs.forEach((diff, index) => {
      userPrompt += `- 文件 ${index + 1}: \`${diff.filename}\` (${diff.status}, +${diff.additions}/-${diff.deletions}行)\n`;
    });

    userPrompt += `\n### 详细变更内容\n`;

    // 添加详细的文件变更
    diffs.forEach((diff, index) => {
      userPrompt += `\n#### 文件 ${index + 1}/${diffs.length}: \`${diff.filename}\`\n`;
      userPrompt += `- 状态: ${diff.status}\n`;
      userPrompt += `- 添加: ${diff.additions} 行\n`;
      userPrompt += `- 删除: ${diff.deletions} 行\n`;
      userPrompt += `- 变更总计: ${diff.changes} 行\n\n`;
      
      if (diff.patch) {
        userPrompt += `\`\`\`diff\n${diff.patch}\n\`\`\`\n\n`;
      } else {
        userPrompt += `[没有可用的差异内容]\n\n`;
      }
    });

    userPrompt += `\n### 请求的审查格式

请按照以下格式提供你的代码审查结果：

## 总体评价
[对整体代码质量的评价，包括主要优点和需要改进的地方]

## 问题列表
### 高严重性问题
1. [问题1描述] - 在 [文件名]:[行号]
   - [改进建议，最好包含代码示例]

### 中等严重性问题
1. [问题1描述] - 在 [文件名]:[行号]
   - [改进建议，最好包含代码示例]

### 低严重性问题
1. [问题1描述] - 在 [文件名]:[行号]
   - [改进建议，最好包含代码示例]

## 改进建议
[更广泛的改进建议，可能涉及架构、设计模式或最佳实践]

## 安全评估
[任何安全相关的问题或建议]

## 代码质量评分
[1-10分，根据代码质量给出评分，附带简短解释]
`;

    // 返回最终的提示：结合系统提示和用户提示
    return `${systemPrompt}\n\n${userPrompt}`;
  }
} 