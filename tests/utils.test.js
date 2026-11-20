// Chạy bằng: node --test tests/   (Node.js 22 trở lên, không cần npm)
import { test } from 'node:test';
import { cases } from './cases.js';

for (const [name, fn] of cases) test(name, fn);
