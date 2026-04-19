// backend/lib/eventBus.js
// Pluggable event bus. Default adapter is in-memory (single Node instance).
// To scale horizontally, set EVENT_BUS=redis and provide REDIS_URL — the Redis adapter
// (stubbed below) will fan out publishes across instances.
//
// Public API:
//   bus.publish(topic: string, event: object): Promise<void>
//   bus.subscribe(topic: string, handler: (event) => void): () => void   // returns unsubscribe
//
// Topic conventions:
//   notifications:user:<userId>   — targeted to a single user (one per SSE connection)
//   notifications:branch:<branchId> — broadcast to every user subscribed for that branch

const { EventEmitter } = require("events");

class InMemoryEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    // Node default is 10; a busy branch can easily have more listeners.
    this.emitter.setMaxListeners(0);
  }

  async publish(topic, event) {
    this.emitter.emit(topic, event);
  }

  subscribe(topic, handler) {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }
}

class RedisEventBus {
  // Stub. Wire up when EVENT_BUS=redis. Keep the interface identical to InMemoryEventBus.
  constructor() {
    throw new Error(
      "RedisEventBus not implemented yet. Install ioredis, add REDIS_URL, and fill in publish/subscribe."
    );
  }
}

function createEventBus() {
  const driver = (process.env.EVENT_BUS || "memory").toLowerCase();
  if (driver === "redis") return new RedisEventBus();
  return new InMemoryEventBus();
}

// Export a singleton so every caller shares the same emitter.
const bus = createEventBus();

module.exports = bus;
module.exports.InMemoryEventBus = InMemoryEventBus;
module.exports.RedisEventBus = RedisEventBus;

// Topic helpers — keep string construction centralized so the SSE route and the
// publishers never drift.
module.exports.topics = {
  userNotifications: (userId) => `notifications:user:${userId}`,
  branchNotifications: (branchId) => `notifications:branch:${branchId}`,
};
