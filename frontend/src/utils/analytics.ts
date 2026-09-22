export function trackEvent(eventType: string, trainerType?: string, isCorrect?: boolean): void {
  try {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, trainerType, isCorrect }),
    }).catch(() => {});
  } catch (e) {
    // Non-blocking
  }
}
