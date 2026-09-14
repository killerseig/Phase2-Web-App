export declare function nextResetAllowance(data: Record<string, unknown>, limit: number, now: number): {
    windowStart: number;
    count: number;
} | null;
export declare function consumePasswordResetAllowance(email: string, ip: string): Promise<boolean>;
//# sourceMappingURL=passwordResetRateLimit.d.ts.map