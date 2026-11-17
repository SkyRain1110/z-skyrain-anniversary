# Z 和 Skyrain 的一周年像素纪念网页

一个专为手机竖屏设计的 16-bit 像素小站：星露谷式木质/羊皮纸 UI、三段可无限循环的场景、双人对话框、彩蛋、在一起天数统计，以及一个共享留言板。

- 封面：`Z和Skyrain的纪念网页` + START
- 场景一：深圳中学校碑 / 校门
- 场景二：夜路表白
- 场景三：河畔散步（诗信 + 扭扭棒桃花剑彩蛋）
- 留言板：Cloudflare Pages Functions + D1 云端持久化；本地预览 / GitHub Pages 自动退回 localStorage
- 可选访问口令、声音开关、左右按钮 + 手势滑动

> **当前线上地址（GitHub Pages）**：<https://skyrain1110.github.io/z-skyrain-anniversary/>
> GitHub Pages 只能托管静态文件，不能运行 `functions/`，所以线上留言板会变成「本机保存」。需要所有朋友共享留言时，按下面 Cloudflare Pages + D1 部分再部署一次即可。

---

## 一、先看效果（本地预览）

在项目根目录执行任意一个静态服务器：

```bash
# 有 Python 的话
python -m http.server 8123

# 或者用 Node
npx serve . -l 8123
```

然后手机/电脑浏览器打开：

```
http://127.0.0.1:8123/
```

> 本地预览时没有 `/api/messages`，留言板会自动进入「本地预览模式」，留言只保存在当前浏览器；部署并绑定 D1 后自动变成云端共享。
>
> 直接双击 `index.html` 也能看，但部分浏览器在 `file://` 下会限制 Web 字体，建议用上面的本地服务器。

---

## 二、目录结构

```
index.html                  页面结构（封面、三个场景、留言板、彩蛋弹窗）
assets/
  css/style.css             全部样式（像素 UI、响应式、动效）
  js/config.js              站点配置：纪念日、口令、对话秒数
  js/app.js                 封面、场景循环、对话计时、滑动、彩蛋
  js/audio.js               WebAudio 合成的 8-bit 音效
  js/board.js               留言板（云端 / 本地两种模式）
  img/                      优化后的背景、人物、诗信、桃花剑
  ui/                       像素边框、气泡尾巴、心形、信封、favicon
  fonts/zpix.woff2          中文像素字体 Zpix
functions/api/messages.js   Cloudflare Pages Function：留言 GET / POST
schema.sql                  D1 建表语句
wrangler.toml               Cloudflare Pages + D1 绑定配置
_headers                    Pages 静态资源缓存与安全头
.assetsignore               部署时排除原图、预览截图、说明文件
.nojekyll                   GitHub Pages 用，跳过 Jekyll 处理
.gitignore                  本地素材与测试目录，不进入 Git
图片/                        原始素材（本地保留，不进入 GitHub 仓库）
read_me.txt                  最初的需求说明（本地保留）
preview/                     本地预览截图（不进入 GitHub 仓库）
```

---

## 三、部署（GitHub Pages / Cloudflare Pages）

### GitHub Pages（当前线上）

- 仓库：<https://github.com/SkyRain1110/z-skyrain-anniversary>
- 站点：<https://skyrain1110.github.io/z-skyrain-anniversary/>
- 纯静态托管：页面、三个场景、彩蛋、音效、天数统计都正常。
- **共享留言板**：GitHub Pages 不能执行 `functions/`，所以朋友们的留言只会保存在各自浏览器里。GitHub Pages 下留言板会自动进入「本机留言」模式，不请求 `/api/messages`，不会卡在“正在连接云端”。需要云端共享时，按下面的 Cloudflare Pages + D1 方案部署一次；仓库里已经保留好 `functions/`、`schema.sql`、`wrangler.toml`。
- 更新方式：改完后重新推送 `main`（或重新上传文件），Pages 会自动重新构建。

### Cloudflare Pages（带共享留言板）

