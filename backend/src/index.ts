import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import { SocketService } from './services/SocketService';
import { MeshService } from './services/MeshService';
import { PrismaClient } from '@prisma/client';
import fastifyCookie from '@fastify/cookie';

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();
const GATEWAY_NODE_ID = process.env.GATEWAY_NODE_ID || '1234';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'squawkbox_super_secret_key_change_me';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    requireAdmin: any;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; username: string; is_admin: boolean }
    user: { id: number; username: string; is_admin: boolean }
  }
}

async function start() {
  await fastify.register(cors, {
    origin: (origin, cb) => { cb(null, true) },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  await fastify.register(fastifyCookie);

  await fastify.register(jwt, {
    secret: JWT_SECRET,
    cookie: {
      cookieName: 'squawk_token',
      signed: false
    }
  });

  // JWT Verification Hook
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (request.cookies.squawk_token) {
        const decoded = await request.jwtVerify({ onlyCookie: true }) as any;
        request.user = decoded; // Explicitly assign decoded payload to user
      } else {
        const decoded = await request.jwtVerify() as any; 
        request.user = decoded;
      }
    } catch (err) {
      reply.status(401).send({ error: "Unauthorized access" })
    }
  });

  // Check Admin Hook
  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Use the already populated user from authenticate
      if (!request.user || !request.user.is_admin) {
        return reply.status(403).send({ error: "Unauthorized. Admin required." });
      }
    } catch (err) {
      reply.status(401).send({ error: "Unauthorized access" })
    }
  });

  const socketService = new SocketService(fastify.server);
  const meshService = new MeshService(socketService, prisma, GATEWAY_NODE_ID);

  fastify.get('/api/health', async () => {
    return { status: 'ok', node: GATEWAY_NODE_ID };
  });

  // --- AUTH ROUTES ---
  fastify.post('/api/auth/register', async (req, reply) => {
    const { username, password } = req.body as any;
    if (!username || !password) return reply.status(400).send({ error: "Username and password required" });
    
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return reply.status(400).send({ error: "Username already taken." });

    // Auto-approve and make admin if this is the FIRST user in the system
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password_hash: hash,
        is_approved: isFirstUser,
        is_admin: isFirstUser
      }
    });

    const token = fastify.jwt.sign({ 
      id: user.id, 
      username: user.username, 
      is_admin: user.is_admin 
    } as any);

    reply.setCookie('squawk_token', token, {
      path: '/',
      httpOnly: true,
      secure: false, // Turn to true on prod if using HTTPS
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return { 
      success: true, 
      user: { id: user.id, username: user.username, is_approved: user.is_approved, is_admin: user.is_admin }
    };
  });

  fastify.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body as any;
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    if (!user.is_approved) {
      return reply.status(403).send({ error: "Account pending admin approval." });
    }

    const token = fastify.jwt.sign({ 
      id: user.id, 
      username: user.username, 
      is_admin: user.is_admin 
    } as any);

    reply.setCookie('squawk_token', token, {
      path: '/',
      httpOnly: true,
      secure: false, // Turn to true on prod via HTTPS
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return { success: true, user: { id: user.id, username: user.username, is_admin: user.is_admin } };
  });

  fastify.post('/api/auth/logout', async (req, reply) => {
    reply.clearCookie('squawk_token', { path: '/' });
    return { success: true };
  });

  fastify.get('/api/auth/me', { preValidation: [(fastify as any).authenticate] }, async (req, res) => {
    return { user: req.user };
  });

  // --- ADMIN ROUTES ---
  fastify.get('/api/admin/pending', { preValidation: [(fastify as any).authenticate, (fastify as any).requireAdmin] }, async (req, reply) => {
    const pending = await prisma.user.findMany({
      where: { is_approved: false },
      select: { id: true, username: true, created_at: true }
    });
    return pending;
  });

  fastify.post('/api/admin/approve/:id', { preValidation: [(fastify as any).authenticate, (fastify as any).requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { is_approved: true }
    });
    return { success: true, user: { id: user.id, username: user.username } };
  });

  fastify.delete('/api/admin/reject/:id', { preValidation: [(fastify as any).authenticate, (fastify as any).requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    return { success: true };
  });


  // --- MESH ROUTES ---
  fastify.get('/api/squawks', async () => {
    const squawks = await prisma.squawk.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
      include: { parent_squawk: true }
    });
    return squawks;
  });

  fastify.post('/api/squawk', { preValidation: [(fastify as any).authenticate] }, async (req, res) => {
    const { message, reply_to_id } = req.body as { message: string, reply_to_id?: number };
    const sessionUser = req.user; // Retrieved from JWT
    
    if (!message || message.length === 0) {
      return res.status(400).send({ error: "Message cannot be empty." });
    }

    const shortId = GATEWAY_NODE_ID.length > 4 ? GATEWAY_NODE_ID.slice(-4) : GATEWAY_NODE_ID;
    const fullMessage = `${sessionUser.username}📡${shortId}: ${message}`;
    if (fullMessage.length > 180) {
      return res.status(400).send({ error: "Squawk exceeds 180 characters.", length: fullMessage.length });
    }

    const saved = await prisma.squawk.create({
      data: {
        author: sessionUser.username,
        node_id: GATEWAY_NODE_ID,
        message,
        is_global: false,
        reply_to_id: reply_to_id || null
      },
      include: { parent_squawk: true }
    }) as any;

    socketService.broadcastSquawk(saved);
    
    // Pass the real Mesh ID of the parent to the radio if it exists
    const nativeReplyId = saved.parent_squawk?.raw_packet ? parseInt(saved.parent_squawk.raw_packet) : undefined;
    
    meshService.queueMessage(fullMessage, nativeReplyId);
    
    return { success: true, squawk: saved };
  });

  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('SquawkBox backend available on http://localhost:3001');
    meshService.init(); 
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
