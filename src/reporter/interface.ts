import { ReviewResult } from '../github/types';

/**
 * 报告生成器接口
 * 负责将审查结果提交或显示
 */
export interface Reporter {
  /**
   * 提交审查结果
   * 
   * @param result 审查结果
   * @returns 提交结果的Promise
   */
  submit(result: ReviewResult): Promise<void>;
} 