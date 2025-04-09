import { PRDiff, ReviewResult, ReviewIssue, ReviewComment } from '../github/types';
import { logger } from '../utils/logger';
import { CodeAnalyzer } from './interface';

interface AIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const prompts = {
  system: `你是一位专业的高级代码审查专家，拥有多年软件开发和代码审查经验。
你的任务是对提交的代码变更进行全面、专业、有建设性的代码审查。
你必须严格按照指定的Markdown格式返回结果，包含表情符号，并确保内容具体、可操作。
分析代码优点与问题点，并给出具体修改建议。`,
  
  user: (diffs: PRDiff[]) => {
    let prompt = `## 代码审查请求\n\n`;
    prompt += `我需要你对以下Pull Request的代码变更进行专业的代码审查。\n\n`;
    prompt += `### 变更概述\n`;
    prompt += `共有 ${diffs.length} 个文件被修改：\n\n`;
    
    // 添加文件概述
    diffs.forEach((diff, index) => {
      prompt += `- 文件 ${index + 1}: \`${diff.filename}\` (${diff.status}, +${diff.additions}/-${diff.deletions}行)\n`;
    });

    prompt += `\n### 详细变更内容\n\n`;

    // 添加详细的文件变更
    diffs.forEach((diff, index) => {
      prompt += `#### 文件 ${index + 1}/${diffs.length}: \`${diff.filename}\`\n`;
      prompt += `- 状态: ${diff.status}\n`;
      prompt += `- 添加: ${diff.additions} 行\n`;
      prompt += `- 删除: ${diff.deletions} 行\n`;
      prompt += `- 变更总计: ${diff.changes} 行\n\n`;
      
      if (diff.patch) {
        prompt += `\`\`\`diff\n${diff.patch}\n\`\`\`\n\n`;
      } else {
        prompt += `[没有可用的差异内容]\n\n`;
      }
    });

    // 添加输出格式要求
    prompt += `### 请求的审查格式\n\n`;
    prompt += `你必须严格按照以下格式提供代码审查结果，包含所有指定的表情符号：\n\n`;
    prompt += `## 😀代码评分: [0-100分]\n\n`;
    prompt += `## ✅代码优点:\n`;
    prompt += `1. [优点1描述，具体说明代码的哪些方面做得好]\n`;
    prompt += `2. [优点2描述]\n`;
    prompt += `3. [优点3描述]\n`;
    prompt += `（列出至少3-5个优点，如果确实很少则至少2个）\n\n`;
    prompt += `## 🤔问题点:\n`;
    prompt += `1. [问题1描述] - 在 [文件名]:[行号]\n`;
    prompt += `2. [问题2描述] - 在 [文件名]:[行号]\n`;
    prompt += `3. [问题3描述] - 在 [文件名]:[行号]\n`;
    prompt += `（按重要性排序，每个问题必须指明具体文件和行号）\n\n`;
    prompt += `## 🎯修改建议:\n`;
    prompt += `1. [建议1，针对具体问题，包含代码示例]\n`;
    prompt += `2. [建议2，针对具体问题，包含代码示例]\n`;
    prompt += `3. [建议3，针对具体问题，包含代码示例]\n`;
    prompt += `（针对上述问题提供具体的修改建议，尽可能包含代码示例）\n\n`;
    prompt += `## 💻修改后的代码:\n`;
    prompt += `如果有重要修改建议，提供修改后的代码示例:\n\n`;
    prompt += `\`\`\`[语言]\n`;
    prompt += `[改进后的完整代码片段，而不仅仅是修改部分]\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `必须严格遵循此格式，不要省略任何部分或添加额外部分。确保使用正确的表情符号和Markdown格式。`;

    logger.debug('--------------------------------');
    logger.info(prompt);
    logger.debug('--------------------------------');
    return prompt;
  }
};

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
    if (!this.apiKey) {
      throw new Error('未设置AI API密钥');
    }

    if (!diffs?.length) {
      return { comments: [], issues: [], summary: '没有发现差异需要分析' };
    }

    try {
      const prompt = prompts.user(diffs);
      const response = await this.callAI(prompt);
      return this.parseResponse(response);
    } catch (error) {
      logger.error('AI分析失败:', error);
      throw error;
    }
  }

  private async callAI(prompt: string): Promise<string> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.aiModel,
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`AI API错误: ${response.status}`);
    }

    const data = await response.json() as AIResponse;
    return data.choices?.[0]?.message?.content || '';
  }

  private parseResponse(response: string): ReviewResult {
    const issues: ReviewIssue[] = [];
    const comments: ReviewComment[] = [];

    // 简单的行号提取
    const lineRegex = /在\s+([^:]+):(\d+)/g;
    let match;
    
    while ((match = lineRegex.exec(response)) !== null) {
      const [_, file, line] = match;
      issues.push({
        message: response.substring(match.index - 50, match.index + 50),
        file,
        line: parseInt(line, 10) || 0,
        severity: 'medium',
        type: 'bug'
      });
    }

    return {
      comments,
      issues,
      summary: response
    };
  }
} 