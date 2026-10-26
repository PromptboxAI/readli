import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("next/image", () => ({ default: (p: { alt: string }) => <span role="img" aria-label={p.alt} /> }));

import { InviteComposer } from "./InviteComposer";
import { PreviewPicker, type PickerBook } from "./PreviewPicker";

const book = (slug: string, title: string, passages: string[]): PickerBook => ({ slug, title, author: "", coverUrl: `/covers/${slug}.webp`, passages: passages.map((text, i) => ({ id: `${slug}-${i + 1}`, text })) });
const books = [
  book("alice", "Alice", ["Alice was beginning to get very tired."]),
  book("winnie-the-pooh", "Winnie-the-Pooh", ["A much longer passage about Edward Bear coming downstairs, bump, bump, bump.", "Pooh, short."]),
  book("the-tale-of-peter-rabbit", "Peter Rabbit", ["Once upon a time there were four little Rabbits."]),
  book("the-velveteen-rabbit", "The Velveteen Rabbit", ["There was once a velveteen rabbit."]),
];
const featured = ["winnie-the-pooh", "the-tale-of-peter-rabbit", "the-velveteen-rabbit"];
let posted: { url: string; body: Record<string, unknown> }[] = [];
let reply: (url: string) => { status: number; body: unknown } = () => ({ status: 200, body: {} });

beforeEach(() => {
  posted = [];
  reply = () => ({ status: 200, body: {} });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      posted.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      const r = reply(url);
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("choosing the story families hear", () => {
  it("makes the recommended book's shortest passage on arrival, then approves and goes on to the form", async () => {
    const { rerender } = render(<PreviewPicker books={books} featured={featured} approved={null} draft={null} sendHref="/voice/invite?step=send" />);
    await waitFor(() => expect(posted[0]).toEqual({ url: "/api/invitations/preview", body: { passageId: "winnie-the-pooh-2" } }));
    expect(screen.getAllByRole("button", { pressed: true })[0]!.textContent).toBe("Recommended");
    expect(screen.queryByText("Read this one instead")).toBeNull();
    rerender(<PreviewPicker books={books} featured={featured} approved={null} draft={{ id: "d1", book: "winnie-the-pooh", passageId: "winnie-the-pooh-2" }} sendHref="/voice/invite?step=send" />);
    expect(screen.getByRole("button", { name: "Play Hear yourself read Winnie-the-Pooh" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve This Preview" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/voice/invite?step=send"));
    expect(posted.at(-1)).toEqual({ url: "/api/invitations/preview/approve", body: { previewId: "d1" } });
  });

  it("reuses an approved preview without making a new one", async () => {
    render(<PreviewPicker books={books} featured={featured} approved={{ id: "a1", book: "the-velveteen-rabbit", passageId: "the-velveteen-rabbit-1" }} draft={null} sendHref="/s" />);
    fireEvent.click(screen.getByRole("button", { name: "Use This Preview" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/s"));
    expect(posted).toEqual([]);
  });

  it("opens every story with Choose Another Story, and only makes one when asked", async () => {
    render(<PreviewPicker books={books} featured={featured} approved={{ id: "a1", book: "winnie-the-pooh", passageId: "winnie-the-pooh-2" }} draft={null} sendHref="/s" />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Another Story" }));
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
    expect(screen.getByRole("button", { name: "Approve This Preview" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Hear it in my voice" }));
    await waitFor(() => expect(posted).toEqual([{ url: "/api/invitations/preview", body: { passageId: "alice-1" } }]));
  });
});

describe("sending the invitation", () => {
  const props = {
    maxPerSend: 10,
    linkDays: 14,
    shareConsent: "I agree to share.",
    adultsConsent: "Everyone is an adult.",
    disabled: null,
    preview: { id: "a1", title: "Winnie-the-Pooh", coverUrl: null },
    changeHref: "/voice/invite?step=story",
    sentHref: "/voice/invite?step=sent",
  };

  it("needs only an email and one agreement, sends both statements, then shows the sent screen", async () => {
    reply = () => ({ status: 200, body: { results: [{ email: "sara@example.com", name: "", result: "created" }] } });
    render(<InviteComposer {...props} />);
    expect(screen.getAllByTestId("recipient")).toHaveLength(1);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox").parentElement!.textContent).toContain("Everyone is an adult. I agree to share.");
    fireEvent.change(screen.getByLabelText("Their email"), { target: { value: "sara@example.com" } });
    const send = screen.getByRole("button", { name: "Send Invitation" });
    expect(send).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(send);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/voice/invite?step=sent"));
    expect(posted[0]!.body).toEqual({ recipients: [{ name: "", relationship: "", email: "sara@example.com" }], message: "", adultsConfirmed: true, shareConsent: true });
  });

  it("adds more families on request, and stays put saying why when nobody could be invited", async () => {
    reply = () => ({ status: 200, body: { results: [{ email: "a@example.com", name: "", result: "suppressed" }] } });
    render(<InviteComposer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add another family" }));
    expect(screen.getAllByTestId("recipient")).toHaveLength(2);
    fireEvent.change(screen.getAllByLabelText("Their email")[0]!, { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send Invitation" }));
    expect(await screen.findByTestId("send-results")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
