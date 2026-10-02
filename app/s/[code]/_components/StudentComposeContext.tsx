"use client";

import { createContext } from "react";

export type StudentComposeBridge = (wallId: string) => void;

// The SmartLayer provider and the board CTA intentionally import this shared
// module so they always use the same context identity across reloads.
export const StudentSmartComposeContext = createContext<StudentComposeBridge | null>(null);
