import { describe, it, expect } from "vitest";
import { nextQueuedEdit, type PendingEdit } from "../apps/web/src/offline.ts";
const edit = (id: string, itemId: string, conflict?: string): PendingEdit => ({
  operationId: id,
  itemId,
  version: 1,
  patch: { purchased: true },
  label: itemId,
  conflict,
});
describe("independent offline shopping edits", () => {
  it("continues another item while preserving the order of a conflicted item", () => {
    const queue = [
      edit("a", "milk", "Review a concurrent edit"),
      edit("b", "milk"),
      edit("c", "beef"),
    ];
    expect(nextQueuedEdit(queue)?.operationId).toBe("c");
    expect(queue).toHaveLength(3);
  });
  it("keeps edits to the same item ordered and pauses if all require review", () => {
    expect(
      nextQueuedEdit([edit("a", "milk"), edit("b", "milk")])?.operationId,
    ).toBe("a");
    expect(
      nextQueuedEdit([edit("a", "milk", "Conflict"), edit("b", "milk")]),
    ).toBeUndefined();
    expect(nextQueuedEdit([])).toBeUndefined();
  });
});
