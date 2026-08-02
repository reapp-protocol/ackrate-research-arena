/** Single-process test/development store. Production must use durable atomic storage. */
export class InMemoryAp2ReplayStore {
    #consumed = new Set();
    consumeOnce(record) {
        if (this.#consumed.has(record.key))
            return "duplicate";
        this.#consumed.add(record.key);
        return "consumed";
    }
    get size() {
        return this.#consumed.size;
    }
}