下面的步骤会把站点部署到 Cloudflare Pages，并启用「所有人可见」的云端留言板。

#### 0. 准备

- 一个 Cloudflare 账号（免费计划即可）
- 本机 Node.js 18+（用 `npx wrangler` 部署）
- 项目文件夹

```bash
cd 你的项目目录
npx wrangler login
```

#### 1. 创建 D1 数据库

```bash
npx wrangler d1 create zsky-messages
```

命令会输出类似：

```toml
[[d1_databases]]
binding = "DB"
database_name = "zsky-messages"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

把 `database_id` 填进项目里的 `wrangler.toml`（把 `REPLACE_WITH_YOUR_DATABASE_ID` 替换掉）。

#### 2. 建表

```bash
npx wrangler d1 execute zsky-messages --remote --file=./schema.sql
```

#### 3. 部署 Pages

```bash
npx wrangler pages deploy . --project-name=zsky-anniversary
```

第一次部署会询问是否创建项目，选是。部署完成后会给你一个
`https://zsky-anniversary.pages.dev` 的地址。

#### 4. 确认 D1 绑定

打开 Cloudflare Dashboard → **Workers & Pages** → 你的 Pages 项目：

- **Settings → Functions → D1 database bindings**
- 变量名必须是 **`DB`**，选择刚才创建的 `zsky-messages`
- 如果这里还没有，添加后重新部署一次（或再执行一次上面的 `pages deploy`）

也可以直接用 `wrangler.toml` 里的 `[[d1_databases]]` 配置，Wrangler 部署时会一并带上。

#### 5. 自检接口

浏览器打开：

```
https://你的域名/api/messages
```

看到 `{"messages":[]}`（或已有留言）就说明后端通了。回到页面打开留言板，应该显示 **「云端同步 · 所有人都能看到」**。

#### 6. 绑定免费域名

Pages 项目 → **Custom domains** → **Set up a custom domain**：

- 域名已经托管在 Cloudflare：按提示自动加 DNS
- 域名在别处：按提示到域名商添加 CNAME，指向 `你的项目.pages.dev`

> 也可以用 Git 集成：把项目推到 GitHub，在 Pages 里连接仓库，构建命令留空、输出目录填 `/`，然后在项目设置里绑定 D1（变量名 `DB`）。注意：直接拖拽上传静态文件的方式不会部署 `functions/`，共享留言板会退回本地模式。

---

## 四、想改内容？改这几个地方

### 1. 在一起天数 / 访问口令 / 对话秒数

编辑 `assets/js/config.js`：

```js
window.SITE_CONFIG = {
  startDate: "2025-11-19", // 纪念日，从这天开始算第 1 天
  accessCode: "",          // 例如 "1118" 就会在打开时要求输入口令；留空 = 不开启
  apiBase: "/api/messages",
  dialogueSeconds: 10,     // 每组对话框停留秒数
  staticOnly: false,       // GitHub Pages 绑定自定义域名时设为 true（跳过云端接口）
};
```

> 口令是**纯前端**的礼貌性门槛，只能防误闯，不能防住会看源码的人。如果确实需要强隐私，建议用 Cloudflare Access 或给 Pages 加密码保护。
>
> 封面上的年份区间也会跟着 `startDate` 自动更新，不用另外改 HTML。

### 2. 对话文字

打开 `index.html`，搜索 `data-scene="2"` / `data-scene="3"`：

- 每一组 `<div class="dialogue-group">` 里的两个 `.bubble` 会**同时出现、同时消失**。
- 场景三有两组，页面每 10 秒自动切换一组；只有一组的场景会一直显示。
- 改人物名字：`<span class="bubble-name">` 和 `<figure class="char ...">` 里的 `alt`。
- 改台词：直接改 `.bubble p` 里的文字即可。

场景一默认没有对话框；场景二一组表白对话，常驻显示；场景三两组对话，每 10 秒切换。想给场景一加对话，复制一组 `.dialogue-group` 进去即可。

### 3. 图片

