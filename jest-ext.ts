import SpyInstance = jest.SpyInstance;

export {};
import "jest-extended";

expect.extend({
  toReceiveCall(received: SpyInstance, expected) {
    const callIndex = received.mock.calls.findIndex((t) =>
      this.equals(t[0], expected),
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
          received.mock.calls
            .map(
              (it, idx) =>
                `\n${idx + 1}: ${it[0].constructor.name} ${JSON.stringify(it[0])}`,
            )
            // .map((it, idx) => `\n${idx + 1}: ${it[0]}`)
            .join(""),
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
