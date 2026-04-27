import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AIInsight, InsightEntityType, InsightKind, isInsightStale } from "@/lib/ai-coach";

interface UseAIInsightOptions {
  entityType: InsightEntityType;
  entityId?: string | null;
  kind: InsightKind;
  /** Edge function name to call when generating/regenerating */
  functionName: string;
  /** Body to pass when invoking the edge function */
  payload?: Record<string, any>;
  /** Set to false to skip auto-generate (manual trigger only — e.g. proposal audit) */
  autoGenerate?: boolean;
  /** Skip everything until this is true (e.g. waiting for parent data) */
  enabled?: boolean;
}

interface UseAIInsightResult {
  insight: AIInsight | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAIInsight(options: UseAIInsightOptions): UseAIInsightResult {
  const {
    entityType,
    entityId = null,
    kind,
    functionName,
    payload,
    autoGenerate = true,
    enabled = true,
  } = options;

  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasGeneratedRef = useRef(false);

  const fetchInsight = useCallback(async () => {
    let q = supabase
      .from("ai_insights")
      .select("*")
      .eq("entity_type", entityType)
      .eq("kind", kind)
      .is("dismissed_at", null)
      .order("generated_at", { ascending: false })
      .limit(1);
    if (entityId) {
      q = q.eq("entity_id", entityId);
    } else {
      q = q.is("entity_id", null);
    }
    const { data, error: fetchError } = await q.maybeSingle();
    if (fetchError) {
      setError(fetchError.message);
      return null;
    }
    return (data as unknown as AIInsight) || null;
  }, [entityType, entityId, kind]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(functionName, {
        body: payload ?? {},
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const fresh = await fetchInsight();
      setInsight(fresh);
    } catch (e: any) {
      setError(e?.message || "Failed to generate insight");
    } finally {
      setGenerating(false);
    }
  }, [functionName, payload, fetchInsight]);

  const refresh = useCallback(async () => {
    await generate();
  }, [generate]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cached = await fetchInsight();
      if (cancelled) return;
      setInsight(cached);
      setLoading(false);
      if (autoGenerate && !hasGeneratedRef.current && isInsightStale(cached, kind)) {
        hasGeneratedRef.current = true;
        await generate();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchInsight, autoGenerate, kind, generate]);

  return { insight, loading, generating, error, refresh };
}
