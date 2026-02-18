# **Ham Radio Awards System (PostgreSQL Edition)**

这是一个基于 Node.js, React 和 PostgreSQL 的业余无线电奖项管理系统。

基于BH2VSQ的代码继续开发和调试，源码仓库应该在页面的顶部显示

## **功能特性**

* **ADIF 解析 (JSONB)**: 自动解析 LoTW 导出的文件，支持动态标签（如 SAT\_NAME）。  
* **安全防护**: 所有 API 请求包含时间戳防重放，支持 Google Authenticator (TOTP) 登录。  
* **自定义安装**: 首次运行自动进入安装向导。  
* **动态后台**: 管理员入口路径可配置（默认 /\#/admin）。
* **多角色系统**: 支持管理员、奖状管理员和普通用户三种角色。
* **智能奖状评估**: 支持基于分数和全收集的多级别奖状评估。
* **DXCC 解析**: 内置 cty.dat 解析，自动从呼号推断 DXCC 信息。
* **MinIO 存储**: 使用 MinIO 存储奖状背景图片等文件。
* **详细统计**: 提供用户通联统计和系统概览。

## **技术架构**

### **前端**
- React 18
- Tailwind CSS 3
- Vite 4

### **后端**
- Node.js 16+
- Express
- PostgreSQL 12+
- JSON Web Token (JWT) 认证
- MinIO 存储

### **数据模型**
- **users**: 用户信息，包含呼号、密码哈希、角色和 2FA 密钥
- **qsos**: 通联记录，使用 JSONB 存储 ADIF 原始数据
- **awards**: 奖状定义，包含规则、布局和状态
- **user_awards**: 用户获得的奖状记录

## **部署步骤**

### **1\. 准备环境**

确保服务器已安装：

* Node.js (v16+)  
* PostgreSQL (v12+)  
* Minio

创建一个空的 PostgreSQL 数据库：

```sql
CREATE DATABASE ham_awards;
```

### **2\. 安装依赖**

在项目根目录运行：

```bash
npm install
```

### **3\. 构建前端 (如果是生产环境)**

在项目根目录运行:

```bash
npm run build
```

### **4\. 启动服务**

```bash
node server.js
```

服务默认运行在 http://localhost:3003。

### **5\. 首次安装**

1. 打开浏览器访问 http://localhost:3003。
2. 界面会自动检测到尚未安装，显示安装向导。
3. 填写数据库信息 (Host, User, Pass, DB Name)。
4. 填写 MinIO 配置信息 (EndPoint, Port, Access Key, Secret Key)。
5. 设置管理员账号 (Callsign) 和密码。
6. 完成安装后，系统会自动生成 `config.json` 文件。

## **配置说明**

### **配置文件**

* `config.json` - 系统自动生成的配置文件，包含数据库和 MinIO 凭据等敏感信息。
* `config.json.example` - 配置模板文件，可作为参考，但不包含实际敏感信息。

### **敏感信息保护**

* `config.json` 文件已在 `.gitignore` 中配置，不会被提交到版本控制系统。
* 请确保不要手动修改 `config.json` 文件中的敏感信息，如有需要请通过安装向导重新配置。  

## **安全机制说明**

1. **防重放**: 请求头必须包含 x-timestamp，服务端校验是否在 5 分钟窗口内。  
2. **2FA**: 用户可在 Dashboard 点击 "Enable 2FA"，使用 Authenticator 扫描二维码开启。开启后登录需提供验证码。
3. **JWT 认证**: 使用 JSON Web Token 进行身份验证，有效期 24 小时。
4. **密码加密**: 密码使用 bcrypt 算法加密存储。
5. **权限控制**: 基于角色的访问控制，不同角色拥有不同权限。

## **API 接口**

### **认证相关**
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册

### **用户相关**
- `GET /api/user/profile` - 获取用户资料
- `POST /api/user/2fa/setup` - 设置 2FA
- `POST /api/user/2fa/enable` - 启用 2FA
- `POST /api/user/2fa/disable` - 禁用 2FA

### **统计相关**
- `GET /api/stats/dashboard` - 获取仪表板统计信息

### **系统相关**
- `GET /api/system-status` - 获取系统状态
- `POST /api/install` - 系统安装

## **使用指南**

### **用户注册与登录**
1. 访问系统首页，点击 "注册" 按钮
2. 输入呼号和密码进行注册
3. 使用注册的呼号和密码登录系统

### **上传 ADIF 文件**
1. 登录系统后，进入 "我的通联" 页面
2. 点击 "上传 ADIF 文件" 按钮
3. 选择从 LoTW 导出的 ADIF 文件进行上传
4. 系统会自动解析并导入通联记录

### **申请奖状**
1. 进入 "奖状中心" 页面
2. 浏览可用的奖状
3. 点击 "申请" 按钮申请符合条件的奖状
4. 系统会自动评估是否符合条件

### **启用 2FA 认证**
1. 进入 "用户中心" 页面
2. 点击 "启用 2FA" 按钮
3. 使用 Google Authenticator 或其他 TOTP 应用扫描二维码
4. 输入生成的验证码确认启用

## **管理员指南**

### **访问管理后台**
- 默认路径：http://localhost:3003/#/admin
- 可在安装时配置自定义路径

### **管理用户**
- 查看所有用户列表
- 修改用户角色
- 重置用户密码

### **管理奖状**
- 创建新奖状
- 编辑现有奖状
- 审核用户奖状申请
- 管理奖状状态

## **故障排除**

### **常见问题**

1. **安装失败**
   - 检查数据库连接信息是否正确
   - 确保 PostgreSQL 服务正在运行
   - 确保数据库用户有创建表的权限

2. **上传 ADIF 文件失败**
   - 检查文件格式是否正确
   - 确保文件大小不超过 50MB
   - 检查网络连接是否稳定

3. **MinIO 连接失败**
   - 检查 MinIO 服务是否正在运行
   - 确保 MinIO 配置信息正确
   - 确保网络连接畅通

4. **2FA 无法启用**
   - 确保使用的是兼容 TOTP 的认证应用
   - 检查系统时间是否正确
   - 尝试重新生成二维码

### **日志查看**

- 系统运行日志会输出到控制台
- 可使用 PM2 等进程管理工具管理服务并查看日志

## **更新与维护**

### **更新项目**
1. 备份 `config.json` 文件
2. 拉取最新代码
3. 运行 `npm install` 更新依赖
4. 运行 `npm run build` 重新构建前端
5. 重启服务

### **数据库备份**

定期备份 PostgreSQL 数据库：

```bash
pg_dump ham_awards > ham_awards_backup.sql
```

### **MinIO 数据备份**

定期备份 MinIO 存储的数据目录。

### **cty.dat / 定期更新 `cty.bat`**

项目使用 `cty.dat` 提取 DXCC 信息。如果你使用或维护一个 `cty.bat`（或类似脚本）来自动下载/生成 `cty.dat`，请定期运行该脚本以保持 DXCC 数据最新。建议：

- **频率**：至少每月一次，或在 DXCC 列表更新时立即运行。
- **在服务器上自动化**：使用 Windows 任务计划程序或 `cron` 安排定期执行 `cty.bat`。
- **注意**：`cty.dat` 属于数据文件，不应提交到仓库；仓库中仅保留示例/转换脚本（如果有）。

## **许可证**

本项目采用 MIT 许可证。