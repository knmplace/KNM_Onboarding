"use client";

export interface OnboardingUser {
  id: number;
  siteId?: number | null;
  wordpressId: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  onboardingStep: string;
  rmUserStatus: number | null;
  activatedAt: string | null;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  emailValid: boolean | null;
  emailQualityScore: number | null;
  emailDeliverable: boolean | null;
  emailIsDisposable: boolean | null;
  emailIsFreeEmail: boolean | null;
  emailIsCatchAll: boolean | null;
  emailIsBreached: boolean | null;
  emailValidatedAt: string | null;
  emailValidationRaw: unknown;
  pendingBreachAlert: boolean;
  breachAlertSentAt: string | null;
  breachAlertLastError: string | null;
  breachNotificationSentAt: string | null;
  breachNotificationCount: number;
  initialPasswordHash: string | null;
  adminNotifiedAt: string | null;
  passwordReminderSentAt: string | null;
  passwordReminderCount: number;
  lastReminderSentAt: string | null;
  reminderCount: number;
  reminderHistory: Array<{
    sentAt: string;
    type: "no_login" | "logged_in";
  }> | null;
  congratsSentAt: string | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  deactivationEmailSentAt: string | null;
  profileUrl: string | null;
  deletedFromWp: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  site?: {
    id: number;
    slug: string;
    name: string;
  } | null;
}

interface UsersTableProps {
  users: OnboardingUser[];
  onSelectUser: (user: OnboardingUser) => void;
  showSiteColumn?: boolean;
  selectedUserIds?: number[];
  onToggleSelectUser?: (userId: number, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean) => void;
}

function StepBadge({ step }: { step: string }) {
  const styles: Record<string, string> = {
    pending_approval: "bg-amber-100 text-amber-700",
    awaiting_password_change: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${styles[step] || "bg-gray-100 text-gray-600"}`}
    >
      {step.replace(/_/g, " ")}
    </span>
  );
}

function EmailStatus({ user }: { user: OnboardingUser }) {
  if (!user.emailValidatedAt) {
    return <span className="text-gray-400 text-xs">Not validated</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-block w-2 h-2 rounded-full ${user.emailValid ? "bg-green-500" : "bg-red-500"}`}
      />
      <span className="text-xs">
        {user.emailQualityScore !== null
          ? `${(user.emailQualityScore * 100).toFixed(0)}%`
          : "—"}
      </span>
      {user.emailIsBreached && (
        <span className="text-xs text-red-600 font-medium">BREACH</span>
      )}
      {user.emailIsDisposable && (
        <span className="text-xs text-orange-600 font-medium">DISP</span>
      )}
    </div>
  );
}

export function UsersTable({
  users,
  onSelectUser,
  showSiteColumn = false,
  selectedUserIds = [],
  onToggleSelectUser,
  onToggleSelectAll,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No users found. Sync from ProfileGrid to get started.
      </div>
    );
  }

  const allSelected =
    users.length > 0 && users.every((user) => selectedUserIds.includes(user.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 px-3 font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                aria-label="Select all visible users"
              />
            </th>
            <th className="py-2 px-3 font-medium">Name</th>
            <th className="py-2 px-3 font-medium">Email</th>
            {showSiteColumn && <th className="py-2 px-3 font-medium">Site</th>}
            <th className="py-2 px-3 font-medium">Step</th>
            <th className="py-2 px-3 font-medium">Email Status</th>
            <th className="py-2 px-3 font-medium">PG Status</th>
            <th className="py-2 px-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              onClick={() => onSelectUser(user)}
              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            >
              <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  onChange={(e) =>
                    onToggleSelectUser?.(user.id, e.target.checked)
                  }
                  aria-label={`Select ${user.displayName || user.email}`}
                />
              </td>
              <td className="py-2 px-3">
                {user.displayName ||
                  `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                  "—"}
              </td>
              <td className="py-2 px-3 text-gray-600">{user.email}</td>
              {showSiteColumn && (
                <td className="py-2 px-3 text-gray-600">
                  {user.site?.name || user.site?.slug || "Unknown"}
                </td>
              )}
              <td className="py-2 px-3">
                <StepBadge step={user.onboardingStep} />
              </td>
              <td className="py-2 px-3">
                <EmailStatus user={user} />
              </td>
              <td className="py-2 px-3">
                <span
                  className={`text-xs ${user.rmUserStatus === 0 ? "text-green-600" : "text-amber-600"}`}
                >
                  {user.rmUserStatus === 0 ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400 text-xs">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
