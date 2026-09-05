// UX-17. ConnectScreen showed 26 blocking modals titled exactly "Error" that
// named nothing and explained nothing, in a paid booking and wallet flow.
// They are toasts now.
//
// The property that makes that safe is the fallback: if no Toast is mounted,
// the message goes to Alert instead of vanishing. "Nothing happened and
// nothing was said" is the one outcome worse than a blocking dialog, so it is
// tested first.

const mockAlert = jest.fn();
jest.mock("react-native", () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));

import { showToast, registerToast, __resetToastBus } from "../components/ui/toastBus";

beforeEach(() => {
  mockAlert.mockClear();
  __resetToastBus();
});

describe("a message is never silently swallowed", () => {
  it("falls back to Alert when no Toast is mounted", () => {
    showToast("Couldn't load your transactions. Pull down to retry.");
    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert.mock.calls[0][1]).toBe("Couldn't load your transactions. Pull down to retry.");
  });

  it("the fallback title is not the word 'Error'", () => {
    // The whole point of UX-17: a dialog titled "Error" tells the person
    // nothing. Even the fallback should read like a sentence.
    showToast("Something specific went wrong.");
    expect(mockAlert.mock.calls[0][0]).not.toBe("Error");
  });

  it("still falls back after the screen unmounts", () => {
    const unregister = registerToast(() => {});
    unregister();
    showToast("late failure");
    expect(mockAlert).toHaveBeenCalledTimes(1);
  });
});

describe("when a Toast is mounted", () => {
  it("the message goes to it, not to Alert", () => {
    const shown: Array<[string, string | undefined]> = [];
    registerToast((m, k) => shown.push([m, k]));
    showToast("Couldn't reach Imotara — check your connection and try again.");
    expect(shown).toHaveLength(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it("defaults to the error kind, and passes through others", () => {
    const shown: Array<[string, string | undefined]> = [];
    registerToast((m, k) => shown.push([m, k]));
    showToast("failed");
    showToast("Enter your UPI ID to continue.", "info");
    expect(shown[0][1]).toBe("error");
    expect(shown[1][1]).toBe("info");
  });

  it("unregistering only clears its own handler, not a newer one", () => {
    // Two screens mounting and unmounting out of order must not leave the bus
    // pointing at a dead component or, worse, clear a live one.
    const first: string[] = [];
    const second: string[] = [];
    const unregisterFirst = registerToast((m) => first.push(m));
    registerToast((m) => second.push(m));
    unregisterFirst();
    showToast("hello");
    expect(second).toEqual(["hello"]);
    expect(mockAlert).not.toHaveBeenCalled();
  });
});
