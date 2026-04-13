import {
  getLatestImportText,
  hasImportText,
  validatePortableImport,
} from "@/components/forms/json-portability-panel-helpers";

describe("json portability panel helpers", () => {
  it("prefers the live textarea value over stale state during validation", () => {
    expect(getLatestImportText("", "{\"format\":\"openfantasia.persona\"}")).toBe(
      "{\"format\":\"openfantasia.persona\"}",
    );
  });

  it("reports whether there is any import text to work with", () => {
    expect(hasImportText("   \n")).toBe(false);
    expect(hasImportText("{\"format\":\"openfantasia.character\"}")).toBe(true);
  });

  it("validates a complete persona document", () => {
    const result = validatePortableImport(
      "persona",
      JSON.stringify({
        format: "openfantasia.persona",
        version: 1,
        data: {
          name: "Night Shift",
          identity: "A version of me that stays calm",
          backstory: "",
          voice_style: "",
          goals: "",
          boundaries: "",
          private_notes: "",
        },
      }),
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected persona document to validate");
    }

    expect(result.data.name).toBe("Night Shift");
  });

  it("returns a focused schema error for malformed character data", () => {
    const result = validatePortableImport(
      "character",
      JSON.stringify({
        format: "openfantasia.character",
        version: 3,
        data: {
          name: "Captain Mirelle",
          appearance: "",
        },
      }),
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected character document to fail validation");
    }

    expect(result.message).toContain("Open-Fantasia schema");
  });

  it("returns a JSON syntax error when the pasted payload is malformed", () => {
    const result = validatePortableImport(
      "persona",
      '{"format":"openfantasia.persona","version":1,"data":',
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected malformed JSON to fail validation");
    }

    expect(result.message).toContain("malformed");
  });
});
