import SpyInstance = jest.SpyInstance;

export {};

expect.extend({
  toReceiveCall(received: SpyInstance, expected) {
    const args = Array.isArray(expected) ? expected : [expected];

    const callIndex = received.mock.calls.findIndex((t) =>
      this.equals(t, args),
    );

    if (callIndex !== -1) {
      return {
        message: () =>
          `Was called with specified arguments at index ${callIndex}`,
        pass: true,
      };
    }
    return {
      message: () =>
        `Expected: ${this.utils.printExpected(expected)}\nReceived: ${this.utils.printReceived(
          received.mock.calls.map((it, idx) => `${idx + 1}: ${JSON.stringify(it)}`).join("\n"),
        )}\n\n`,
      pass: false,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      toReceiveCall(...args: any[]): CustomMatcherResult;
    }
  }
}
