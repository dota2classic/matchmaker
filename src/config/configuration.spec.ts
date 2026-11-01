import configuration from "./configuration";

describe("mirror rollout defaults", () => {
  const keys = [
    "MATCHMAKING_MIRROR_SHADOW_ENABLED",
    "MATCHMAKING_MIRROR_LIVE_ENABLED",
  ];
  const original = keys.map((k) => process.env[k]);
  afterEach(() =>
    keys.forEach((k, i) => {
      if (original[i] === undefined) delete process.env[k];
      else process.env[k] = original[i];
    }),
  );
  it.each([
    [undefined, true],
    ["true", true],
    ["false", false],
  ] as const)("%s -> enabled %s", (value, expected) => {
    keys.forEach((k) => {
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    });
    const config = configuration();
    expect(config.mirrorLive.enabled).toBe(expected);
    expect(config.mirrorShadow.enabled).toBe(expected);
  });
});
