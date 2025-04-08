# PR代码审查工具

这是一个简单的PR代码审查工具，用于自动分析PR中的代码变更并提供审查建议。

## 功能

- 获取PR的差异内容
- 分析代码变更
- 生成审查报告
- 提交审查结果到PR评论

## 安装

```bash
# 安装依赖
npm install
```

## 配置

1. 复制环境变量示例文件并修改
```bash
cp .env.example .env
```

2. 编辑`.env`文件，填入必要的配置信息:
   - `GITHUB_TOKEN`: GitHub个人访问令牌
   - `GITHUB_OWNER`: GitHub仓库所有者
   - `GITHUB_REPO`: GitHub仓库名称
   - `PR_NUMBER`: 要审查的PR编号
   - `LOG_LEVEL`: 日志级别(debug, info, warn, error)
   - `DRY_RUN`: 是否为干运行模式(true/false)

## 使用

```bash
# 构建项目
npm run build

# 运行审查工具
npm start
```

## 扩展

目前使用的是模拟分析器，返回预设的审查结果。未来可以集成真实的代码分析工具或AI服务来提供更准确的审查建议。 