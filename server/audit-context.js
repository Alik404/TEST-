import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

const requests = new AsyncLocalStorage();
export const auditContext = (req, res, next) => {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  requests.run({ request_id: requestId }, next);
};
export const identifyActor = (user) => {
  const context = requests.getStore();
  if (context) context.actor = { id: String(user.id), name: user.name, role: user.role };
};
export const auditActor = () => ({
  ...(requests.getStore()?.actor || { id: null, name: 'النظام', role: 'system' }),
  request_id: requests.getStore()?.request_id || crypto.randomUUID(),
});

export function redactAudit(value) {
  if (Array.isArray(value)) return value.map(redactAudit);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['password', 'session_version', 'token', 'secret', 'media_data'].includes(key))
      .map(([key, item]) => [key, key === 'site_images' ? { count: Array.isArray(item) ? item.length : 0 } : redactAudit(item)]));
  }
  return typeof value === 'string' && value.startsWith('data:') ? '[attachment omitted]' : value;
}

export const cloudMutation = async (client, table, action, data, id = null, expected = null) => {
  const { cloudResult } = await import('./persistence.js');
  const result = await cloudResult(client.rpc('app_mutate_record', {
    p_table: table, p_action: action, p_data: data || {}, p_id: id == null ? null : String(id),
    p_actor: auditActor(), p_expected: expected,
  }));
  return result;
};
