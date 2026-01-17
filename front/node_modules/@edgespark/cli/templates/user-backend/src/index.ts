/**
 * EDGESPARK BACKEND
 *
 * Create and return your Hono app.
 * See @sdk/server-types for SDK API.
 *
 * ═══════════════════════════════════════════════════════════════════
 * ✅ WHAT YOU CAN DO
 * ═══════════════════════════════════════════════════════════════════
 *
 * - Create a Hono app and define routes
 * - Use edgespark.db for database operations (Drizzle ORM)
 * - Use edgespark.storage for file operations
 * - Use edgespark.auth.user for authenticated user info
 * - Access request data: c.req.json(), c.req.param(), c.req.query()
 * - Return responses: c.json(), c.text(), c.html()
 *
 * ═══════════════════════════════════════════════════════════════════
 * ❌ WHAT YOU CANNOT DO
 * ═══════════════════════════════════════════════════════════════════
 *
 * - DON'T forget to return the app
 * - DON'T remove required imports
 *
 * ═══════════════════════════════════════════════════════════════════
 * 📚 API DOCUMENTATION
 * ═══════════════════════════════════════════════════════════════════
 *
 * See @sdk/server-types for complete API documentation with examples.
 */

import { Hono } from "hono";
import type { Client } from "@sdk/server-types";
import { tables, buckets } from "@generated";
import { eq } from "drizzle-orm";

/**
 * Create your Hono app
 * @param edgespark - EdgeSpark SDK client
 * @returns Hono app with your routes defined
 */
export async function createApp(
  edgespark: Client<typeof tables>
): Promise<Hono> {
  const app = new Hono();

  // ═══════════════════════════════════════════════════════════
  // PATH CONVENTIONS (Authentication)
  //
  // /api/*          → Login required (edgespark.auth.user guaranteed)
  // /api/public/*   → Login optional (edgespark.auth.user if logged in)
  // /api/webhooks/* → No auth check (handle verification yourself)
  // ═══════════════════════════════════════════════════════════

  // Test endpoint - remove when you add your own routes
  app.get("/api/public/hello", (c) => c.json({ message: "Hello from EdgeSpark! Spark your idea to the Edge." }));

  // Example: Get all posts
  // app.get('/api/posts', async (c) => {
  //   const allPosts = await edgespark.db.select().from(tables.posts);
  //   return c.json({ posts: allPosts });
  // });

  // Example: Get post by ID
  // app.get('/api/posts/:id', async (c) => {
  //   const id = parseInt(c.req.param('id'));
  //   const result = await edgespark.db
  //     .select()
  //     .from(tables.posts)
  //     .where(eq(tables.posts.id, id));
  //
  //   if (result.length === 0) {
  //     return c.json({ error: 'Post not found' }, 404);
  //   }
  //
  //   return c.json({ post: result[0] });
  // });

  // Example: Create post
  // app.post('/api/posts', async (c) => {
  //   const data = await c.req.json();
  //
  //   if (!data.title || !data.content) {
  //     return c.json({ error: 'Missing required fields' }, 400);
  //   }
  //
  //   await edgespark.db.insert(tables.posts).values({
  //     title: data.title,
  //     content: data.content,
  //     createdAt: new Date().toISOString()
  //   });
  //
  //   return c.json({ success: true }, 201);
  // });

  // Example: Update post
  // app.put('/api/posts/:id', async (c) => {
  //   const id = parseInt(c.req.param('id'));
  //   const data = await c.req.json();
  //
  //   await edgespark.db
  //     .update(tables.posts)
  //     .set(data)
  //     .where(eq(tables.posts.id, id));
  //
  //   return c.json({ success: true });
  // });

  // Example: Delete post
  // app.delete('/api/posts/:id', async (c) => {
  //   const id = parseInt(c.req.param('id'));
  //
  //   await edgespark.db
  //     .delete(tables.posts)
  //     .where(eq(tables.posts.id, id));
  //
  //   return c.json({ success: true });
  // });

  // Example: Upload file (type-safe bucket access)
  // app.post('/api/upload', async (c) => {
  //   const data = await c.req.arrayBuffer();
  //
  //   // Use bucket from storage_schema.ts for type safety
  //   await edgespark.storage.from(buckets.uploads).put(
  //     'files/example.txt',
  //     data,
  //     { contentType: 'text/plain' }
  //   );
  //
  //   return c.json({ success: true });
  // });

  // Example: Download file
  // app.get('/api/download', async (c) => {
  //   const path = c.req.query('path') || 'files/example.txt';
  //   const file = await edgespark.storage.from(buckets.uploads).get(path);
  //
  //   if (!file) {
  //     return c.json({ error: 'File not found' }, 404);
  //   }
  //
  //   const text = new TextDecoder().decode(file.body);
  //   return c.json({ content: text, size: file.metadata.size });
  // });

  // Example: Generate presigned upload URL
  // app.post('/api/upload-url', async (c) => {
  //   const { filename } = await c.req.json();
  //
  //   const { uploadUrl, expiresAt } = await edgespark.storage
  //     .from(buckets.uploads)
  //     .createPresignedPutUrl(`large-files/${filename}`, 3600, {
  //       contentType: 'video/mp4'
  //     });
  //
  //   return c.json({ uploadUrl, expiresAt });
  // });

  return app;
}
