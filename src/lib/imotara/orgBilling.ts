// src/lib/imotara/orgBilling.ts
// Shared icon/label for an org's billing_type — used by the "Managed by"
// badge in SettingsScreen and PlanSupportQuickPanel, which previously showed
// the identical generic 🏢 badge for every org type (commercial/ngo/edu/govt).

export function orgBillingTypeMeta(billingType: string | null | undefined): { icon: string; label: string | null } {
  switch (billingType) {
    case "ngo":        return { icon: "🤝", label: "NGO" };
    case "edu":        return { icon: "🎓", label: "Education" };
    case "govt":       return { icon: "🏛️", label: "Government" };
    case "commercial": return { icon: "🏢", label: null }; // no extra label — "Company" is the default assumption
    default:           return { icon: "🏢", label: null };
  }
}
