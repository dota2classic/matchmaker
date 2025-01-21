describe("fdf", () => {
  it("should amogus", () => {
    const mock: any = jest.fn()
    mock(43);
    mock(42);
    expect(mock).toReceiveCall(42);
  });

  it("should fdf", () => {
    const mock = jest.fn((v: number) => v * 2)


    expect(mock(42)).toEqual(84)

  });
});
