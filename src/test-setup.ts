// Register jest-dom's DOM matchers (toBeInTheDocument, toHaveStyle, …).
// In Vitest 5 the global `expect` (globals: true) is a different instance from the one imported
// from 'vitest', so the matchers go on both; otherwise tests using the global one fail.
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);
(globalThis as unknown as { expect?: typeof expect }).expect?.extend(matchers);
