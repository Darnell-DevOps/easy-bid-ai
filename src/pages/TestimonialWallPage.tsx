import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Quote } from "lucide-react";

type Item = {
  id: string;
  client_name: string;
  company?: string | null;
  role_title?: string | null;
  rating?: number | null;
  content: string;
  is_featured: boolean;
};

export default function TestimonialWallPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("testimonial_wall_get", { _slug: slug! });
      if (!error) setData(data);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-muted-foreground">Loading…</p></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p>Not found.</p></div>;

  const items: Item[] = data.testimonials || [];
  const avg = items.filter(i => i.rating).reduce((a, i) => a + (i.rating || 0), 0) / (items.filter(i => i.rating).length || 1);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        <header className="text-center space-y-4 mb-12">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">{data.headline || "What clients say"}</h1>
          {data.intro && <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">{data.intro}</p>}
          {items.length > 0 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="flex">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-5 h-5 ${avg >= i - 0.5 ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{avg.toFixed(1)} · {items.length} review{items.length === 1 ? "" : "s"}</span>
            </div>
          )}
          {data.google_review_url && (
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <a href={data.google_review_url} target="_blank" rel="noreferrer">
                  Leave a Google review <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              </Button>
            </div>
          )}
        </header>

        {items.length === 0 ? (
          <p className="text-center text-muted-foreground">No testimonials yet.</p>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-5 space-y-5">
            {items.map(t => (
              <Card key={t.id} className={`break-inside-avoid ${t.is_featured ? "ring-1 ring-primary/20" : ""}`}>
                <CardContent className="p-6 space-y-3">
                  <Quote className="w-5 h-5 text-muted-foreground/40" />
                  {t.rating && (
                    <div className="flex">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`w-4 h-4 ${(t.rating || 0) >= i ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed">{t.content}</p>
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    <span className="font-medium text-foreground">{t.client_name}</span>
                    {t.role_title && <span> · {t.role_title}</span>}
                    {t.company && <span> · {t.company}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
