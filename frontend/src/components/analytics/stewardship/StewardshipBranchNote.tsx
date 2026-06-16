"use client";

import Card from "@/src/components/ui/Card";

export default function StewardshipBranchNote() {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">
        Offerings are church-wide and not shown per branch yet. Donations and
        pledges are scoped to members in the selected branch.
      </p>
    </Card>
  );
}
