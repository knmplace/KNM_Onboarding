"use client";

import { OnboardingUser } from "./users-table";

interface UserDetailPanelProps {
  user: OnboardingUser;
  onClose: () => void;
  onAction: (userId: number, action: string) => void;
  onOverride: (userId: number, step: string) => void;
  onValidateEmail: (userId: number) => void;
  onRunReminderTest: (userId: number) => void;
}

function Badge({
  value,
  trueLabel,
  falseLabel,
  invert,
}: {
  value: boolean | null;
  trueLabel: string;
  falseLabel: string;
  invert?: boolean;
}) {
  if (value === null || value === undefined)
    return <span className="text-gray-400 text-sm">N/A</span>;
  const isGood = invert ? !value : value;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        isGood
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}

export function UserDetailPanel({
  user,
  onClose,
  onAction,
  onOverride,
  onValidateEmail,
  onRunReminderTest,
}: UserDetailPanelProps) {
  const reminderHistory = Array.isArray(user.reminderHistory)
    ? [...user.reminderHistory].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      )
    : [];

  const reminderCadence =
    user.onboardingStep === "awaiting_password_change"
      ? user.firstLoginAt || user.lastLoginAt
        ? "14 days (login detected)"
        : "5 days (no login detected)"
      : "N/A";

  const handleDisable = () => {
    if (!confirm("Disable this user on the remote site and reset onboarding to pending approval?")) {
      return;
    }
    onAction(user.id, "disable");
  };

  const handleDelete = () => {
    if (
      !confirm(
        "Delete this user from the remote WordPress/ProfileGrid site and archive locally? This is irreversible."
      )
    ) {
      return;
    }
    onAction(user.id, "delete_remote_and_archive");
  };

  const handleReminderTest = () => {
    if (
      !confirm(
        "Send a live reminder test email now for this user? This does not change cadence counters."
      )
    ) {
      return;
    }
    onRunReminderTest(user.id);
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex justify-end z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white shadow-xl h-full overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">User Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* User Info */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Profile</h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-500">Name:</span>{" "}
                {user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "—"}
              </p>
              <p>
                <span className="text-gray-500">Email:</span> {user.email}
              </p>
              <p>
                <span className="text-gray-500">WP ID:</span>{" "}
                {user.wordpressId}
              </p>
              <p>
                <span className="text-gray-500">Status:</span>{" "}
                {user.rmUserStatus === 0 ? "Active" : "Inactive"}
              </p>
              <p>
                <span className="text-gray-500">Step:</span>{" "}
                {user.onboardingStep.replace(/_/g, " ")}
              </p>
              <p>
                <span className="text-gray-500">Created:</span>{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="text-gray-500">Activated:</span>{" "}
                {user.activatedAt
                  ? new Date(user.activatedAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">First login:</span>{" "}
                {user.firstLoginAt
                  ? new Date(user.firstLoginAt).toLocaleString()
                  : "No login"}
              </p>
              <p>
                <span className="text-gray-500">Last login:</span>{" "}
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString()
                  : "No login"}
              </p>
              {user.completedAt && (
                <p>
                  <span className="text-gray-500">Completed:</span>{" "}
                  {new Date(user.completedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </section>

          {/* Email Validation */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Email Validation
            </h3>
            {user.emailValidatedAt ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Valid:</span>
                  <Badge
                    value={user.emailValid}
                    trueLabel="Valid"
                    falseLabel="Invalid"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Deliverable:</span>
                  <Badge
                    value={user.emailDeliverable}
                    trueLabel="Yes"
                    falseLabel="No"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Quality:</span>
                  <span className="font-medium">
                    {user.emailQualityScore !== null
                      ? `${(user.emailQualityScore * 100).toFixed(0)}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Disposable:</span>
                  <Badge
                    value={user.emailIsDisposable}
                    trueLabel="Yes"
                    falseLabel="No"
                    invert
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Free Email:</span>
                  <Badge
                    value={user.emailIsFreeEmail}
                    trueLabel="Yes"
                    falseLabel="No"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Catch-all:</span>
                  <Badge
                    value={user.emailIsCatchAll}
                    trueLabel="Yes"
                    falseLabel="No"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-28">Breached:</span>
                  <Badge
                    value={user.emailIsBreached}
                    trueLabel="BREACHED"
                    falseLabel="Clean"
                    invert
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Validated:{" "}
                  {new Date(user.emailValidatedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                Not validated yet.
                <button
                  onClick={() => onValidateEmail(user.id)}
                  className="ml-2 text-blue-600 hover:underline"
                >
                  Validate now
                </button>
              </div>
            )}
          </section>

          {/* Email Tracking */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Email Tracking
            </h3>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-gray-500">Admin notified:</span>{" "}
                {user.adminNotifiedAt
                  ? new Date(user.adminNotifiedAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">Pending breach alert:</span>{" "}
                {user.pendingBreachAlert ? "Yes" : "No"}
              </p>
              <p>
                <span className="text-gray-500">Breach alert sent:</span>{" "}
                {user.breachAlertSentAt
                  ? new Date(user.breachAlertSentAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">Breach alert error:</span>{" "}
                {user.breachAlertLastError || "None"}
              </p>
              <p>
                <span className="text-gray-500">Breach notices sent:</span>{" "}
                {user.breachNotificationCount}
              </p>
              <p>
                <span className="text-gray-500">Last breach notice:</span>{" "}
                {user.breachNotificationSentAt
                  ? new Date(user.breachNotificationSentAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">Password reminders:</span>{" "}
                {user.passwordReminderCount}
                {user.passwordReminderSentAt &&
                  ` (last: ${new Date(user.passwordReminderSentAt).toLocaleString()})`}
              </p>
              <p>
                <span className="text-gray-500">Reminder engine count:</span>{" "}
                {user.reminderCount}
              </p>
              <p>
                <span className="text-gray-500">Reminder cadence:</span>{" "}
                {reminderCadence}
              </p>
              <p>
                <span className="text-gray-500">Last reminder sent:</span>{" "}
                {user.lastReminderSentAt
                  ? new Date(user.lastReminderSentAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">Congrats sent:</span>{" "}
                {user.congratsSentAt
                  ? new Date(user.congratsSentAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">Deactivated at:</span>{" "}
                {user.deactivatedAt
                  ? new Date(user.deactivatedAt).toLocaleString()
                  : "No"}
              </p>
              <p>
                <span className="text-gray-500">Deactivation reason:</span>{" "}
                {user.deactivationReason || "N/A"}
              </p>
              <p>
                <span className="text-gray-500">Deactivation email sent:</span>{" "}
                {user.deactivationEmailSentAt
                  ? new Date(user.deactivationEmailSentAt).toLocaleString()
                  : "No"}
              </p>
            </div>
          </section>

          {/* Reminder History */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              Reminder History
            </h3>
            {reminderHistory.length === 0 ? (
              <p className="text-sm text-gray-400">No reminders sent yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {reminderHistory.slice(0, 10).map((item, idx) => (
                  <p key={`${item.sentAt}-${idx}`} className="text-gray-600">
                    {new Date(item.sentAt).toLocaleString()} -{" "}
                    {item.type === "logged_in"
                      ? "Logged-in reminder"
                      : "No-login reminder"}
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* Actions */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {user.onboardingStep === "pending_approval" && (
                <button
                  onClick={() => onAction(user.id, "approve")}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Approve User
                </button>
              )}
              {user.onboardingStep === "awaiting_password_change" && (
                <button
                  onClick={() => onAction(user.id, "check_password")}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Check Password
                </button>
              )}
              {user.onboardingStep !== "completed" && (
                <button
                  onClick={() => onAction(user.id, "complete")}
                  className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  Mark Complete
                </button>
              )}
              <button
                onClick={handleDisable}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
              >
                Disable User
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Delete User
              </button>
              {user.onboardingStep === "awaiting_password_change" && (
                <button
                  onClick={handleReminderTest}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                >
                  Run Reminder Test
                </button>
              )}
              {!user.emailValidatedAt && (
                <button
                  onClick={() => onValidateEmail(user.id)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                >
                  Validate Email
                </button>
              )}
            </div>

            {/* Step Override */}
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-1">Override step:</p>
              <div className="flex gap-1">
                {["pending_approval", "awaiting_password_change", "completed"].map(
                  (step) => (
                    <button
                      key={step}
                      disabled={user.onboardingStep === step}
                      onClick={() => onOverride(user.id, step)}
                      className={`px-2 py-1 text-xs rounded border ${
                        user.onboardingStep === step
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {step.replace(/_/g, " ")}
                    </button>
                  )
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
