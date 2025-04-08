import { GitHubClient } from './github/client';
import { MockCodeAnalyzer } from './analyzer/mockAnalyzer';
import { AICodeAnalyzer } from './analyzer/aiAnalyzer';
import { GitHubCommentReporter } from './reporter/commentReporter';
import { logger } from './utils/logger';
import { PRDiff } from './github/types';

/**
 * 打印差异详细信息
 */
function printDiffDetails(diffs: PRDiff[]) {
  logger.info('------------------------');
  logger.info('差异详细信息:');
  diffs.forEach((diff, index) => {
    logger.info(`\n[文件 ${index + 1}/${diffs.length}] ${diff.filename} (状态: ${diff.status})`);
    logger.info(`添加: ${diff.additions} 行, 删除: ${diff.deletions} 行, 变更: ${diff.changes} 行`);
    if (diff.patch) {
      logger.info('差异内容:');
      console.log(diff.patch);
    } else {
      logger.info('没有可用的差异内容');
    }
    logger.info('------------------------\n\n');
  });
}

/**
 * 主要执行函数
 */
async function main() {
  try {
    logger.info('代码审查工具启动');
    
    // 检查配置模式
    const isDryRun = process.env.DRY_RUN === 'true';
    const useAI = process.env.AI_API_KEY && process.env.AI_API_KEY.trim() !== '';
    
    logger.info(`运行模式: 正常模式${isDryRun ? ' (干运行)' : ''}${useAI ? ' (使用AI)' : ' (不使用AI)'}`);
    
    let diffs = [];
    let reviewResult;
    
    // 初始化GitHub客户端
    const githubClient = new GitHubClient();
    
    // 选择代码分析器
    let analyzer;
    if (useAI) {
      analyzer = new AICodeAnalyzer();
      logger.info('使用AI代码分析器');
    } else {
      analyzer = new MockCodeAnalyzer();
      logger.info('使用模拟代码分析器');
    }
    
    // 初始化报告生成器
    const reporter = new GitHubCommentReporter(githubClient);
    
    // 正常模式，使用GitHub API
    
    // 1. 获取PR的差异
    logger.info('正在获取PR差异...');
    diffs = await githubClient.getPRDiffs();
    logger.info(`获取到 ${diffs.length} 个文件的差异`);
    
    // 打印差异详细信息
    printDiffDetails(diffs);
    
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
    
    // 打印审查结果
    if (isDryRun) {
      logger.info('审查摘要:');
      console.log(reviewResult.summary);
      
      if (reviewResult.issues.length > 0) {
        logger.info(`发现问题数量: ${reviewResult.issues.length}`);
        reviewResult.issues.forEach((issue, index) => {
          console.log(`[${index + 1}] ${issue.severity.toUpperCase()} - ${issue.type}: ${issue.message}`);
        });
      } else {
        logger.info('没有发现问题');
      }
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

