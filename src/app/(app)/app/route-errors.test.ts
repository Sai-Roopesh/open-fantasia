import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ThreadsError from "@/app/(app)/app/threads/error";
import CharactersError from "@/app/(app)/app/characters/error";
import PersonasError from "@/app/(app)/app/personas/error";
import ProviderSettingsError from "@/app/(app)/app/settings/providers/error";

describe("route error boundaries", () => {
  it("render contextual copy for each major segment", () => {
    const retry = () => {};

    expect(
      renderToStaticMarkup(
        React.createElement(ThreadsError, {
          error: new Error("boom"),
          unstable_retry: retry,
        }),
      ),
    ).toContain("Could not load your thread library");

    expect(
      renderToStaticMarkup(
        React.createElement(CharactersError, {
          error: new Error("boom"),
          unstable_retry: retry,
        }),
      ),
    ).toContain("Could not load your character studio");

    expect(
      renderToStaticMarkup(
        React.createElement(PersonasError, {
          error: new Error("boom"),
          unstable_retry: retry,
        }),
      ),
    ).toContain("Could not load your persona library");

    expect(
      renderToStaticMarkup(
        React.createElement(ProviderSettingsError, {
          error: new Error("boom"),
          unstable_retry: retry,
        }),
      ),
    ).toContain("Could not load your provider lanes");
  });
});
