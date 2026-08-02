function freezeResponse(response) {
    return Object.freeze({ ...response });
}
function freezeExecuting(record, executionId, startedAt) {
    return Object.freeze({
        key: record.key,
        proofDigest: record.proofDigest,
        payment: Object.freeze({ ...record.payment }),
        executionId,
        startedAt,
        state: "executing",
    });
}
/** Process-local reference store. Production and restart drills need a durable shared store. */
export class InMemoryBoundRedemptionStore {
    records = new Map();
    lookup(key, proofDigest) {
        const record = this.records.get(key);
        if (!record)
            return { kind: "missing" };
        if (record.proofDigest !== proofDigest)
            return { kind: "conflict" };
        return { kind: record.state, record };
    }
    claim(record, executionId, startedAt) {
        const existing = this.records.get(record.key);
        if (existing) {
            if (existing.proofDigest !== record.proofDigest)
                return { kind: "conflict" };
            return { kind: existing.state, record: existing };
        }
        const claimed = freezeExecuting(record, executionId, startedAt);
        this.records.set(record.key, claimed);
        return { kind: "claimed", record: claimed };
    }
    complete(completion) {
        const existing = this.records.get(completion.key);
        if (!existing
            || existing.proofDigest !== completion.proofDigest
            || existing.executionId !== completion.executionId) {
            return { kind: "conflict" };
        }
        if (existing.state === "completed") {
            const same = existing.response.status === completion.response.status
                && existing.response.contentType === completion.response.contentType
                && existing.response.bodyBase64 === completion.response.bodyBase64
                && existing.response.bodySha256 === completion.response.bodySha256;
            return same ? { kind: "completed", record: existing } : { kind: "conflict" };
        }
        const completed = Object.freeze({
            ...existing,
            state: "completed",
            response: freezeResponse(completion.response),
        });
        this.records.set(completion.key, completed);
        return { kind: "completed", record: completed };
    }
    get(key) {
        return this.records.get(key);
    }
}
