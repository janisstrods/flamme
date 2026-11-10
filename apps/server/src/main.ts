/**
 * Server entry point. M4 replaces this stub with rooms, sessions, persistence and the AI runner.
 */
import Fastify from 'fastify';
import { PROTOCOL_VERSION } from '@velo/protocol';

const port = Number(process.env.PORT ?? 8787);
const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true, protocol: PROTOCOL_VERSION }));

await app.listen({ port, host: '0.0.0.0' });
