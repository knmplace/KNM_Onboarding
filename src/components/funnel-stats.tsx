"use client";

interface FunnelStatsProps {
  counts: {
    pending_approval: number;
    awaiting_password_change: number;
    completed: number;
    total: number;
  };
}

export function FunnelStats({ counts }: FunnelStatsProps) {
  const steps = [
    {
      label: "Pending Approval",
      count: counts.pending_approval,
      color: "bg-amber-100 text-amber-800 border-amber-200",
    },
    {
      label: "Awaiting Password",
      count: counts.awaiting_password_change,
      color: "bg-blue-100 text-blue-800 border-blue-200",
    },
    {
      label: "Completed",
      count: counts.completed,
      color: "bg-green-100 text-green-800 border-green-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
      <div className="theme-card p-4">
        <p className="text-sm theme-text-muted">Total Users</p>
        <p className="text-2xl font-bold">{counts.total}</p>
      </div>
      {steps.map((step) => (
        <div
          key={step.label}
          className={`rounded-lg border p-4 ${step.color}`}
        >
          <p className="text-sm opacity-75">{step.label}</p>
          <p className="text-2xl font-bold">{step.count}</p>
        </div>
      ))}
    </div>
  );
}
