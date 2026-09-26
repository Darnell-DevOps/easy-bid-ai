import { describe, expect, it } from "vitest";
import { clientListAction } from "@/lib/client-list-action";

describe("client list next action", () => {
  const newClient = { status: "New", lead_quality: null };

  it("starts a proposal only when the client has no existing proposal", () => {
    expect(clientListAction(newClient)).toBe("Create Proposal");
    expect(clientListAction(newClient, { id: "draft-1", status: "draft" })).toBe("Review Draft");
    expect(clientListAction(newClient, { id: "sent-1", status: "sent" })).toBe("View Client");
  });

  it("preserves qualification and completed-client actions", () => {
    expect(clientListAction({ status: "New", lead_quality: "Low" })).toBe("Qualify Lead");
    expect(clientListAction({ status: "Won", lead_quality: null })).toBe("View Client");
    expect(clientListAction({ status: "Lost", lead_quality: null })).toBe("View Client");
    expect(clientListAction({ status: "Proposal Sent", lead_quality: null })).toBe("View Client");
  });
});
