import { PrismaClient } from '@prisma/client';
declare const app: import("express-serve-static-core").Express;
declare const server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const wss: import("ws").Server<typeof import("ws"), typeof import("http").IncomingMessage>;
declare const prisma: PrismaClient<{
    log: ("error" | "warn" | "info" | "query")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export { app, server, prisma, wss };
//# sourceMappingURL=server.d.ts.map