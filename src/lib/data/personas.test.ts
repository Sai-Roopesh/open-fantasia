import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPersona, setDefaultPersona, upsertPersona } from "@/lib/data/personas";

function createPersonaRow() {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    name: "Watcher",
    identity: "",
    backstory: "",
    voice_style: "",
    goals: "",
    boundaries: "",
    private_notes: "",
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("persona data helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes default persona selection through the RPC", async () => {
    const persona = { ...createPersonaRow(), is_default: true };
    const rpc = vi.fn().mockResolvedValue({ data: [persona], error: null });
    const supabase = { rpc } as never;

    const result = await setDefaultPersona(supabase, persona.user_id, persona.id);

    expect(rpc).toHaveBeenCalledWith("set_default_persona", {
      target_persona_id: persona.id,
      target_user_id: persona.user_id,
    });
    expect(result.is_default).toBe(true);
  });

  it("persists persona edits before promoting a new default", async () => {
    const persona = createPersonaRow();
    const promotedPersona = { ...persona, is_default: true };
    const insertSingle = vi.fn().mockResolvedValue({ data: persona, error: null });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({ single: insertSingle })),
    }));
    const from = vi.fn(() => ({ insert }));
    const rpc = vi.fn().mockResolvedValue({
      data: [promotedPersona],
      error: null,
    });
    const supabase = { from, rpc } as never;

    const result = await upsertPersona(supabase, persona.user_id, {
      name: persona.name,
      is_default: true,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_default: false,
        name: persona.name,
        user_id: persona.user_id,
      }),
    );
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.is_default).toBe(true);
  });

  it("treats the only persona as the default fallback", async () => {
    const persona = createPersonaRow();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const defaultBuilder = {
      select: vi.fn(() => defaultBuilder),
      eq: vi.fn(() => defaultBuilder),
      maybeSingle,
    };

    const listBuilder = {
      select: vi.fn(() => listBuilder),
      eq: vi.fn(() => listBuilder),
      order: vi
        .fn()
        .mockImplementationOnce(() => listBuilder)
        .mockResolvedValueOnce({ data: [persona], error: null }),
    };

    const from = vi
      .fn()
      .mockImplementationOnce(() => defaultBuilder)
      .mockImplementationOnce(() => listBuilder);
    const supabase = { from } as never;

    const result = await getDefaultPersona(supabase, persona.user_id);

    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(result?.id).toBe(persona.id);
  });
});
