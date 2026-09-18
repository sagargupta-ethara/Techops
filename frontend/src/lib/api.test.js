describe("API base URL", () => {
  const loadBaseUrl = () => {
    jest.resetModules();
    return require("./api").API_BASE_URL;
  };

  afterEach(() => {
    delete process.env.REACT_APP_BACKEND_URL;
  });

  it("uses the same origin when no backend URL is configured", () => {
    delete process.env.REACT_APP_BACKEND_URL;

    expect(loadBaseUrl()).toBe("/api");
  });

  it("supports a separate backend URL without a duplicate slash", () => {
    process.env.REACT_APP_BACKEND_URL = "https://api.example.com/";

    expect(loadBaseUrl()).toBe("https://api.example.com/api");
  });
});
