class SessionTracker {
  private currentSessionId: string | undefined;

  setSessionId(id: string): void {
    this.currentSessionId = id;
  }

  getSessionId(): string | undefined {
    return this.currentSessionId;
  }

  clearSessionId(): void {
    this.currentSessionId = undefined;
  }
}

export const sessionTracker = new SessionTracker();
export { SessionTracker };
