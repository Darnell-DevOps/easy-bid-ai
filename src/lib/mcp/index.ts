import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import createClientTool from "./tools/create-client";
import listProposalsTool from "./tools/list-proposals";
import getProposalTool from "./tools/get-proposal";
import listContractsTool from "./tools/list-contracts";
import listLeadsTool from "./tools/list-leads";
import pipelineSummaryTool from "./tools/pipeline-summary";

// Build the OAuth issuer from the project ref (inlined at build time), never
// from SUPABASE_URL — the managed Cloud proxy host would not match the issuer
// published by the discovery document.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "closesync-ai",
  title: "CloseSync AI",
  version: "0.1.0",
  instructions:
    "Tools for CloseSync AI, a proposal, contract and client pipeline app. Every tool acts as the signed-in CloseSync user and only ever sees that user's own data. Use `pipeline_summary` for an overview, `list_clients` / `list_leads` for people, `list_proposals` and `get_proposal` for proposal detail, `list_contracts` for signature status, and `create_client` to add a new client or lead.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    pipelineSummaryTool,
    listClientsTool,
    createClientTool,
    listProposalsTool,
    getProposalTool,
    listContractsTool,
    listLeadsTool,
  ],
});
