import { app } from "./app.js";

// Vercel serverless functions require exporting the Express app,
// not calling app.listen(). The platform invokes the function per request.
export default app;