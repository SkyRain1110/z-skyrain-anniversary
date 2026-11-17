/**
 * ============================================================
 *  站点配置 —— 改这里就够了
 * ============================================================
 *  startDate        在一起的第一天（2025-11-19 算第 1 天）
 *  accessCode       可选访问口令；留空 = 不开启口令弹窗
 *  dialogueSeconds  每组对话框停留秒数（默认 10 秒）
 *  apiBase          留言板接口地址（部署到 Cloudflare Pages 后保持默认）
 * ============================================================
 */
window.SITE_CONFIG = {
  startDate: "2025-11-19",
  accessCode: "",
  apiBase: "/api/messages",
  dialogueSeconds: 10,
  // GitHub Pages 绑定自定义域名时设为 true，跳过云端接口、直接用本机留言
  staticOnly: false,
};
