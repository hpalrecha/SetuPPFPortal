import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Landmark } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface BillingEntity {
  key: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan?: string;
  invoicePrefix: string;
  effectiveFrom: string | null;
}

export interface BillingEntitiesResponse {
  entities: BillingEntity[];
  source: "settings" | "defaults";
  currentDefaultKey: string;
  invoiceFormatHint: string;
  updatedAt?: string | null;
}

export const BILLING_ENTITIES_QUERY_KEY = ["/api/settings/billing-entities"];

/** apiRequest throws "400: {\"error\":\"...\"}" — pull out the server's message. */
export function apiErrorMessage(error: any, fallback: string): string {
  const raw = String(error?.message || "");
  const body = raw.replace(/^\d{3}:\s*/, "");
  try {
    const parsed = JSON.parse(body);
    return parsed?.error || parsed?.message || fallback;
  } catch {
    return body || fallback;
  }
}

const FIELDS: { field: keyof BillingEntity; label: string; placeholder?: string; span?: boolean }[] = [
  { field: "name", label: "Legal name", span: true },
  { field: "addressLine1", label: "Address", span: true },
  { field: "city", label: "City" },
  { field: "state", label: "State" },
  { field: "pincode", label: "Pincode" },
  { field: "gstin", label: "GSTIN", placeholder: "e.g. 29ABCDE1234F1Z5" },
  { field: "pan", label: "PAN", placeholder: "e.g. ABCDE1234F" },
  { field: "invoicePrefix", label: "Invoice prefix", placeholder: "e.g. ST or P91TFPL" },
];

export function BillingEntitiesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BillingEntity[]>([]);

  const { data, isLoading, isError, error, refetch } = useQuery<BillingEntitiesResponse>({ queryKey: BILLING_ENTITIES_QUERY_KEY });

  useEffect(() => {
    if (data?.entities) setDraft(data.entities.map((e) => ({ ...e, pan: e.pan || "" })));
  }, [data]);

  const save = useMutation({
    mutationFn: async (entities: BillingEntity[]) => {
      const res = await apiRequest("PUT", "/api/settings/billing-entities", {
        entities: entities.map((e) => ({ ...e, effectiveFrom: e.effectiveFrom || null })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BILLING_ENTITIES_QUERY_KEY });
      toast({ title: "Saved", description: "Billing entities updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: apiErrorMessage(error, "Failed to save billing entities"), variant: "destructive" });
    },
  });

  const update = (i: number, field: keyof BillingEntity, value: string) =>
    setDraft((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          Billing Entities
        </CardTitle>
        <CardDescription>
          Company that appears as "Bill From" when the partner does not bill directly. New work orders use the entity
          with the latest effective-from date on or before today; existing work orders keep the company they were
          created with. The invoice-number prefix (ERPNext naming series) decides which company issued an invoice
          entered at settlement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : isError || !data?.entities ? (
          // Most often: the server was not restarted after deploy, so this route doesn't exist yet.
          <div className="space-y-2" data-testid="billing-entities-error">
            <p className="text-sm text-destructive">
              Could not load billing entities{isError ? `: ${apiErrorMessage(error, "request failed")}` : "."}
            </p>
            <p className="text-xs text-muted-foreground">
              If this is right after an update, restart the server so the new settings API is available.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-billing-entities">
              Retry
            </Button>
          </div>
        ) : (
          <>
            {data?.source === "defaults" && (
              <p className="text-xs text-muted-foreground">Showing built-in defaults — nothing saved yet.</p>
            )}
            {draft.map((entity, i) => (
              <div key={entity.key} className="rounded-lg border p-4 space-y-3" data-testid={`billing-entity-${entity.key}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entity.name || entity.key}</span>
                  <Badge variant="outline" className="font-mono text-xs">{entity.invoicePrefix || "?"}/&lt;n&gt;/&lt;YY-YY&gt;</Badge>
                  {data?.currentDefaultKey === entity.key && <Badge>Current default</Badge>}
                  {(!entity.gstin || !entity.addressLine1) && (
                    <Badge variant="destructive">GSTIN / address missing</Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {FIELDS.map(({ field, label, placeholder, span }) => (
                    <div key={field} className={`space-y-1 ${span ? "md:col-span-3" : ""}`}>
                      <Label htmlFor={`be-${entity.key}-${field}`}>{label}</Label>
                      <Input
                        id={`be-${entity.key}-${field}`}
                        value={(entity[field] as string) || ""}
                        placeholder={placeholder}
                        onChange={(e) => update(i, field, e.target.value)}
                        data-testid={`input-billing-${entity.key}-${field}`}
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label htmlFor={`be-${entity.key}-effectiveFrom`}>Effective from (cutover date)</Label>
                    <Input
                      id={`be-${entity.key}-effectiveFrom`}
                      type="date"
                      value={entity.effectiveFrom || ""}
                      onChange={(e) => update(i, "effectiveFrom", e.target.value)}
                      data-testid={`input-billing-${entity.key}-effectiveFrom`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Blank = baseline only (never overrides a dated entity).
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={() => save.mutate(draft)} disabled={save.isPending} data-testid="button-save-billing-entities">
              {save.isPending ? "Saving..." : "Save Billing Entities"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
