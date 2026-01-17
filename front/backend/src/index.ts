/**
 * 此间有灵 - Backend API
 * 
 * 提供笔记记录、聊天对话和AI生成功能的后端服务
 */

import { Hono } from "hono";
import type { Client } from "@sdk/server-types";
import { tables } from "@generated";
import { eq, desc, and, sql, gte, lte, or } from "drizzle-orm";
import { OpenRouter } from "@openrouter/sdk";
import { streamText } from "hono/streaming";

// 情绪枚举
const EMOTIONS = ["sad", "happy", "calm", "mysterious", "angry"] as const;
type Emotion = typeof EMOTIONS[number];

// 计算两点间距离（Haversine公式，返回公里）
function haversineDistance(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function createApp(
  edgespark: Client<typeof tables>
): Promise<Hono> {
  const app = new Hono();

  // ═══════════════════════════════════════════════════════════
  // 公开路由 - 无需登录
  // ═══════════════════════════════════════════════════════════

  // 获取1公里范围内的笔记（气泡显示）
  app.get("/api/public/nearby-notes", async (c) => {
    const latStr = c.req.query("lat");
    const lngStr = c.req.query("lng");
    
    if (!latStr || !lngStr) {
      return c.json({ error: "lat and lng are required" }, 400);
    }
    
    const userLat = parseFloat(latStr);
    const userLng = parseFloat(lngStr);
    
    console.log(`[API] GET /api/public/nearby-notes - lat: ${userLat}, lng: ${userLng}`);
    
    // 1度纬度约111公里，1度经度在赤道约111公里
    // 1公里约0.009度（粗略计算用于初筛）
    const latDelta = 0.01; // 约1.1公里
    const lngDelta = 0.01 / Math.cos(userLat * Math.PI / 180);
    
    // 先用边界框粗筛
    const notes = await edgespark.db
      .select()
      .from(tables.notes)
      .where(
        and(
          gte(tables.notes.latitude, userLat - latDelta),
          lte(tables.notes.latitude, userLat + latDelta),
          gte(tables.notes.longitude, userLng - lngDelta),
          lte(tables.notes.longitude, userLng + lngDelta)
        )
      )
      .orderBy(desc(tables.notes.createdAt))
      .limit(100);
    
    // 精确筛选1公里范围内的笔记
    const nearbyNotes = notes.filter(note => {
      if (!note.latitude || !note.longitude) return false;
      const dist = haversineDistance(userLat, userLng, note.latitude, note.longitude);
      return dist <= 1;
    });
    
    console.log(`[API] GET /api/public/nearby-notes - found ${nearbyNotes.length} notes within 1km`);
    return c.json({ data: nearbyNotes });
  });

  // 获取公开的笔记（兼容旧接口）
  app.get("/api/public/notes", async (c) => {
    console.log("[API] GET /api/public/notes - fetching public notes");
    const notes = await edgespark.db
      .select()
      .from(tables.notes)
      .where(eq(tables.notes.isPrivate, 0))
      .orderBy(desc(tables.notes.createdAt))
      .limit(100);
    console.log("[API] GET /api/public/notes - found", notes.length, "notes");
    return c.json({ data: notes });
  });

  // ═══════════════════════════════════════════════════════════
  // 需要登录的路由
  // ═══════════════════════════════════════════════════════════

  // 获取当前用户信息
  app.get("/api/me", (c) => {
    const user = edgespark.auth.user!;
    console.log("[API] GET /api/me - user:", user.id);
    return c.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });

  // 获取用户的所有笔记
  app.get("/api/notes", async (c) => {
    const userId = edgespark.auth.user!.id;
    console.log("[API] GET /api/notes - user:", userId);
    const notes = await edgespark.db
      .select()
      .from(tables.notes)
      .where(eq(tables.notes.userId, userId))
      .orderBy(desc(tables.notes.createdAt));
    console.log("[API] GET /api/notes - found", notes.length, "notes");
    return c.json({ data: notes });
  });

  // 创建笔记
  app.post("/api/notes", async (c) => {
    const userId = edgespark.auth.user!.id;
    const body = await c.req.json();
    console.log("[API] POST /api/notes - creating note for user:", userId, body);

    const note = await edgespark.db
      .insert(tables.notes)
      .values({
        userId,
        content: body.content,
        latitude: body.latitude,
        longitude: body.longitude,
        locationName: body.locationName,
        emotion: body.emotion || "calm",
        mode: body.mode || "trace",
        isPrivate: body.isPrivate ? 1 : 0,
      })
      .returning();

    const createdNote = note[0];
    console.log("[API] POST /api/notes - created note:", createdNote.id);
    
    // 异步调用AI情绪打标（不阻塞返回）
    const apiKey = edgespark.secret.get("OPENROUTER_API_KEY");
    if (apiKey && body.content) {
      tagEmotion(edgespark, apiKey, createdNote.id, body.content).catch(err => {
        console.error("[API] AI emotion tagging failed:", err);
      });
    }
    
    return c.json({ data: createdNote }, 201);
  });

  // AI情绪打标函数
  async function tagEmotion(
    edgespark: Client<typeof tables>,
    apiKey: string,
    noteId: number,
    content: string
  ) {
    const openrouter = new OpenRouter({ apiKey });
    
    const prompt = `分析以下文字的情绪，并返回最匹配的情绪标签。只返回一个单词，必须是以下选项之一：sad, happy, calm, mysterious, angry

文字内容：${content}

情绪标签：`;

    try {
      const result = await openrouter.chat.send({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: [{ role: "user", content: prompt }],
      });

      const emotionRaw = (result as any).choices[0]?.message?.content?.trim().toLowerCase() || "calm";
      const emotion = EMOTIONS.includes(emotionRaw as Emotion) ? emotionRaw : "calm";
      
      console.log(`[API] AI emotion tagging - noteId: ${noteId}, emotion: ${emotion}`);
      
      await edgespark.db
        .update(tables.notes)
        .set({ emotion })
        .where(eq(tables.notes.id, noteId));
    } catch (error: any) {
      console.error("[API] AI emotion tagging error:", error.message);
    }
  }

  // 获取单个笔记
  app.get("/api/notes/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const userId = edgespark.auth.user!.id;
    console.log("[API] GET /api/notes/:id - id:", id, "user:", userId);

    const notes = await edgespark.db
      .select()
      .from(tables.notes)
      .where(
        and(eq(tables.notes.id, id), eq(tables.notes.userId, userId))
      );

    if (notes.length === 0) {
      return c.json({ error: "Note not found" }, 404);
    }
    return c.json({ data: notes[0] });
  });

  // 更新笔记的AI总结
  app.patch("/api/notes/:id/summary", async (c) => {
    const id = parseInt(c.req.param("id"));
    const userId = edgespark.auth.user!.id;
    const { aiSummary } = await c.req.json();
    console.log("[API] PATCH /api/notes/:id/summary - id:", id);

    const updated = await edgespark.db
      .update(tables.notes)
      .set({ aiSummary })
      .where(
        and(eq(tables.notes.id, id), eq(tables.notes.userId, userId))
      )
      .returning();

    if (updated.length === 0) {
      return c.json({ error: "Note not found" }, 404);
    }
    return c.json({ data: updated[0] });
  });

  // 删除笔记
  app.delete("/api/notes/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const userId = edgespark.auth.user!.id;
    console.log("[API] DELETE /api/notes/:id - id:", id);

    // 先删除关联的聊天记录
    await edgespark.db
      .delete(tables.chats)
      .where(eq(tables.chats.noteId, id));

    const deleted = await edgespark.db
      .delete(tables.notes)
      .where(
        and(eq(tables.notes.id, id), eq(tables.notes.userId, userId))
      )
      .returning();

    if (deleted.length === 0) {
      return c.json({ error: "Note not found" }, 404);
    }
    return c.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════
  // 聊天相关路由
  // ═══════════════════════════════════════════════════════════

  // 获取笔记的聊天记录
  app.get("/api/notes/:noteId/chats", async (c) => {
    const noteId = parseInt(c.req.param("noteId"));
    const userId = edgespark.auth.user!.id;
    console.log("[API] GET /api/notes/:noteId/chats - noteId:", noteId);

    const chats = await edgespark.db
      .select()
      .from(tables.chats)
      .where(
        and(eq(tables.chats.noteId, noteId), eq(tables.chats.userId, userId))
      )
      .orderBy(tables.chats.createdAt);

    return c.json({ data: chats });
  });

  // AI聊天（流式响应）
  app.post("/api/ai/chat", async (c) => {
    const apiKey = edgespark.secret.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      console.error("[API] POST /api/ai/chat - OpenRouter not configured");
      return c.json({ error: "AI service not configured" }, 500);
    }

    const userId = edgespark.auth.user!.id;
    const { messages, noteId, noteContent, locationName } = await c.req.json();
    console.log("[API] POST /api/ai/chat - user:", userId, "noteId:", noteId);

    // 构建系统提示
    const systemPrompt = `你是一个温暖、富有诗意的地灵（Genius Loci），是这片土地的守护精灵。
你能感知到人们在这个地点留下的情感和故事。

${locationName ? `当前位置：${locationName}` : ""}
${noteContent ? `用户在这里写下的心声：${noteContent}` : ""}

请以温柔、诗意的语气回应用户，像一位智慧的老友或守护者。
你可以分享这片土地上的故事，给予温暖的慰藉，或提供富有哲理的启发。
保持回复简洁而有深度，每次回复控制在100-200字以内。`;

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const openrouter = new OpenRouter({ apiKey });

    // 保存用户消息
    if (messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg.role === "user") {
        await edgespark.db.insert(tables.chats).values({
          userId,
          noteId,
          role: "user",
          content: lastUserMsg.content,
        });
      }
    }

    return streamText(c, async (stream) => {
      let fullResponse = "";
      try {
        const result = await openrouter.chat.send({
          model: "deepseek/deepseek-chat-v3-0324:free",
          messages: fullMessages as any,
          stream: true,
        });

        for await (const chunk of result) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            await stream.write(content);
          }
        }

        // 保存AI回复
        if (fullResponse) {
          await edgespark.db.insert(tables.chats).values({
            userId,
            noteId,
            role: "assistant",
            content: fullResponse,
          });
        }
      } catch (error: any) {
        console.error("[API] POST /api/ai/chat - error:", error.message);
        await stream.write(`抱歉，地灵暂时无法与你交流...`);
      }
    });
  });

  // 生成AI总结
  app.post("/api/ai/summary", async (c) => {
    const apiKey = edgespark.secret.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return c.json({ error: "AI service not configured" }, 500);
    }

    const userId = edgespark.auth.user!.id;
    const { noteId } = await c.req.json();
    console.log("[API] POST /api/ai/summary - noteId:", noteId);

    // 获取笔记和聊天记录
    const notes = await edgespark.db
      .select()
      .from(tables.notes)
      .where(and(eq(tables.notes.id, noteId), eq(tables.notes.userId, userId)));

    if (notes.length === 0) {
      return c.json({ error: "Note not found" }, 404);
    }

    const note = notes[0];
    const chats = await edgespark.db
      .select()
      .from(tables.chats)
      .where(and(eq(tables.chats.noteId, noteId), eq(tables.chats.userId, userId)))
      .orderBy(tables.chats.createdAt);

    // 构建总结请求
    const chatHistory = chats
      .map((chat) => `${chat.role === "user" ? "用户" : "地灵"}: ${chat.content}`)
      .join("\n");

    const prompt = `基于以下内容，生成一段温暖、诗意的总结寄语（50-100字）：

用户心声：${note.content}
${note.locationName ? `地点：${note.locationName}` : ""}
${chatHistory ? `\n对话记录：\n${chatHistory}` : ""}

请以书信体的形式写一段寄语，像是地灵写给用户的留言。`;

    const openrouter = new OpenRouter({ apiKey });

    try {
      const result = await openrouter.chat.send({
        model: "deepseek/deepseek-chat-v3-0324:free",
        messages: [{ role: "user", content: prompt }],
      });

      const summary = (result as any).choices[0]?.message?.content || "";

      // 更新笔记的AI总结
      await edgespark.db
        .update(tables.notes)
        .set({ aiSummary: summary })
        .where(eq(tables.notes.id, noteId));

      return c.json({ data: { summary } });
    } catch (error: any) {
      console.error("[API] POST /api/ai/summary - error:", error.message);
      return c.json({ error: "Failed to generate summary" }, 500);
    }
  });

  return app;
}
