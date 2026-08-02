/**
 * Atomic inside one JavaScript process only. It intentionally never expires or
 * releases a consumed payment. Multi-worker and production deployments must use
 * a durable shared store implementing the same atomic consume-once contract.
 */
export class InMemoryRedemptionStore {
    records = new Map();
    consumeOnce(record) {
        if (this.records.has(record.key))
            return "duplicate";
        this.records.set(record.key, Object.freeze({ ...record }));
        return "consumed";
    }
    has(key) {
        return this.records.has(key);
    }
    get(key) {
        return this.records.get(key);
    }
}
