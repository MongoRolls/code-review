import { GitHubClient } from './github/client';
import { MockCodeAnalyzer } from './analyzer/mockAnalyzer';
import { GitHubCommentReporter } from './reporter/commentReporter';
import { logger } from './utils/logger';

/**
 * 主要执行函数
 */
async function main() {
  try {
    logger.info('代码审查工具启动');
    
    // 检查是否为测试模式
    const isTestMode = process.env.TEST_MODE === 'true';
    const isDryRun = process.env.DRY_RUN === 'true';
    
    logger.info(`运行模式: ${isTestMode ? '测试模式' : '正常模式'}${isDryRun ? ' (干运行)' : ''}`);
    
    let diffs = [];
    let reviewResult;
    
    if (isTestMode) {
      // 测试模式，跳过GitHub API调用，直接使用模拟数据
      logger.info('测试模式：使用模拟数据，跳过GitHub API调用');
      
      // 使用模拟分析器生成模拟结果
      const analyzer = new MockCodeAnalyzer();
      reviewResult = await analyzer.analyze([]);
      
      logger.info(`模拟分析完成，生成了 ${reviewResult.issues.length} 个问题`);
    } else {
      // 正常模式，使用GitHub API
      
      // 初始化GitHub客户端
      const githubClient = new GitHubClient();
      
      // 初始化代码分析器
      const analyzer = new MockCodeAnalyzer();
      
      // 初始化报告生成器
      const reporter = new GitHubCommentReporter(githubClient);
      
      // 1. 获取PR的差异
      logger.info('正在获取PR差异...');
      diffs = await githubClient.getPRDiffs();
      logger.info(`获取到 ${diffs.length} 个文件的差异`);
      
      // 2. 分析差异
      logger.info('正在分析差异...');
      reviewResult = await analyzer.analyze(diffs);
      logger.info(`分析完成，发现 ${reviewResult.issues.length} 个问题`);
      
      // 3. 提交审查结果
      if (!isDryRun) {
        // 正常模式，提交审查结果
        logger.info('正在提交审查结果...');
        await reporter.submit(reviewResult);
        logger.info('审查结果已提交');
      }
    }
    
    // 如果是干运行模式或测试模式，打印审查结果
    if (isDryRun || isTestMode) {
      logger.info('审查摘要:');
      console.log(reviewResult.summary);
      
      logger.info(`发现问题数量: ${reviewResult.issues.length}`);
      reviewResult.issues.forEach((issue, index) => {
        console.log(`[${index + 1}] ${issue.severity.toUpperCase()} - ${issue.type}: ${issue.message}`);
      });
    }
    
    logger.info('代码审查工具执行完成');
  } catch (error) {
    logger.error('代码审查工具执行失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

