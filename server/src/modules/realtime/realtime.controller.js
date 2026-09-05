import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendOk } from '../../utils/ApiResponse.js';
import { logger } from '../../utils/logger.js';
import * as realtimeService from './realtime.service.js';

export const config = asyncHandler(async (_req, res) => {
  return sendOk(res, await realtimeService.getAgentConfig(), 'Realtime config');
});

export function createSessionHandler(service = realtimeService) {
  return asyncHandler(async (req, res) => {
    const data = await service.createSession(req.user);
    const json = JSON.stringify(data);
    if (process.env.OPENAI_API_KEY && json.includes(process.env.OPENAI_API_KEY)) {
      throw new Error('Refusing to return a session that leaked the API key');
    }
    return sendOk(res, data, 'Realtime session');
  });
}

export const createSession = createSessionHandler();

export const runTool = asyncHandler(async (req, res) => {
  const name = req.body?.name;
  const args = req.body?.arguments || req.body?.args || {};
  const result = await realtimeService.runTool(name, args, req.user);
  logger.info(`realtime tool ${name} ok=${Boolean(result.ok)} user=${req.user?.id || 'n/a'}`);
  return sendOk(res, result, result.ok ? 'Tool executed' : result.error || 'Tool failed');
});
