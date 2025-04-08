import { PRDiff, ReviewResult } from '../github/types';

/**
 * 代码分析器接口
 * 负责分析PR差异并生成审查结果
 */
export interface CodeAnalyzer {
  /**
   * 分析PR差异并生成审查结果
   * 
   * @param diffs PR差异信息
   * @returns 审查结果
   */
  analyze(diffs: PRDiff[]): Promise<ReviewResult>;
} 