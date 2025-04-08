import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 找到并加载环境变量文件
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`已加载环境变量文件: ${envPath}`);
} else {
  console.warn(`找不到环境变量文件: ${envPath}`);
  dotenv.config(); // 尝试加载默认位置的.env文件
}

export interface Config {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  prNumber: number;
  logLevel: string;
}

export function getConfig(): Config {
  // 检查必要的环境变量
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('缺少环境变量: GITHUB_TOKEN');
  }

  const githubOwner = process.env.GITHUB_OWNER;
  if (!githubOwner) {
    throw new Error('缺少环境变量: GITHUB_OWNER');
  }

  const githubRepo = process.env.GITHUB_REPO;
  if (!githubRepo) {
    throw new Error('缺少环境变量: GITHUB_REPO');
  }

  const prNumberStr = process.env.PR_NUMBER;
  if (!prNumberStr) {
    throw new Error('缺少环境变量: PR_NUMBER');
  }

  const prNumber = parseInt(prNumberStr, 10);
  if (isNaN(prNumber)) {
    throw new Error('PR_NUMBER 必须是有效的数字');
  }

  const logLevel = process.env.LOG_LEVEL || 'info';

  return {
    githubToken,
    githubOwner,
    githubRepo,
    prNumber,
    logLevel
  };
} 