替换 `assets/img/` 下同名文件即可：

- `scene-gate.webp` / `scene-date.webp` / `scene-river.webp`：竖版场景背景（建议 3:4 左右）
- `boy.webp` / `kuromi.webp`：透明背景人物
- `sword.webp` / `letter.webp`：彩蛋弹窗里的图

`图片/` 里保留的是原始素材，部署时已在 `.assetsignore` 中排除。

### 4. 留言长度

- 前端：`assets/js/board.js` 顶部的 `CONTENT_MAX`、`NAME_MAX`
- 后端：`functions/api/messages.js` 顶部的 `MAX_NAME`、`MAX_CONTENT`
- 输入框的 `maxlength` 在 `index.html` 里

两边要一起改，否则可能被后端拒绝。

---

## 五、留言板说明

- 线上：`GET /api/messages` 读取最近 200 条，`POST /api/messages` 写入 D1。
- 字段：`id`、`name`、`content`、`created_at`（ISO 时间）。
- 读取失败 / 未绑定 D1 / 本地静态预览时，前端自动切换为 localStorage，并在留言板上显示「本地预览」。
- 内容全部通过 `textContent` 渲染，不存在 HTML 注入。
- 没有做访问频率限制（只给少数朋友看，通常不需要）。如果担心被刷，可以在 Function 里加 Turnstile 或简单的 IP/时间窗口限制。
- 想清空留言：

```bash
npx wrangler d1 execute zsky-messages --remote --command="DELETE FROM messages;"
```

- 想导出留言：

```bash
npx wrangler d1 execute zsky-messages --remote --command="SELECT * FROM messages ORDER BY id DESC;"
```

---

## 六、字体与版权

- 中文像素字体 **Zpix（最像素）** by SolidZORO：<https://github.com/SolidZORO/zpix-pixel-font>
  - 个人项目免费；商业项目需向作者购买授权。本项目是个人纪念页，按个人项目免费授权使用。
  - 字体已按原样从官方 Release 取得（`zpix.woff2`），未做修改。
- 场景 / 人物 / 诗信 / 桃花剑素材由项目主人提供，仅用于这个纪念页。
- 页面代码可以随意修改自用。

---

## 七、常见问题

**留言板一直显示「本地预览」**

1. 确认是通过 `wrangler pages deploy` 或 Git 集成部署的（`functions/` 必须一起上线）。
2. 打开 `/api/messages`，如果是 `{"error":"DB_NOT_CONFIGURED"}`，说明 D1 绑定没生效，去 Pages 设置里绑定变量名 `DB`，再重新部署。
3. 确认 `schema.sql` 已在**远程** D1 执行过（带 `--remote`）。

**字体看起来不是像素字**

- 必须通过 `http://` 访问（`file://` 下部分浏览器会拦截字体）；
- 检查 `assets/fonts/zpix.woff2` 是否上传；
- 强刷缓存。

**手机上输入留言时页面放大**

已通过移动端输入框 `font-size: 16px` 规避 iOS 自动缩放。若仍有问题，可把 `.field input/textarea` 的字体再调大。

**改了台词但线上没变化**

Pages 默认对 HTML 设置了较短缓存；强刷或重新部署。静态资源是长缓存，文件名没变时可能需要强刷。

---

## 八、快速自检清单

- [ ] 封面标题是「Z和Skyrain的纪念网页」，START 可以进入
- [ ] 左上角「在一起 第 N 天」正确（起始 2025-11-19）
- [ ] 左右按钮 / 左右滑动都能无限循环三个场景
- [ ] 每组对话框同时出现、同时消失；场景三每 10 秒换一组
- [ ] 场景三的诗信 / 桃花剑可以点开
- [ ] 声音开关有效，刷新后保持
- [ ] GitHub Pages 上留言板显示「本机保存」是正常的；部署到 Cloudflare Pages + D1 后会显示「云端同步」，朋友能看到彼此的留言
- [ ] 可选口令开启后，输错有提示，输对能进入

祝一周年快乐。♥
