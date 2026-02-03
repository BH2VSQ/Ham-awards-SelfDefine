# **Ham Radio Awards System (PostgreSQL Edition)**

这是一个基于 Node.js, React 和 PostgreSQL 的业余无线电奖项管理系统。

## **功能特性**

* **ADIF 解析 (JSONB)**: 自动解析 LoTW 导出的文件，支持动态标签（如 SAT\_NAME）。  
* **安全防护**: 所有 API 请求包含时间戳防重放，支持 Google Authenticator (TOTP) 登录。  
* **自定义安装**: 首次运行自动进入安装向导。  
* **动态后台**: 管理员入口路径可配置（默认 /\#/admin）。

## **部署步骤**

### **1\. 准备环境**

确保服务器已安装：

* Node.js (v16+)  
* PostgreSQL (v12+)

创建一个空的 PostgreSQL 数据库：

CREATE DATABASE ham\_awards;

### **2\. 安装依赖**

在项目根目录运行：

npm install

### **3\. 构建前端 (如果是生产环境)**

在项目根目录运行:

npm run build

### **4\. 启动服务**

node server.js

服务默认运行在 http://localhost:3003。

### **5\. 首次安装**

1. 打开浏览器访问 http://localhost:3003。  
2. 界面会自动检测到尚未安装，显示安装向导。  
3. 填写数据库信息 (Host, User, Pass, DB Name)。  
4. 设置管理员账号 (Callsign) 和密码。  
5. **重要**: 设置管理员后台路径 (例如设置 path 为 secret，则后台入口为 /#/secret)。

### **6\. 使用说明**

* **普通用户**: 注册 \-\> 登录 \-\> 上传 ADIF \-\> 查看/领取奖状。  
* **管理员**:  
  1. 通过普通登录界面登录管理员账号。  
  2. 登录后，手动修改浏览器地址栏 Hash 为你设置的路径 (例如 http://localhost:3003/#/secret)。  

## **安全机制说明**

1. **防重放**: 请求头必须包含 x-timestamp，服务端校验是否在 5 分钟窗口内。  
2. **2FA**: 用户可在 Dashboard 点击 "Enable 2FA"，使用 Authenticator 扫描二维码开启。开启后登录需提供验证码。
