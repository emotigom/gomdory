import * as React from 'react';
export const Canvas: React.FC<React.PropsWithChildren<Record<string, unknown>>>;
export function useFrame(...args: unknown[]): void;
export function useThree<T = { camera: unknown; scene: unknown; gl: unknown }>(): T;
