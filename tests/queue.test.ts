import { describe, expect, it } from "vitest";

import * as Q from "@/lib/audio/queue";

import { makeTrack } from "./helpers";

const [a, b, c, d] = ["a", "b", "c", "d"].map((id) => makeTrack(id));
const ids = (s: Q.QueueState) => s.order.map((i) => s.tracks[i].id);

describe("queue", () => {
  it("starts at the requested track and de-duplicates", () => {
    const s = Q.setQueue(Q.emptyQueue, [a, b, b, c], 2);
    expect(s.tracks.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(Q.currentTrack(s)?.id).toBe("b");
  });

  it("advances, stops at the end, and wraps with repeat all", () => {
    let s = Q.setQueue(Q.emptyQueue, [a, b], 0);
    s = Q.next(s)!;
    expect(Q.currentTrack(s)?.id).toBe("b");
    expect(Q.next(s)).toBeNull();
    s = Q.cycleRepeat(s); // all
    expect(Q.currentTrack(Q.next(s)!)?.id).toBe("a");
  });

  it("repeats one track only on auto-advance", () => {
    let s = Q.setQueue(Q.emptyQueue, [a, b], 0);
    s = Q.cycleRepeat(Q.cycleRepeat(s)); // one
    expect(s.repeat).toBe("one");
    expect(Q.currentTrack(Q.next(s, true)!)?.id).toBe("a");
    expect(Q.currentTrack(Q.next(s, false)!)?.id).toBe("b");
  });

  it("goes back, and wraps backwards with repeat all", () => {
    let s = Q.setQueue(Q.emptyQueue, [a, b, c], 1);
    expect(Q.currentTrack(Q.prev(s))?.id).toBe("a");
    s = Q.jumpTo(s, 0);
    expect(Q.currentTrack(Q.prev(s))?.id).toBe("a");
    s = Q.cycleRepeat(s);
    expect(Q.currentTrack(Q.prev(s))?.id).toBe("c");
  });

  it("shuffles without moving the current track, and unshuffles back to order", () => {
    const rng = (() => {
      let x = 0.3;
      return () => (x = (x * 9301 + 49297) % 233280 / 233280);
    })();
    let s = Q.setQueue(Q.emptyQueue, [a, b, c, d], 2);
    s = Q.toggleShuffle(s, rng);
    expect(ids(s)[0]).toBe("c");
    expect([...ids(s)].sort()).toEqual(["a", "b", "c", "d"]);
    s = Q.toggleShuffle(s);
    expect(ids(s)).toEqual(["a", "b", "c", "d"]);
  });

  it("enqueues at the end and plays next after the current track", () => {
    let s = Q.setQueue(Q.emptyQueue, [a, b], 0);
    s = Q.enqueue(s, c);
    expect(ids(s)).toEqual(["a", "b", "c"]);
    s = Q.playNext(s, d);
    expect(ids(s)).toEqual(["a", "d", "b", "c"]);
    expect(Q.upNext(s).map((x) => x.track.id)).toEqual(["d", "b", "c"]);
  });

  it("removes tracks, moving off the current one when it's removed", () => {
    let s = Q.setQueue(Q.emptyQueue, [a, b, c], 1);
    s = Q.removeAt(s, 1);
    expect(s.tracks.map((t) => t.id)).toEqual(["a", "c"]);
    expect(Q.currentTrack(s)?.id).toBe("c");
    s = Q.removeAt(Q.removeAt(s, 0), 0);
    expect(s.tracks).toEqual([]);
    expect(Q.currentTrack(s)).toBeNull();
  });

  it("reorders the up-next list", () => {
    let s = Q.setQueue(Q.emptyQueue, [a, b, c, d], 0);
    s = Q.move(s, 3, 1);
    expect(ids(s)).toEqual(["a", "d", "b", "c"]);
    expect(Q.currentTrack(s)?.id).toBe("a");
  });

  it("handles an empty queue", () => {
    expect(Q.next(Q.emptyQueue)).toBeNull();
    expect(Q.prev(Q.emptyQueue)).toBe(Q.emptyQueue);
    expect(Q.setQueue(Q.emptyQueue, []).current).toBe(-1);
    expect(Q.upNext(Q.emptyQueue)).toEqual([]);
  });
});
