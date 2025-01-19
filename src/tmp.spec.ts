describe("fdf", () => {
  it("should amogus", () => {
    const mock: any = jest.fn()
    mock(43);
    mock(42);
    expect(mock).toReceiveCall(42);
  });
});
