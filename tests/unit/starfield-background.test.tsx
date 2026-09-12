import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StarfieldBackground } from "../../components/brand/starfield-background";

describe("StarfieldBackground", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps one animation scheduled through resize and cancels it on unmount", () => {
    const scheduled = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const frame = ++nextFrame;
      scheduled.set(frame, callback);
      return frame;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((frame: number) => {
      scheduled.delete(frame);
    }));
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { unmount } = render(<StarfieldBackground />);
    expect(scheduled.size).toBe(1);

    act(() => window.dispatchEvent(new Event("resize")));
    expect(scheduled.size).toBe(1);

    unmount();
    expect(scheduled.size).toBe(0);
  });

  it("honors reduced motion by drawing once without scheduling animation", () => {
    const request = vi.fn();
    vi.stubGlobal("requestAnimationFrame", request);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const context = {
      arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);

    const { unmount } = render(<StarfieldBackground density={0.2} />);
    expect(request).not.toHaveBeenCalled();
    expect(context.clearRect).toHaveBeenCalled();
    unmount();
  });

  it("moves stars toward the viewer while the animation runs", () => {
    const scheduled = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const frame = ++nextFrame;
      scheduled.set(frame, callback);
      return frame;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const arc = vi.fn();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      arc, beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const { unmount } = render(<StarfieldBackground density={0.2} />);
    const first = scheduled.get(1)!;
    act(() => first(0));
    const firstRadius = arc.mock.calls[0][2];
    const second = scheduled.get(2)!;
    act(() => second(1000));
    const secondRadius = arc.mock.calls[arc.mock.calls.length / 2][2];
    expect(secondRadius).toBeGreaterThan(firstRadius);
    unmount();
  });
});
