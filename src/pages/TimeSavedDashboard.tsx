import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText, Zap, Plus, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MANUAL_MINUTES = 60;
const APP_MINUTES = 5;
const SAVED_PER_PROPOSAL = MANUAL_MINUTES - APP_MINUTES;

function getComparison(totalMinutes: number) {
  if (totalMinutes >= 2400) return "That's over a full work week saved!";
  if (totalMinutes >= 480) return "Equivalent to a full working day saved!";
  if (totalMinutes >= 240) return "You've saved half a working day!";
  if (totalMinutes >= 60) return "You've saved over an hour of manual work!";
  return "Keep creating proposals to save more time!";
}

export default function TimeSavedDashboard() {
  const navigate = useNavigate();
  const [proposalCount, setProposalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { count } = await supabase
        .from("proposals")
        .select("id", { count: "exact", head: true });
      setProposalCount(count || 0);
      setLoading(false);
    })();
  }, []);

  const totalMinutes = proposalCount * SAVED_PER_PROPOSAL;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const manualTotal = proposalCount * MANUAL_MINUTES;
  const appTotal = proposalCount * APP_MINUTES;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Time Saved</h1>
            <p className="text-sm text-muted-foreground mt-1">See how much time you've saved by using the app.</p>
          </div>
          <Button onClick={() => navigate("/dashboard/new")} size="sm">
            <Plus className="w-4 h-4 mr-1" /> New Proposal
          </Button>
        </div>

        {proposalCount === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold text-foreground">No time saved yet</h2>
              <p className="text-muted-foreground">Create your first proposal to start tracking time saved.</p>
              <Button onClick={() => navigate("/dashboard/new")}>
                <Plus className="w-4 h-4 mr-1" /> Create First Proposal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Hero stat */}
            <Card className="border-primary/20">
              <CardContent className="p-6 sm:p-8 text-center space-y-2">
                <Clock className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-4xl sm:text-5xl font-bold text-foreground">
                  {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                </p>
                <p className="text-sm text-muted-foreground">Total time saved</p>
                <p className="text-sm text-primary font-medium">{getComparison(totalMinutes)}</p>
              </CardContent>
            </Card>

            {/* Breakdown cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{proposalCount}</p>
                  <p className="text-xs text-muted-foreground">Proposals created</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{SAVED_PER_PROPOSAL}m</p>
                  <p className="text-xs text-muted-foreground">Saved per proposal</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {Math.round((1 - APP_MINUTES / MANUAL_MINUTES) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Faster than manual</p>
                </CardContent>
              </Card>
            </div>

            {/* Comparison */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Time Comparison</h2>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Manual work</span>
                      <span className="text-foreground font-medium">
                        {Math.floor(manualTotal / 60)}h {manualTotal % 60}m
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-destructive/60" style={{ width: "100%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">With this app</span>
                      <span className="text-foreground font-medium">
                        {Math.floor(appTotal / 60)}h {appTotal % 60}m
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((APP_MINUTES / MANUAL_MINUTES) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
