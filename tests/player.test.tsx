// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TransportControls, VolumeControl } from "@/components/player/Controls";
import { PlayerProvider, usePlayer } from "@/components/player/PlayerProvider";
import { WaveSeek } from "@/components/player/WaveSeek";
import { NowPlayingMeta } from "@/components/player/PlayerBar";
import { getTracks } from "@/lib/catalog";

const tracks = getTracks(["first-light", "kettle-steam", "open-window"]);

// jsdom has no media pipeline: emulate the parts of HTMLMediaElement we rely on.
beforeAll(() => {
  const proto = window.HTMLMediaElement.prototype;
  Object.defineProperty(proto, "paused", { configurable: true, get(this: HTMLMediaElement & { _p?: boolean }) { return this._p ?? true; } });
  Object.defineProperty(proto, "duration", { configurable: true, get() { return 60; } });
  proto.play = vi.fn(function (this: HTMLMediaElement & { _p?: boolean }) {
    this._p = false;
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  });
  proto.pause = vi.fn(function (this: HTMLMediaElement & { _p?: boolean }) {
    this._p = true;
    this.dispatchEvent(new Event("pause"));
  });
  proto.load = vi.fn();
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(performance.now() + 1000), 0)) as unknown as typeof requestAnimationFrame;
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});

afterEach(cleanup);

let api: ReturnType<typeof usePlayer>;
function Probe() {
  // eslint-disable-next-line react-hooks/globals -- test probe exposing the context
  api = usePlayer();
  return (
    <div>
      <span data-testid="status">{api.status}</span>
      <span data-testid="current">{api.track?.id ?? "none"}</span>
      <span data-testid="queue">{api.queue.tracks.length}</span>
    </div>
  );
}

function setup() {
  return render(
    <PlayerProvider>
      <Probe />
      <NowPlayingMeta />
      <TransportControls />
      <WaveSeek peaks={tracks[0].peaks} />
      <VolumeControl />
    </PlayerProvider>,
  );
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe("player", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts empty and disabled", () => {
    setup();
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  it("plays a queue with real audio sources and toggles pause", async () => {
    setup();
    await act(async () => api.playTracks(tracks, 0, "Test"));
    await flush();
    const audio = document.querySelector("audio")!;
    expect(audio.getAttribute("src")).toBe("/audio/first-light.mp3");
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(screen.getByTestId("status")).toHaveTextContent("playing");
    expect(screen.getByText(tracks[0].title)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByTestId("status")).toHaveTextContent("paused");
  });

  it("switches tracks with next and previous", async () => {
    setup();
    await act(async () => api.playTracks(tracks, 0));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Next track" }));
    await flush();
    expect(screen.getByTestId("current")).toHaveTextContent("kettle-steam");
    expect(document.querySelector("audio")!.getAttribute("src")).toBe("/audio/kettle-steam.mp3");
    fireEvent.click(screen.getByRole("button", { name: "Previous track" }));
    await flush();
    expect(screen.getByTestId("current")).toHaveTextContent("first-light");
  });

  it("seeks via the accessible seek slider", async () => {
    setup();
    await act(async () => api.playTracks(tracks, 0));
    await flush();
    const seek = screen.getByRole("slider", { name: "Seek" });
    fireEvent.change(seek, { target: { value: "42" } });
    expect(document.querySelector("audio")!.currentTime).toBe(42);
  });

  it("changes volume and mutes", async () => {
    setup();
    await act(async () => api.playTracks(tracks, 0));
    await flush();
    const audio = document.querySelector("audio")!;
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "30" } });
    await flush();
    expect(audio.volume).toBeCloseTo(0.3);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    await flush();
    expect(audio.volume).toBe(0);
  });

  it("toggles shuffle and cycles repeat", async () => {
    setup();
    await act(async () => api.playTracks(tracks, 0));
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(screen.getByRole("button", { name: "Shuffle" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Repeat: off/ }));
    expect(screen.getByRole("button", { name: /Repeat: all/ })).toBeInTheDocument();
  });

  it("manages the queue: add, play next, remove, clear", async () => {
    setup();
    await act(async () => api.playTracks(tracks.slice(0, 1), 0));
    await act(async () => api.enqueue(tracks[1]));
    await act(async () => api.playNext(tracks[2]));
    expect(api.queue.order.map((i) => api.queue.tracks[i].id)).toEqual(["first-light", "open-window", "kettle-steam"]);
    await act(async () => api.removeAt(1));
    expect(screen.getByTestId("queue")).toHaveTextContent("2");
    await act(async () => api.clearQueue());
    await flush();
    expect(screen.getByTestId("current")).toHaveTextContent("none");
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
  });

  it("shows an unavailable state instead of pretending a broken file plays", async () => {
    setup();
    await act(async () => api.playTracks(tracks, 0));
    await flush();
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "error", { configurable: true, value: { code: 4 } });
    await act(async () => {
      audio.dispatchEvent(new Event("error"));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByText(/isn't available right now/)).toBeInTheDocument();
  });

  it("stops at the end of the queue rather than looping silently", async () => {
    setup();
    await act(async () => api.playTracks(tracks.slice(0, 1), 0));
    await flush();
    await act(async () => {
      document.querySelector("audio")!.dispatchEvent(new Event("ended"));
    });
    expect(screen.getByTestId("status")).toHaveTextContent("paused");
    expect(screen.getByTestId("current")).toHaveTextContent("first-light");
  });
});
