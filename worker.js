// @ts-nocheck
export default {
  async fetch(request, env) {
    try {
      const webhookUrl = env.WEBHOOK_URL;  // Variables & Secrets で設定
      // KV から前回の状態を取得
      const stateJson = await env.STATE.get("wikiState");
      const state = stateJson ? JSON.parse(stateJson) : { lastKey: null, sentBootMessage: false };

      // RSS を取得
      const res = await fetch("https://bloxd.wikiru.jp/?cmd=rss");
      const text = await res.text();

      // ===== 正規表現で最新1件を取得 =====
      const itemMatch = text.match(/<item>[\s\S]*?<\/item>/);
      if (!itemMatch) return new Response("No items", { status: 200 });

      const itemXml = itemMatch[0];

      const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
      const linkMatch  = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<description>(.*?)<\/description>/);

      const title = titleMatch ? titleMatch[1] : "不明";
      const link  = linkMatch ? linkMatch[1] : "不明";
      const updateTime = pubDateMatch ? pubDateMatch[1] : "不明";

      const key = `${title}|${link}|${updateTime}`;

      const NAME = "Bloxd攻略 Wiki v1.5.3"
      const AVATAR = "https://bloxd.wikiru.jp/image/pukiwiki.png"

      // ===== 初回起動：アップデート通知 =====
      if (!state.sentBootMessage) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: NAME,
            avatar_url: AVATAR,
            content: "🔄 **Bloxd攻略 Wiki Botがアップデートされました**\nwikiの更新通知を再開します"
          })
        });
        state.sentBootMessage = true;
      }

      // ===== 更新チェック（最新1件のみ） =====
      // ===== Embed通知（最新1件） =====
      if (key !== state.lastKey) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: NAME,
            avatar_url: AVATAR,
            embeds: [
              {
                title: "Wiki更新通知【埋め込み表示】",
                description: "[Bloxd攻略Wiki](https://bloxd.wikiru.jp)で更新がありました",
                color: 0x00bfff,
                fields: [
                  { name: "ページ名", value: `\`${title}\``, inline: true },
                  { name: "ページリンク", value: `[${title}](${link})`, inline:true},
                  { name: "更新時間", value: `${updateTime}`, inline: false },
                ],
                timestamp: new Date().toISOString()
              }
            ]
          })
        });

        state.lastKey = key;  // KV に保存するための更新
      }


      // KV に状態を保存
      await env.STATE.put("wikiState", JSON.stringify(state));

      return new Response("OK", { status: 200 });
    } catch (err) {
      return new Response("Error: " + err.message, { status: 500 });
    }
  }
}
