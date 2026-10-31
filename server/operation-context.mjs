import { AsyncLocalStorage } from 'node:async_hooks';

// Each hosted tool/HTTP operation gets an isolated copy of its persisted state.
const operations = new AsyncLocalStorage();
export const inOperation = (context, action) => operations.run(context, action);
export const operationContext = () => operations.getStore();
export const sessionMap = (kind, fallback) => operations.getStore()?.sessions.get(kind) ?? fallback;
