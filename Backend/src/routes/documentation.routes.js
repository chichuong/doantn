import { Router } from 'express';
import { fileURLToPath } from 'node:url';
const router = Router();
router.get('/api/v1/openapi.json', (request, response) => response.sendFile(fileURLToPath(new URL('../../docs/openapi.json', import.meta.url))));
router.get('/docs', (request, response) => response.sendFile(fileURLToPath(new URL('../../docs/api.html', import.meta.url))));
export default router;
