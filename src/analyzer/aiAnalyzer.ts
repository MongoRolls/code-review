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
      
      try {
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
        
        // 提取行内评论
        const extractedComments = this.extractLineComments(aiReply, diffs);
        comments.push(...extractedComments);
      } catch (parseError) {
        logger.error('解析AI回复时发生错误:', parseError);
        // 虽然解析错误，但仍继续返回原始内容
        logger.warn('将返回未处理的AI回复作为summary');
      }
      
      return {
        comments,
        issues,
        summary: aiReply // 直接使用AI回复作为summary
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
   * 从AI回复中提取行内评论
   * @param aiReply AI返回的完整回复内容
   * @param diffs PR差异信息
   * @returns 提取的行内评论列表
   */
  private extractLineComments(aiReply: string, diffs: PRDiff[]): ReviewComment[] {
    const comments: ReviewComment[] = [];
    // 使用更宽松的正则表达式，避免直接使用emoji字符
    const problemsMatch = aiReply.match(/##\s*问题点:?([\s\S]*?)(?=##|$)/);
    
    if (problemsMatch && problemsMatch[1]) {
      const problemsSection = problemsMatch[1].trim();
      // 匹配每个问题条目，更宽松的模式
      const problemRegex = /\d+\.\s+(.+?)\s+-\s+在\s+([^:]+):(\d+)/g;
      
      let match;
      while ((match = problemRegex.exec(problemsSection)) !== null) {
        const [_, body, path, lineStr] = match;
        const lineNumber = parseInt(lineStr, 10);
        
        if (!isNaN(lineNumber) && path) {
          // 尝试找到对应的diff
          const diff = diffs.find(d => d.filename === path || d.filename.endsWith(`/${path}`));
          
          if (diff && diff.patch) {
            // 尝试计算position信息
            const position = this.calculatePosition(diff.patch, lineNumber);
            
            comments.push({
              path,
              body: this.formatCommentBody(body),
              position: position
            });
            
            logger.debug(`提取到行内评论：文件=${path}, 行=${lineNumber}, position=${position}`);
          } else {
            // 如果找不到对应diff或无法计算position，仍添加评论但不带position
            comments.push({
              path,
              body: this.formatCommentBody(body),
              position: undefined
            });
            
            logger.debug(`提取到文件评论（无position）：文件=${path}, 行=${lineNumber}`);
          }
        }
      }
    }
    
    logger.info(`从AI回复中提取了${comments.length}个评论`);
    return comments;
  }
  
  /**
   * 格式化评论内容，确保Markdown格式正确
   * @param body 原始评论内容
   * @returns 格式化后的评论内容
   */
  private formatCommentBody(body: string): string {
    // 移除开头的空格和破折号
    body = body.trim().replace(/^[\s-]+/, '');
    // 确保以句号结尾
    if (!body.endsWith('.') && !body.endsWith('?') && !body.endsWith('!')) {
      body += '.';
    }
    return body;
  }
  
  /**
   * 尝试根据diff和行号计算GitHub PR的position值
   * @param patch diff补丁内容
   * @param targetLine 目标行号
   * @returns 计算出的position或undefined
   */
  private calculatePosition(patch: string, targetLine: number): number | undefined {
    try {
      const lines = patch.split('\n');
      let currentLine = 0;
      let position = 0;
      
      // 寻找目标行对应的position
      for (const line of lines) {
        position++;
        
        // 跳过diff头部
        if (line.startsWith('@@')) {
          const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
          if (match) {
            currentLine = parseInt(match[1], 10) - 1;
          }
          continue;
        }
        
        // 只关注添加或不变的行（删除的行不在新文件中）
        if (!line.startsWith('-')) {
          currentLine++;
        }
        
        // 找到目标行
        if (currentLine === targetLine) {
          return position;
        }
      }
      
      return undefined;
    } catch (error) {
      logger.warn(`计算position时出错: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }
  
  /**
   * 准备发送给AI的提示内容
   */
  private preparePromptFromDiffs(diffs: PRDiff[]): string {
    // 更新系统提示
    let systemPrompt = `你是一位专业的高级代码审查专家，拥有多年软件开发和代码审查经验。
你的任务是对提交的代码变更进行全面、专业、有建设性的代码审查。
你必须严格按照指定的Markdown格式返回结果，包含表情符号，并确保内容具体、可操作。
分析代码优点与问题点，并给出具体修改建议。`;

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

    // 新的详细输出格式要求
    userPrompt += `\n### 请求的审查格式

你必须严格按照以下格式提供代码审查结果，包含所有指定的表情符号：

## 😀代码评分: [0-100分]

## ✅代码优点:
1. [优点1描述，具体说明代码的哪些方面做得好]
2. [优点2描述]
3. [优点3描述]
（列出至少3-5个优点，如果确实很少则至少2个）

## 🤔问题点:
1. [问题1描述] - 在 [文件名]:[行号]
2. [问题2描述] - 在 [文件名]:[行号]
3. [问题3描述] - 在 [文件名]:[行号]
（按重要性排序，每个问题必须指明具体文件和行号）

## 🎯修改建议:
1. [建议1，针对具体问题，包含代码示例]
2. [建议2，针对具体问题，包含代码示例]
3. [建议3，针对具体问题，包含代码示例]
（针对上述问题提供具体的修改建议，尽可能包含代码示例）

## 💻修改后的代码:
如果有重要修改建议，提供修改后的代码示例:

\`\`\`[语言]
[改进后的完整代码片段，而不仅仅是修改部分]
\`\`\`

必须严格遵循此格式，不要省略任何部分或添加额外部分。确保使用正确的表情符号和Markdown格式。
`;

    return `${systemPrompt}\n\n${userPrompt}`;
  }
} 